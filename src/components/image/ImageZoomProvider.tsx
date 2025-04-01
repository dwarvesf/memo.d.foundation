import React, { useEffect, useState } from 'react';
import ImageFullScreenModal from './ImageFullScreenModal';

interface Props {
  children?: React.ReactNode;
}

const ImageZoomProvider = ({ children }: Props) => {
  // State for React-based modal
  const [modalOpen, setModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState('');
  const [imageAlt, setImageAlt] = useState('');

  useEffect(() => {
    // Image zoom functionality
    function wrapImageWithContainer(img: HTMLImageElement) {
      // Skip if already wrapped
      if (img.closest('[data-image-container]')) return;

      // Skip if no-zoom class or in sidebar
      if (img.classList.contains('no-zoom') || img.closest('.sidebar')) return;

      // Create container
      const container = document.createElement('div');
      container.setAttribute('data-image-container', 'true');
      container.className =
        'relative inline-block max-w-full not-first:mt-[var(--element-margin)]';

      // Tables should have no margin
      if (img.closest('table')) {
        container.classList.remove('not-first:mt-[var(--element-margin)]');
        container.classList.add('m-0');
      }

      // Create zoom controls
      const zoomControls = document.createElement('div');
      zoomControls.className =
        'absolute top-2.5 right-2.5 flex flex-col gap-1.5 opacity-0 transition-opacity duration-300 z-10 group-hover:opacity-100';

      // Add hover class to parent
      container.classList.add('group');

      // Add zoom-in button with icon
      const zoomIn = document.createElement('div');
      zoomIn.className =
        'bg-white/80 dark:bg-black/60 p-1.5 rounded cursor-pointer shadow hover:bg-white dark:hover:bg-black/80 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md';
      zoomIn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="block stroke-neutral-700 dark:stroke-white">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" x2="16.65" y1="21" y2="16.65"/>
          <line x1="11" x2="11" y1="8" y2="14"/>
          <line x1="8" x2="14" y1="11" y2="11"/>
        </svg>
      `;
      zoomControls.appendChild(zoomIn);

      // Replace the image with the container structure
      img.parentNode?.insertBefore(container, img);
      container.appendChild(img);
      container.appendChild(zoomControls);

      // Set up click handler for zoom control
      zoomIn.addEventListener('click', () => {
        // Use React state to show modal
        setImageSrc(img.src);
        setImageAlt(img.alt || '');
        setModalOpen(true);
        document.body.style.overflow = 'hidden'; // Prevent scrolling
      });
    }

    function initializeZoom() {
      // First wrap all images with zoom container
      document
        .querySelectorAll<HTMLImageElement>(
          'main img:not(.no-zoom):not([data-image-processed])',
        )
        .forEach(img => {
          img.setAttribute('data-image-processed', 'true');
          wrapImageWithContainer(img);
        });
    }

    // Initialize when component mounts
    initializeZoom();

    // Set up a MutationObserver to detect new images
    const observer = new MutationObserver(mutations => {
      let shouldReinitialize = false;

      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if any added nodes are images or contain images
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.tagName === 'IMG' || element.querySelector('img')) {
                shouldReinitialize = true;
              }
            }
          });
        }
      });

      if (shouldReinitialize) {
        initializeZoom();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      // Clean up event listeners and observers when component unmounts
      observer.disconnect();
    };
  }, []); // Empty dependency array means this runs once on mount

  // Close modal handler
  const handleCloseModal = () => {
    setModalOpen(false);
    document.body.style.overflow = ''; // Restore scrolling
  };

  return (
    <>
      {children}
      <ImageFullScreenModal
        isOpen={modalOpen}
        src={imageSrc}
        alt={imageAlt}
        onClose={handleCloseModal}
      />
    </>
  );
};

export default ImageZoomProvider;
