import React, { useEffect, useRef, useState } from 'react';
import ImageFullScreenModal, { ImageModalHandle } from './ImageFullScreenModal';

export interface ImageZoomProviderProps {
  children?: React.ReactNode;
  mainScrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

const ImageZoomProvider = ({
  children,
  mainScrollContainerRef,
}: ImageZoomProviderProps) => {
  // State for React-based modal
  const [modalOpen, setModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [initialRect, setInitialRect] = useState<DOMRect | null>(null);
  const [naturalDimensions, setNaturalDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(
    null,
  );
  const modalRef = useRef<ImageModalHandle>(null);

  useEffect(() => {
    // Image zoom functionality
    function wrapImageWithContainer(img: HTMLImageElement) {
      // Skip if already wrapped
      if (img.closest('[data-image-container]')) return;

      // Skip if no-zoom class or in sidebar
      if (img.classList.contains('no-zoom') || img.closest('.sidebar')) return;

      // Also add click handler directly to image for better UX
      img.classList.add('cursor-zoom-in');
      img.addEventListener('click', e => {
        e.stopPropagation();
        // Capture current image position for animation
        const rect = img.getBoundingClientRect();
        setInitialRect(rect);

        // Get natural image dimensions
        setNaturalDimensions({
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        });

        // Store reference to current image and hide it
        setCurrentImage(img);
        img.style.opacity = '0';

        // Use React state to show modal
        setImageSrc(img.src);
        setImageAlt(img.alt || '');
        setModalOpen(true);
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

  // Handle scroll on main content to dismiss modal
  useEffect(() => {
    const handleMainScroll = () => {
      if (modalOpen && modalRef.current?.close instanceof Function) {
        modalRef.current?.close();
      }
    };

    const scrollContainer = mainScrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleMainScroll);
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleMainScroll);
      }
    };
  }, [modalOpen, mainScrollContainerRef]);

  // Close modal handler
  const handleCloseModal = () => {
    setModalOpen(false);

    // Restore original image opacity
    if (currentImage) {
      currentImage.style.opacity = '1';
      setCurrentImage(null);
    }
  };

  return (
    <>
      {children}
      <ImageFullScreenModal
        ref={modalRef}
        isOpen={modalOpen}
        src={imageSrc}
        alt={imageAlt}
        initialRect={initialRect}
        naturalWidth={naturalDimensions.width}
        naturalHeight={naturalDimensions.height}
        onClose={handleCloseModal}
        mainScrollContainerRef={mainScrollContainerRef}
      />
    </>
  );
};

export default ImageZoomProvider;
