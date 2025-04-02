import { useRouter } from 'next/router';
import { useEffect, RefObject } from 'react';

/**
 * Hook to scroll an element to the top when route changes
 * @param elementRef - Ref to the element to scroll
 */
export function useScrollToTopOnRouteChange(
  elementRef: RefObject<HTMLElement | null>,
) {
  const router = useRouter();

  useEffect(() => {
    // Handler to scroll to top when route changes
    const handleRouteChange = () => {
      if (elementRef.current) {
        elementRef.current.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      }
    };

    // Subscribe to route change events
    router.events.on('routeChangeComplete', handleRouteChange);

    // Unsubscribe from events when component unmounts
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [elementRef, router.events]);
}
