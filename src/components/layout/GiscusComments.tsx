import { useThemeContext } from '@/contexts/theme';
import { usePathname } from 'next/navigation';
import React, { useEffect, useRef, useLayoutEffect } from 'react';

const GISCUS_THEME_MODES = {
  LIGHT: 'light',
  DARK: 'dark_dimmed',
};

const GiscusComments = () => {
  const { isDark, isThemeLoaded } = useThemeContext();
  const commentsRef = useRef<HTMLDivElement>(null);
  const giscusLoaded = useRef(false);
  const pathname = usePathname();

  useLayoutEffect(() => {
    // Function to append the giscus script
    const appendGiscus = () => {
      if (!isThemeLoaded || !commentsRef.current) return;

      const giscusTheme = isDark
        ? GISCUS_THEME_MODES.DARK
        : GISCUS_THEME_MODES.LIGHT;
      const script = document.createElement('script');

      script.src = 'https://giscus.app/client.js';
      script.setAttribute('data-repo', 'dwarvesf/memo-comments'); // Repo
      script.setAttribute('data-repo-id', 'R_kgDOOMUNdg'); // Repo ID
      script.setAttribute('data-category', 'Announcements'); // Category
      script.setAttribute('data-category-id', 'DIC_kwDOOMUNds4CskyZ'); // Category ID
      script.setAttribute('data-mapping', 'pathname'); // Use pathname mapping for comments
      script.setAttribute('data-strict', '1'); // Enable strict mode to prevent fuzzy matching
      script.setAttribute('data-theme', giscusTheme); // Set theme based on current mode
      script.setAttribute('crossorigin', 'anonymous'); // Enable CORS
      script.setAttribute('data-reactions-enabled', '1'); // Enable reactions
      script.setAttribute('data-emit-metadata', '0'); // Disabled metadata emission
      script.setAttribute('data-input-position', 'bottom'); // Enable input position
      script.setAttribute('data-lang', 'en'); // Set language to English
      script.setAttribute('data-loading', 'lazy'); // Lazy load the script
      script.async = true;

      script.onload = () => {
        giscusLoaded.current = true;
      };

      if (commentsRef.current) {
        commentsRef.current.innerHTML = ''; // Clear previous comments
        commentsRef.current.appendChild(script);
      }
    };

    const timer = setTimeout(appendGiscus, 0);

    return () => {
      clearTimeout(timer);
      // Clean up script if component unmounts before script loads
      if (!giscusLoaded.current && commentsRef.current) {
        commentsRef.current.innerHTML = '';
      }
    };
  }, [isThemeLoaded, pathname]); // Re-run when pathname or theme changes
  // Update theme when app theme changes
  useEffect(() => {
    if (!giscusLoaded.current) return;
    const giscusTheme = isDark
      ? GISCUS_THEME_MODES.DARK
      : GISCUS_THEME_MODES.LIGHT;
    const giscusIframe = document.querySelector<HTMLIFrameElement>(
      'iframe.giscus-frame',
    );

    const message = {
      giscus: {
        setConfig: {
          theme: giscusTheme,
        },
      },
    };

    if (giscusIframe) {
      giscusIframe.contentWindow?.postMessage(message, 'https://giscus.app');
    }
  }, [isDark]);
  return (
    <div ref={commentsRef} className="giscus-container relative">
      {/* giscus will append the comments iframe here */}
    </div>
  );
};

export default GiscusComments;
