import { getStaticJSONPaths } from '@/lib/content/paths';
import { Html, Head, Main, NextScript } from 'next/document';
import Script from 'next/script';

const unifiedRedirectPaths = await (async () => {
  let staticJSONPaths: Record<string, string> = {};

  try {
    staticJSONPaths = await getStaticJSONPaths();
  } catch (error) {
    console.error('Error fetching static Aliases JSON Paths:', error);
    // Continue with empty staticJSONPaths if file not found or error occurs
  }

  return Object.fromEntries(
    Object.entries(staticJSONPaths).map(([key, value]) => [value, key]),
  );
})();

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />

        {/* Fonts preloading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <script
          dangerouslySetInnerHTML={{
            // Add the unified redirects to the global window object
            // This will be used in the client-side to handle redirects
            // Since this is a static JSON file can only be loaded at build time
            __html: `window._app_unified_redirects = ${JSON.stringify(unifiedRedirectPaths)};`,
          }}
        />
        <Script
          src="https://plausible.io/js/script.js"
          data-domain="memo.d.foundation"
          defer
        />
      </Head>
      <body className="min-h-screen antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
