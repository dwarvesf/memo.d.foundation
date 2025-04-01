import React, { useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
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

interface RootLayoutProps extends RootLayoutPageProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  image?: string;
  tocItems?: ITocItem[];
  metadata?: IMetadata;
}

function RootLayout({
  children,
  title = 'Dwarves Memo',
  description = 'Knowledge sharing platform for Dwarves Foundation',
  image,
  metadata,
  tocItems,
  directoryTree,
  searchIndex,
}: RootLayoutProps) {
  const { theme, toggleTheme } = useThemeContext();
  const {
    isOpenSidebar,
    setIsOpenSidebar,
    toggleIsOpenSidebar,
    readingMode,
    toggleReadingMode,
  } = useLayoutContext();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'f' &&
        event.shiftKey &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault();
        toggleReadingMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
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
        <link rel="icon" type="image/x-icon" href="{{ $favicon.Permalink }}" />
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
        <div className="relative flex flex-1 flex-col overflow-y-auto">
          <Header
            toggleSidebar={toggleIsOpenSidebar}
            toggleTheme={toggleTheme}
            toggleReadingMode={toggleReadingMode}
            theme={theme}
            readingMode={readingMode}
          />

          {/* Main content grid */}
          <div className="main-grid relative w-full flex-1 flex-col">
            <RightSidebar metadata={metadata} />
            <TableOfContents items={tocItems} />
            <main className="main-content mx-auto max-w-[var(--container-max-width)] min-w-0 flex-1 p-[var(--main-padding-mobile)] pb-16 font-serif xl:p-[var(--main-padding)]">
              {/* Yggdrasil tree background */}
              <Image
                className="yggdrasil-tree no-zoom pointer-events-none absolute bottom-8 left-1/2 w-[60vw] max-w-xs -translate-x-1/2 object-contain opacity-[0.03] md:w-[20vw] xl:w-[20vw] dark:opacity-100"
                src="/assets/img/footer-bg.svg"
                alt=""
                width={1920}
                height={1080}
              />
              {/* Content */}
              <div className="memo-content mb-8">{children}</div>
            </main>

            <div className="toc-space"></div>
          </div>
        </div>
        <Footer />
      </div>
      <ImageZoomProvider />
    </SearchProvider>
  );
}

export default withLayoutContext(RootLayout);
