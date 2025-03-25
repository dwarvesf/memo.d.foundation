import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Sidebar from './Sidebar';
import Header from './Header';
import TableOfContents from './TableOfContents';
import { useThemeContext } from '@/contexts/theme';

interface RootLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  image?: string;
  tocItems?: {
    id: string;
    text: string;
    level: number;
    children?: {
      id: string;
      text: string;
      level: number;
      children?: Array<{ id: string; text: string; level: number }>;
    }[];
  }[];
}

export default function RootLayout({
  children,
  title = 'Dwarves Memo',
  description = 'Knowledge sharing platform for Dwarves Foundation',
  image,
  tocItems = [],
}: RootLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, toggleTheme } = useThemeContext();

  // Define toggleReadingMode before it's used in useEffect
  const toggleReadingMode = useCallback(() => {
    const newReadingMode = !readingMode;
    setReadingMode(newReadingMode);
    if (mounted) {
      localStorage.setItem('readingMode', newReadingMode.toString());
    }
  }, [readingMode, mounted]);

  // Only use client-side features after component is mounted
  useEffect(() => {
    setMounted(true);
    // Initialize reading mode from localStorage
    const savedReadingMode = localStorage?.getItem('readingMode') === 'true';
    setReadingMode(savedReadingMode);

    // No need to handle system theme changes since we're not using 'system' theme anymore
    // We'll still keep the media query for initial setup, but we won't need the change handler

    // Add keyboard shortcut for reading mode (Cmd/Ctrl+Shift+F)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        toggleReadingMode();
      }
    };

    // Set CSS variable for header height
    document.documentElement.style.setProperty('--header-height', '60px');

    // Add keyboard event listener
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line
  }, []);

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
      <div
        className={`bg-background text-foreground flex min-h-screen flex-col font-sans transition-colors ${readingMode ? 'reading-mode' : ''}`}
      >
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

        {/* Main content area */}
        <div className="ml-0 flex min-h-screen flex-col md:ml-[56px] lg:ml-[var(--nav-sidebar-width)]">
          {/* Header */}
          <Header
            toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            toggleTheme={toggleTheme}
            toggleReadingMode={toggleReadingMode}
            theme={theme}
            readingMode={readingMode}
          />

          {/* Main content grid */}
          <div className="relative flex flex-1">
            <div
              id="overlay"
              className={`fixed inset-0 z-40 bg-black/30 ${sidebarOpen ? 'block md:hidden' : 'hidden'}`}
            ></div>

            {/* Main layout with sidebar */}
            <div className="relative mx-auto flex w-full max-w-[1400px]">
              {/* Main content */}
              <main className="relative mx-auto max-w-[var(--container-max-width)] flex-1 p-6 pb-16 font-serif">
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

              {/* Right sidebar for TOC and metadata */}
              <aside
                className={`right-sidebar border-border w-64 shrink-0 border-l p-4 pt-8 xl:w-72 ${readingMode ? 'hidden' : 'hidden lg:block'}`}
              >
                <div className="sticky top-16 pt-4">
                  <div className="mb-6">
                    <h3 className="text-muted-foreground mb-4 text-sm text-[0.6875rem] font-medium tracking-wider uppercase">
                      On this page
                    </h3>
                    <div className="table-of-contents">
                      {tocItems.length > 0 && (
                        <TableOfContents items={tocItems} />
                      )}
                    </div>
                  </div>

                  {/* Metadata section - will be populated by the content */}
                  <div className="metadata"></div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
