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
import { useLayoutContext } from '@/contexts/layout';

const navLinks = [
  { title: 'Home', url: '/', Icon: MemoIcons.home },
  {
    title: 'Consulting',
    url: '/consulting',
    Icon: MemoIcons.consulting,
  },
  { title: 'Handbook', url: '/handbook', Icon: MemoIcons.handbook },
  { title: 'Playbook', url: '/playbook', Icon: MemoIcons.playbook },
  // { title: 'Earn', url: '/earn', Icon: MemoIcons.earn },
  { title: 'Hiring', url: '/careers', Icon: MemoIcons.careers },
  { title: 'Changelog', url: '/changelog', Icon: MemoIcons.updates },
  { title: 'Contributor', url: '/contributor', Icon: MemoIcons.playground },
  // { title: 'OGIFs', url: '/updates/ogif', Icon: MemoIcons.ogif },
  { title: 'Prompts', url: '/prompts', Icon: MemoIcons.prompts },
];

interface SidebarProps {
  directoryTree?: Record<string, ITreeNode>;
}

const Sidebar = ({ directoryTree }: SidebarProps) => {
  const router = useRouter();
  const { isDark, toggleTheme } = useThemeContext();
  const { isOpenSidebar, setIsOpenSidebar } = useLayoutContext();
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close sidebar when changing routes
  useEffect(() => {
    const handleRouteChange = () => {
      setIsOpenSidebar(false);
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router, setIsOpenSidebar]);

  // Focus sidebar when opened (desktop only)
  useEffect(() => {
    // Only focus on desktop devices
    if (
      isOpenSidebar &&
      sidebarRef.current &&
      typeof window !== 'undefined' &&
      window.innerWidth >= 768 // adjust breakpoint as needed
    ) {
      sidebarRef.current.focus();
    }
  }, [isOpenSidebar]);

  // Close mobile drawer when switching to desktop screen size
  useEffect(() => {
    const handleResize = () => {
      if (
        typeof window !== 'undefined' &&
        window.innerWidth >= 1280 &&
        isOpenSidebar
      ) {
        setIsOpenSidebar(false); // Close mobile drawer when switching to desktop (xl: 1280px+)
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpenSidebar, setIsOpenSidebar]);

  // Close on Esc key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      setIsOpenSidebar(false);
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
        isOpen={isOpenSidebar}
        setIsOpen={setIsOpenSidebar}
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
