// Image zoom functionality
function initializeZoom() {
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
      const img = container.querySelector('img');
      const modal = container.querySelector('.zoom-modal');
      
      // Show modal
      modal.classList.add('active');
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
  modal.classList.remove('active');
  document.body.style.overflow = ''; // Restore scrolling
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeZoom);
