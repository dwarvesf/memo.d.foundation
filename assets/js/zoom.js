// Image zoom functionality
function wrapImageWithContainer(img) {
  // Skip if already wrapped
  if (img.closest('.image-container')) return;

  // Skip if no-zoom class or in sidebar
  if (img.classList.contains('no-zoom') || img.closest('.sidebar')) return;

  // Create container
  const container = document.createElement('div');
  container.className = 'image-container';

  // Create zoom controls
  const zoomControls = document.createElement('div');
  zoomControls.className = 'zoom-controls';
  zoomControls.innerHTML = `
    <div class="zoom-in">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" x2="16.65" y1="21" y2="16.65"/>
        <line x1="11" x2="11" y1="8" y2="14"/>
        <line x1="8" x2="14" y1="11" y2="11"/>
      </svg>
    </div>
  `;

  // Create zoom modal
  const modal = document.createElement('div');
  modal.className = 'zoom-modal';
  modal.innerHTML = `
    <div class="zoom-modal-content">
      <img
        src="${img.src}"
        alt="${img.alt || ''}"
        class="zoomed-img"
      />
      <button class="close-zoom">×</button>
    </div>
  `;

  // Replace the image with the container structure
  img.parentNode.insertBefore(container, img);
  container.appendChild(img);
  container.appendChild(zoomControls);
  container.appendChild(modal);
}

function initializeZoom() {
  // First wrap all images with zoom container
  document.querySelectorAll('main img:not(.zoomed-img):not(.no-zoom)').forEach(wrapImageWithContainer);

  // Handle ESC key press
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.querySelector('.zoom-modal.active');
      if (modal) {
        closeZoomModal(modal);
      }
    }
  });

  // Initialize zoom buttons
  document.querySelectorAll('.zoom-in').forEach(button => {
    button.addEventListener('click', (e) => {
      const container = e.currentTarget.closest('.image-container');
      const modal = container.querySelector('.zoom-modal');
      const zoomedImg = modal.querySelector('.zoomed-img');

      // Show modal and center image
      modal.classList.add('active');
      zoomedImg.style.transform = 'translate(-50%, -50%) scale(1)';
      zoomedImg.style.position = 'absolute';
      zoomedImg.style.left = '50%';
      zoomedImg.style.top = '50%';

      document.body.style.overflow = 'hidden'; // Prevent scrolling
    });
  });

  // Close on clicking outside image
  document.querySelectorAll('.zoom-modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeZoomModal(modal);
      }
    });
  });

  // Close on clicking close button
  document.querySelectorAll('.close-zoom').forEach(button => {
    button.addEventListener('click', (e) => {
      const modal = e.currentTarget.closest('.zoom-modal');
      closeZoomModal(modal);
    });
  });
}

function closeZoomModal(modal) {
  const zoomedImg = modal.querySelector('.zoomed-img');
  if (zoomedImg) {
    zoomedImg.style.transform = 'translate(-50%, -50%) scale(1)';
  }
  modal.classList.remove('active');
  document.body.style.overflow = ''; // Restore scrolling
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeZoom);
