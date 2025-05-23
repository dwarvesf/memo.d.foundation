import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';

export function useRouteSync() {
  const router = useRouter();
  const [, setUpdate] = useState(0);
  const isInternalUpdate = useRef(false);

  const updateRoute = (newPath: string, isReplace = false) => {
    // Mark this as an internal update
    isInternalUpdate.current = true;

    // Update URL without triggering navigation events
    if (isReplace) {
      window.history.replaceState(null, '', newPath);
    } else {
      window.history.pushState(null, '', newPath);
    }

    // Update router state to keep it in sync
    router.asPath = newPath;

    // Reset internal update flag after a tick
    setTimeout(() => {
      isInternalUpdate.current = false;
    }, 0);
    setUpdate(prev => prev + 1); // Trigger a re-render
  };

  useEffect(() => {
    // Handle popstate (browser back/forward)
    const handlePopState = () => {
      if (!isInternalUpdate.current) {
        router.asPath = window.location.pathname;
        setUpdate(prev => prev + 1); // Trigger a re-render
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [router]);

  return { updateRoute };
}
