import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import LogoIcon from '../icons/LogoIcon';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import MobileDrawer from './MobileDrawer';
import SunIcon from '../icons/SunIcon';
import MoonIcon from '../icons/MoonIcon';
import { useThemeContext } from '@/contexts/theme';
import { cn } from '@/lib/utils';
import { MemoIcons } from '../icons';
import { ITreeNode } from '@/types';

const navLinks = [
  {
    title: 'Home',
    url: '/',
    Icon: MemoIcons.home,
    description: 'Dashboard and overview',
  },
  {
    title: 'Consulting',
    url: '/consulting',
    Icon: MemoIcons.consulting,
    description: 'Professional services and expertise',
  },
  {
    title: 'Earn',
    url: '/earn',
    Icon: MemoIcons.earn,
    description: 'Opportunities and rewards',
  },
  {
    title: 'Hiring',
    url: '/careers',
    Icon: MemoIcons.careers,
    description: 'Join our team',
  },
  {
    title: 'Changelog',
    url: '/changelog',
    Icon: MemoIcons.updates,
    description: 'Latest updates and releases',
  },
  {
    title: 'OGIFs',
    url: '/updates/ogif',
    Icon: MemoIcons.ogif,
    description: 'Weekly team updates',
  },
  {
    title: 'Prompts',
    url: '/prompts',
    Icon: MemoIcons.prompts,
    description: 'AI prompts and templates',
  },
];

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  directoryTree?: Record<string, ITreeNode>;
}

const Sidebar = ({ isOpen, setIsOpen, directoryTree }: SidebarProps) => {
  const router = useRouter();
  const { isDark, toggleTheme } = useThemeContext();
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close sidebar when changing routes
  useEffect(() => {
    const handleRouteChange = () => {
      setIsOpen(false);
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router, setIsOpen]);

  // Focus sidebar when opened (desktop only)
  useEffect(() => {
    // Only focus on desktop devices
    if (
      isOpen &&
      sidebarRef.current &&
      typeof window !== 'undefined' &&
      window.innerWidth >= 768 // adjust breakpoint as needed
    ) {
      sidebarRef.current.focus();
    }
  }, [isOpen]);

  // Close mobile drawer when switching to desktop screen size
  useEffect(() => {
    const handleResize = () => {
      if (
        typeof window !== 'undefined' &&
        window.innerWidth >= 1280 &&
        isOpen
      ) {
        setIsOpen(false); // Close mobile drawer when switching to desktop (xl: 1280px+)
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, setIsOpen]);

  // Close on Esc key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Check if current path matches link
  const isActiveUrl = (url: string) => {
    // Normalize current path: remove query params/hash and trailing slash (unless it's just '/')
    const currentPath = router.asPath.split('?')[0].split('#')[0];
    const normalizedCurrentPath =
      currentPath.endsWith('/') && currentPath !== '/'
        ? currentPath.slice(0, -1)
        : currentPath;

    // Normalize target URL: remove trailing slash (unless it's just '/')
    const normalizedUrl =
      url.endsWith('/') && url !== '/' ? url.slice(0, -1) : url;

    // Only exact match should be highlighted
    return normalizedCurrentPath === normalizedUrl;
  };

  // Sidebar content component for desktop
  const SidebarContent = () => {
    return (
      <div className="flex h-full flex-col">
        {/* Logo and title */}
        <Link
          href="/"
          className="mx-4 flex h-10 items-center gap-2 xl:mx-0 xl:justify-center"
        >
          <LogoIcon className="h-6.25 w-6 min-w-6" />
          <span className="inline-block font-sans text-xs leading-tight font-bold tracking-tight uppercase xl:hidden">
            Dwarves
            <br />
            Memo
          </span>
        </Link>

        {/* Navigation items */}
        <nav className="flex flex-1 flex-col gap-1.5 p-4 xl:items-center xl:px-2">
          {navLinks.map((item, index) => (
            <TooltipProvider key={item.url} skipDelayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={item.url}
                    className={cn(
                      'hover:bg-muted dark:hover:bg-muted flex items-center rounded-lg text-sm font-medium transition-colors md:justify-start',
                      {
                        'text-primary': isActiveUrl(item.url),
                      },
                    )}
                    id={`sidebar-item-${index}`}
                  >
                    <div className="p-2">
                      {item.Icon && <item.Icon className="h-5 w-5" />}
                    </div>
                    <span className="ml-3 inline-block xl:hidden">
                      {item.title}
                    </span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="hidden xl:inline-block">
                  {item.title}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </nav>

        {/* Theme toggle */}
        <div className="mx-4 border-t pt-1 xl:mx-2">
          <div className="flex items-center justify-between p-2 xl:justify-center">
            <button
              className="flex cursor-pointer items-center justify-center hover:opacity-80"
              onClick={toggleTheme}
            >
              {isDark ? (
                <SunIcon width={16} height={16} />
              ) : (
                <MoonIcon width={16} height={16} />
              )}
            </button>
            <span className="inline-block flex-1 shrink-0 text-sm leading-6 font-medium xl:hidden">
              {isDark ? 'Light mode' : 'Night mode'}
            </span>
            <button
              className={cn(
                'bg-border flex h-5 w-9 cursor-pointer items-center justify-center rounded-full py-0.5 pr-4.5 pl-0.5 hover:opacity-95',
                {
                  'pr-0.5 pl-4.5': isDark,
                },
                'xl:hidden',
              )}
              onClick={toggleTheme}
            >
              <div className="border-border text-foreground-light rounded-full border bg-white p-0.5">
                {isDark ? (
                  <SunIcon width={16} height={16} />
                ) : (
                  <MoonIcon width={16} height={16} />
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Drawer */}
      <MobileDrawer
        directoryTree={directoryTree}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        handleKeyDown={handleKeyDown}
        navLinks={navLinks}
        isActiveUrl={isActiveUrl}
        toggleTheme={toggleTheme}
        isDark={isDark}
      />

      {/* Desktop Sidebar */}
      <div
        ref={sidebarRef}
        tabIndex={0}
        className={cn(
          'sidebar bg-background border-border w-sidebar fixed top-0 left-0 z-40 hidden h-full flex-col border-r pt-2.5 pb-12 font-sans transition-transform duration-300 ease-in-out outline-none xl:flex xl:translate-x-0',
        )}
        onKeyDown={handleKeyDown}
        role="navigation"
      >
        <SidebarContent />
      </div>
    </>
  );
};

export default Sidebar;
