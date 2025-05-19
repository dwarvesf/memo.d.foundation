import React, { useEffect } from 'react';
import Head from 'next/head';
import Sidebar from './Sidebar';
import Header from './Header';
import { useThemeContext } from '@/contexts/theme';
import Footer from './Footer';
import DirectoryTree from './DirectoryTree';
import { IMetadata, ITocItem, ContributorLayoutPageProps } from '@/types';
import { useLayoutContext, withLayoutContext } from '@/contexts/layout';
import ImageZoomProvider from '../image/ImageZoomProvider';
import { SearchProvider } from '../search';
import { useScrollToTopOnRouteChange } from '@/hooks/useScrollToTopOnRouteChange';
import { CodeblockHeaderInjector } from '../codeblock/CodeblockHeader';

interface ContributorLayoutProps extends ContributorLayoutPageProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  image?: string;
  tocItems?: ITocItem[];
  metadata?: IMetadata;
}

function ContributorLayout({
  children,
  title = 'Dwarves Memo',
  description = 'Knowledge sharing platform for Dwarves Foundation',
  image,
  metadata,
  directoryTree,
  searchIndex,
}: ContributorLayoutProps) {
  const { theme, toggleTheme } = useThemeContext();
  const {
    isOpenSidebar,
    setIsOpenSidebar,
    toggleIsOpenSidebar,
    readingMode,
    toggleReadingMode,
  } = useLayoutContext();
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  useScrollToTopOnRouteChange(scrollContainerRef);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.key === 'f' || event.key === 'F') &&
        event.shiftKey &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault();
        toggleReadingMode();
      }
    };
    const options = {
      capture: true,
    };
    document.addEventListener('keydown', handleKeyDown, options);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, options);
    };
  }, [toggleReadingMode]);

  return (
    <SearchProvider searchIndex={searchIndex}>
      <Head>
        <title>{title}</title>
        <meta property="title" content={title} />
        <meta property="og:title" content={title} />

        {description && <meta name="description" content={description} />}
        {description && (
          <meta property="og:description" content={description} />
        )}

        {image && <meta property="og:image" content={image} />}
        {!!metadata?.tags?.length && (
          <meta name="keywords" content={metadata?.tags.join(', ')} />
        )}
        <meta property="og:type" content="article" />

        <meta property="og:site_name" content="Dwarves Memo"></meta>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" href="/favicon.ico" />

        {/* RSS feed link tags for auto-discovery */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${title} - RSS Feed`}
          href="/feed.xml"
        />
        <link
          rel="alternate"
          type="application/atom+xml"
          title={`${title} - Atom Feed`}
          href="/atom.xml"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,100..900;1,100..900&amp;family=IBM+Plex+Sans:ital,wght@0,100..700;1,100..700&amp;display=swap"
          rel="stylesheet"
        ></link>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap"
          rel="stylesheet"
        />
      </Head>
      {/* Sidebar */}

      <Sidebar isOpen={isOpenSidebar} setIsOpen={setIsOpenSidebar} />

      <div
        className={`bg-background text-foreground relative flex h-screen font-sans transition-colors ${readingMode ? 'reading-mode' : ''}`}
      >
        <DirectoryTree tree={directoryTree} />
        <div
          ref={scrollContainerRef}
          className="main-layout relative flex flex-1 flex-col overflow-y-auto"
        >
          <Header
            toggleSidebar={toggleIsOpenSidebar}
            toggleTheme={toggleTheme}
            toggleReadingMode={toggleReadingMode}
            theme={theme}
            readingMode={readingMode}
          />

          {/* Main content grid */}
          <main className="pb-10">{children}</main>
        </div>
        <Footer />
      </div>
      <ImageZoomProvider />
      <CodeblockHeaderInjector metadata={metadata} />
    </SearchProvider>
  );
}

export default withLayoutContext(ContributorLayout);
