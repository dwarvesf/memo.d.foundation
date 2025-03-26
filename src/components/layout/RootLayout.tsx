import React, { useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Sidebar from './Sidebar';
import Header from './Header';
import { useThemeContext } from '@/contexts/theme';
import Footer from './Footer';
import DirectoryTree from './DirectoryTree';
import { IMetadata, ITocItem, ITreeNode } from '@/types';
import RightSidebar from './RightSidebar';
import { useLayoutContext, withLayoutContext } from '@/contexts/layout';
import TableOfContents from './TableOfContents';

interface RootLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  image?: string;
  tocItems?: ITocItem[];
  metadata?: IMetadata;
  directoryTree?: Record<string, ITreeNode>;
}

function RootLayout({
  children,
  title = 'Dwarves Memo',
  description = 'Knowledge sharing platform for Dwarves Foundation',
  image,
  metadata,
  tocItems,
  directoryTree,
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
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        {image && <meta property="og:image" content={image} />}
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
          href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />
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
            <main className="main-content relative mx-auto max-w-[var(--container-max-width)] flex-1 p-[var(--main-padding-mobile)] pb-16 font-serif xl:p-[var(--main-padding)]">
              {/* Yggdrasil tree background */}
              <Image
                className="yggdrasil-tree"
                src="/assets/img/footer-bg.svg"
                alt=""
                width={1920}
                height={1080}
              />

              {/* Neko mascots */}
              <Image
                className="neko"
                src="/assets/img/neko.png"
                alt="Neko"
                width={150}
                height={150}
              />
              <Image
                className="neko2"
                src="/assets/img/neko-2.png"
                alt="Neko2"
                width={150}
                height={150}
              />

              {/* Content */}
              <div className="memo-content mb-10">{children}</div>
            </main>

            <div className="toc-space"></div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}

export default withLayoutContext(RootLayout);
