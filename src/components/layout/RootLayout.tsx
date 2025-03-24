import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Sidebar from './Sidebar';
import Header from './Header';
import TableOfContents from './TableOfContents';

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
      children?: any[];
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
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [readingMode, setReadingMode] = useState(false);
  const [mounted, setMounted] = useState(false);

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

    // Initialize theme from localStorage
    const savedTheme = localStorage?.getItem('theme') as 'light' | 'dark' | 'system' | null;

    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', prefersDark);
      } else {
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
      }
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme('system');
      document.documentElement.classList.toggle('dark', prefersDark);
    }

    // Initialize reading mode from localStorage
    const savedReadingMode = localStorage?.getItem('readingMode') === 'true';
    setReadingMode(savedReadingMode);

    // Handle system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        document.documentElement.classList.toggle('dark', e.matches);
      }
    };

    // Add keyboard shortcut for reading mode (Cmd/Ctrl+Shift+F)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        toggleReadingMode();
      }
    };

    // Set CSS variable for header height
    document.documentElement.style.setProperty('--header-height', '60px');

    // Add event listeners
    mediaQuery.addEventListener('change', handleChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line
  }, []);

  // Update theme preferences when theme state changes
  useEffect(() => {
    if (!mounted) return;

    localStorage.setItem('theme', theme);

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    } else {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme, mounted]);

  const toggleTheme = () => {
    const themes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const newTheme = themes[(currentIndex + 1) % themes.length];
    setTheme(newTheme);
  };

  return (
    <div className={`min-h-screen flex flex-col bg-background text-foreground transition-colors ${readingMode ? 'reading-mode' : ''}`}>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        {image && <meta property="og:image" content={image} />}
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap" rel="stylesheet" />
      </Head>

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main content area */}
      <div className="flex flex-col ml-0 md:ml-[56px] lg:ml-[232px] min-h-screen">
        {/* Header */}
        <Header 
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          toggleTheme={toggleTheme}
          toggleReadingMode={toggleReadingMode}
          theme={theme}
          readingMode={readingMode}
        />
        
        {/* Main content grid */}
        <div className="flex flex-1 relative">
          <div id="overlay" className={`fixed inset-0 bg-black/30 z-40 ${sidebarOpen ? 'block md:hidden' : 'hidden'}`}></div>

          {/* Main content */}
          <main className="relative flex-1">
            {/* Yggdrasil tree background */}
            <img
              className="yggdrasil-tree"
              src="/assets/img/footer-bg.svg"
              alt=""
            />

            {/* Neko mascots */}
            <img className="neko" src="/assets/img/neko.png" alt="Neko" />
            <img className="neko2" src="/assets/img/neko-2.png" alt="Neko2" />

            {/* Content */}
            <div className="w-full max-w-5xl mx-auto px-4 py-8">
              {children}
            </div>
          </main>

          {/* Right sidebar for TOC and metadata */}
          <aside className="right-sidebar hidden lg:block w-64 xl:w-72 shrink-0 p-4 pt-8 border-l border-border">
            <div className="sticky top-16">
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">On this page</h3>
                <div className="table-of-contents">
                  {tocItems.length > 0 && <TableOfContents items={tocItems} />}
                </div>
              </div>
              
              {/* Metadata section - will be populated by the content */}
              <div className="metadata"></div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}