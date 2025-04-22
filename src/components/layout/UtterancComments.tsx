import { useThemeContext } from '@/contexts/theme';
import { usePathname } from 'next/navigation';
import React, { useEffect, useRef, useLayoutEffect } from 'react';

const UtteranceComments = () => {
  const { isDark, isThemeLoaded } = useThemeContext();
  const commentsRef = useRef<HTMLDivElement>(null);
  const utterancesLoaded = useRef(false);
  const pathname = usePathname();

  useLayoutEffect(() => {
    // Function to append the Utterances script
    const appendUtterances = () => {
      if (!isThemeLoaded || !commentsRef.current) return;

      const utterancTheme = isDark ? 'github-dark' : 'github-light';
      const script = document.createElement('script');

      script.src = 'https://utteranc.es/client.js';
      script.setAttribute('repo', 'dwarvesf/memo-comments');
      script.setAttribute('issue-term', 'pathname');
      script.setAttribute('theme', utterancTheme);
      script.setAttribute('crossorigin', 'anonymous');
      script.async = true;

      script.onload = () => {
        utterancesLoaded.current = true;
      };

      if (commentsRef.current) {
        commentsRef.current.innerHTML = ''; // Clear previous comments
        commentsRef.current.appendChild(script);
      }
    };

    const timer = setTimeout(appendUtterances, 0);

    return () => {
      clearTimeout(timer);
      // Clean up script if component unmounts before script loads
      if (!utterancesLoaded.current && commentsRef.current) {
        commentsRef.current.innerHTML = '';
      }
    };
  }, [isThemeLoaded, pathname]); // Re-run when pathname or theme changes
  // Update theme when app theme changes
  useEffect(() => {
    if (!utterancesLoaded.current) return;
    const utterancTheme = isDark ? 'github-dark' : 'github-light';
    const utterancIframe =
      document.querySelector<HTMLIFrameElement>('.utterances-frame');

    if (utterancIframe) {
      utterancIframe.contentWindow?.postMessage(
        {
          type: 'set-theme',
          theme: utterancTheme,
        },
        'https://utteranc.es',
      );
    }
  }, [isDark]);
  return (
    <div ref={commentsRef} className="utterance-container relative">
      {/* Utterances will append the comments iframe here */}
    </div>
  );
};

export default UtteranceComments;
