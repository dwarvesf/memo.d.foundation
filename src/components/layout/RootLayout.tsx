import React, { useEffect } from 'react';
import Head from 'next/head';
import Sidebar from './Sidebar';
import Header from './Header';
import { useThemeContext } from '@/contexts/theme';
import Footer from './Footer';
import DirectoryTree from './DirectoryTree';
import { IMetadata, ITocItem, RootLayoutPageProps } from '@/types';
import RightSidebar from './RightSidebar';
import { useLayoutContext, withLayoutContext } from '@/contexts/layout';
import TableOfContents from './TableOfContents';
import ImageZoomProvider from '../image/ImageZoomProvider';
import { SearchProvider } from '../search';
import { useScrollToTopOnRouteChange } from '@/hooks/useScrollToTopOnRouteChange';
import { cn } from '@/lib/utils';
import { CodeblockHeaderInjector } from '../codeblock/CodeblockHeader';

interface RootLayoutProps extends RootLayoutPageProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  image?: string;
  tocItems?: ITocItem[];
  metadata?: IMetadata;
  hideRightSidebar?: boolean;
  mainClassName?: string;
  fullWidth?: boolean;
  // pinnedNotes and tags are now included via RootLayoutPageProps
}

const scrollOnTopIgnoreRoutes = ['/prompts'];

function RootLayout({
  children,
  title = 'Dwarves Memo',
  description = 'Knowledge sharing platform for Dwarves Foundation',
  image,
  metadata,
  tocItems,
  directoryTree,
  searchIndex,
  hideRightSidebar = false,
  fullWidth = false,
  mainClassName = '',
  // pinnedNotes and tags are no longer used directly by RootLayout
}: RootLayoutProps) {
  const { theme, toggleTheme } = useThemeContext();
  const {
    isOpenSidebar,
    setIsOpenSidebar,
    toggleIsOpenSidebar,
    readingMode,
    toggleReadingMode,
  } = useLayoutContext();
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  useScrollToTopOnRouteChange(scrollContainerRef, scrollOnTopIgnoreRoutes);

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
          <div
            className={cn('main-grid relative w-full flex-1 flex-col', {
              'full-width': fullWidth,
            })}
          >
            {!hideRightSidebar && <RightSidebar metadata={metadata} />}
            <TableOfContents items={tocItems} />
            <main
              className={cn(
                'main-content w-container-max mx-auto max-w-[var(--container-max-width)] xl:w-full',
                'min-w-0 flex-1 p-[var(--main-padding-mobile)] font-serif xl:p-[var(--main-padding)]',
                mainClassName,
              )}
            >
              {/* Content */}
              <div className="memo-content pt-2 pb-8">{children}</div>
            </main>

            <div className="toc-space"></div>
          </div>
        </div>
        <Footer />
      </div>
      <ImageZoomProvider />
      <CodeblockHeaderInjector metadata={metadata} />
    </SearchProvider>
  );
}

export default withLayoutContext(RootLayout);
