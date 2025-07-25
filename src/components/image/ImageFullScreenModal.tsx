import { cn } from '@/lib/utils';
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  src: string;
  alt: string;
  onClose: () => void;
  initialRect?: DOMRect | null;
  naturalWidth?: number;
  naturalHeight?: number;
}

// Separate modal component using React
const ImageFullScreenModal = ({
  isOpen,
  src,
  alt,
  onClose: _onClose,
  initialRect,
  naturalWidth = 0,
  naturalHeight = 0,
}: ModalProps) => {
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const initialScaling = useMemo(() => {
    if (!initialRect || !naturalWidth || !naturalHeight) {
      return {
        initialScale: 0.1,
        initialPosition: { x: 0, y: 0 },
        finalScale: 1,
        finalPosition: { x: 0, y: 0 },
      };
    }

    // Calculate what scale the image should be at to match its original rendered size
    const currentScale = Math.min(
      initialRect.width / naturalWidth,
      initialRect.height / naturalHeight,
    );

    // Calculate target scale with viewport constraints
    // Maximum scale is the smaller of:
    // 1. Natural size (scale 1.0)
    // 2. What fits in 90% of viewport
    const viewportScale = Math.min(
      (window.innerWidth * 0.9) / naturalWidth,
      (window.innerHeight * 0.9) / naturalHeight,
    );

    // Target scale: scale up to natural size, but don't overflow viewport
    const idealScale = currentScale < 1.0 ? 1.0 : currentScale;
    const targetScale = Math.min(idealScale, viewportScale);

    // Calculate positions
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const originalCenterX = initialRect.left + initialRect.width / 2;
    const originalCenterY = initialRect.top + initialRect.height / 2;

    return {
      initialScale: currentScale,
      initialPosition: {
        x: originalCenterX - centerX,
        y: originalCenterY - centerY,
      },
      finalScale: targetScale,
      finalPosition: { x: 0, y: 0 },
    };
  }, [initialRect, naturalWidth, naturalHeight]);

  // Handle modal opening animation
  useEffect(() => {
    if (isOpen) {
      // Immediately set initial state (from original image position/scale)
      setScale(initialScaling.initialScale);
      setPosition(initialScaling.initialPosition);
      setIsAnimating(true);
      setHasInitialized(true);

      // Animate to final position and scale after a brief delay to allow initial render
      const timer = setTimeout(() => {
        setScale(initialScaling.finalScale);
        setPosition(initialScaling.finalPosition);
        setTimeout(() => setIsAnimating(false), 400);
      }, 16); // Use requestAnimationFrame timing

      return () => clearTimeout(timer);
    } else {
      // Reset when closing
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setIsAnimating(false);
      setHasInitialized(false);
    }
  }, [isOpen, initialScaling]);

  const onClose = () => {
    setIsAnimating(true);
    setIsClosing(true);
    setScale(initialScaling.initialScale);
    setPosition(initialScaling.initialPosition);
    setTimeout(() => {
      _onClose();
      setIsClosing(false);
    }, 400); // Match animation duration
  };

  // Close modal on ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    const options = {
      capture: true,
    };
    document.addEventListener('keydown', handleKeyDown, options);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, options);
    };
  }, [isOpen, onClose]);

  // Handle wheel events for zooming
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.01;
    setScale(prevScale => {
      // Calculate viewport-constrained maximum scale
      const viewportScale = Math.min(
        (window.innerWidth * 0.9) / (naturalWidth || 1),
        (window.innerHeight * 0.9) / (naturalHeight || 1),
      );

      // Maximum scale: natural size 5 or viewport fit, whichever is smaller
      const maxScale = Math.max(5, viewportScale);

      // Minimum scale: allow zooming out to 0.5x for better navigation
      const minScale = Math.min(0.5, viewportScale);

      return Math.max(minScale, Math.min(prevScale + delta, maxScale));
    });
  };

  // Handle zoom-in and zoom-out
  const handleZoom = (direction: 'in' | 'out') => {
    setScale(prevScale => {
      // Calculate viewport-constrained maximum scale
      const viewportScale = Math.min(
        (window.innerWidth * 0.9) / (naturalWidth || 1),
        (window.innerHeight * 0.9) / (naturalHeight || 1),
      );

      // Maximum scale: natural size 5 or viewport fit, whichever is smaller
      const maxScale = Math.max(5, viewportScale);

      // Minimum scale: allow zooming out to 0.5x for better navigation
      const minScale = Math.min(0.5, viewportScale);

      return direction === 'in'
        ? Math.min(maxScale, prevScale + 0.2)
        : Math.max(minScale, prevScale - 0.2);
    });
  };

  // Handle mouse events for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartPosition({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - startPosition.x,
      y: e.clientY - startPosition.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle touch events for mobile devices
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    setStartPosition({
      x: e.touches[0].clientX - position.x,
      y: e.touches[0].clientY - position.y,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPosition({
      x: e.touches[0].clientX - startPosition.x,
      y: e.touches[0].clientY - startPosition.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Don't render until we've initialized with proper starting position
  if (!isOpen || !hasInitialized) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[1000] transition-all duration-1400 dark:bg-black/70',
        {
          'visible bg-white/70 opacity-100 backdrop-blur-md dark:bg-black/70':
            isOpen,
          'invisible bg-transparent opacity-0 backdrop-blur-none':
            !isOpen || isClosing,
        },
      )}
      onClick={onClose}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="relative h-full w-full">
        <img
          src={src}
          alt={alt}
          className="absolute top-1/2 left-1/2 max-h-none max-w-none object-contain select-none"
          style={{
            transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging
              ? 'none'
              : isAnimating
                ? 'transform 400ms cubic-bezier(0.25, 0.8, 0.25, 1)'
                : 'transform 200ms ease-out',
            cursor: isDragging ? 'grabbing' : 'grab',
            transformOrigin: 'center center',
          }}
          onClick={e => e.stopPropagation()}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          onDragStart={e => e.preventDefault()}
        />
        <button
          className="absolute top-5 right-5 z-[1001] flex h-8 w-8 cursor-pointer items-center justify-center rounded border-none bg-transparent p-1.5 text-2xl leading-none text-neutral-500 transition-all duration-300 hover:bg-black/5 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
          onClick={onClose}
        >
          ×
        </button>

        {/* Zoom controls */}
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 transform gap-2 rounded bg-white/80 p-2 shadow-lg dark:bg-black/80">
          <button
            className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={e => {
              e.stopPropagation();
              handleZoom('out');
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <button
            className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={e => {
              e.stopPropagation();
              // Reset to ideal scale (natural size or viewport fit)
              const viewportScale = Math.min(
                (window.innerWidth * 0.9) / (naturalWidth || 1),
                (window.innerHeight * 0.9) / (naturalHeight || 1),
              );
              const idealScale = Math.min(1.0, viewportScale);
              setScale(idealScale);
              setPosition({ x: 0, y: 0 });
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12h18M12 3v18" />
            </svg>
          </button>
          <button
            className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={e => {
              e.stopPropagation();
              handleZoom('in');
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ImageFullScreenModal;
