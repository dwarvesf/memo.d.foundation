import { useThemeContext } from '@/contexts/theme';
import React, { useEffect, useRef } from 'react';

const UtteranceComments = () => {
  const { isDark, isThemeLoaded } = useThemeContext();
  const commentsRef = useRef<HTMLDivElement>(null);
  const utterancesLoaded = useRef(false);

  useEffect(() => {
    // Only load Utterances once
    if (!isThemeLoaded || !commentsRef.current || utterancesLoaded.current)
      return;
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

    setTimeout(() => {
      if (commentsRef.current && !commentsRef.current.hasChildNodes()) {
        commentsRef.current.appendChild(script);
      }
    }, 0);
    return () => {
      // Clean up script if component unmounts before script loads
      if (!utterancesLoaded.current && script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [isThemeLoaded]);

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
    <div ref={commentsRef} className="relative">
      {/* Utterances will append the comments iframe here */}
    </div>
  );
};

export default UtteranceComments;
