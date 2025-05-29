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
import { Drawer, DrawerContent } from '../ui/drawer';
import SunIcon from '../icons/SunIcon';
import MoonIcon from '../icons/MoonIcon';
import { useThemeContext } from '@/contexts/theme';
import { cn } from '@/lib/utils';
import { MemoIcons } from '../icons';

const navLinks = [
  { title: 'Home', url: '/', Icon: MemoIcons.home },
  {
    title: 'Consulting',
    url: '/consulting',
    Icon: MemoIcons.consulting,
  },
  { title: 'Earn', url: '/earn', Icon: MemoIcons.earn },
  { title: 'Hiring', url: '/careers', Icon: MemoIcons.careers },
  { title: 'Changelog', url: '/changelog', Icon: MemoIcons.updates },
  { title: 'OGIFs', url: '/updates/ogif', Icon: MemoIcons.ogif },
  { title: 'Prompts', url: '/prompts', Icon: MemoIcons.prompts },
];

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const Sidebar = ({ isOpen, setIsOpen }: SidebarProps) => {
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
    const exactMatch = navLinks.find(link => link.url === router.asPath);
    if (exactMatch) return router.asPath === url;
    const allMatchUrls = navLinks
      .filter(link => router.asPath.startsWith(link.url))
      .map(link => link.url);
    const longestMatch = allMatchUrls.reduce(
      (a, b) => (a.length > b.length ? a : b),
      '', // Add initial value to prevent error when array is empty
    );
    if (longestMatch === '/' && router.asPath !== '/') return false;
    return longestMatch === url;
  };

  // Sidebar content component to reuse for both desktop and mobile
  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex h-full flex-col">
      {/* Logo and title */}
      <Link
        href="/"
        className={cn(
          'flex h-10 items-center gap-2 px-2',
          isMobile ? 'mx-4' : 'mx-4 xl:mx-0 xl:justify-center',
        )}
      >
        <LogoIcon className="h-6.25 w-6 min-w-6" />
        <span
          className={cn(
            'inline-block font-sans text-xs leading-tight font-bold tracking-tight uppercase',
            isMobile ? '' : 'xl:hidden',
          )}
        >
          Dwarves
          <br />
          Memo
        </span>
      </Link>

      {/* Navigation items */}
      <nav
        className={cn(
          'flex flex-1 flex-col gap-1.5 p-4',
          isMobile ? '' : 'xl:items-center xl:px-2',
        )}
      >
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
                  onClick={() => isMobile && setIsOpen(false)}
                >
                  <div className="p-2">
                    {item.Icon && <item.Icon className="h-5 w-5" />}
                  </div>
                  <span
                    className={cn(
                      'ml-3 inline-block',
                      isMobile ? '' : 'xl:hidden',
                    )}
                  >
                    {item.title}
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className={cn(isMobile ? 'hidden' : 'hidden xl:inline-block')}
              >
                {item.title}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </nav>

      {/* Theme toggle */}
      <div className={cn('border-t pt-1', isMobile ? 'mx-4' : 'mx-4 xl:mx-2')}>
        <div
          className={cn(
            'flex items-center gap-3 p-2',
            isMobile ? 'justify-between' : 'justify-between xl:justify-center',
          )}
        >
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
          <span
            className={cn(
              'inline-block flex-1 shrink-0 text-sm leading-6 font-medium',
              isMobile ? '' : 'xl:hidden',
            )}
          >
            {isDark ? 'Light mode' : 'Night mode'}
          </span>
          <button
            className={cn(
              'bg-border flex h-5 w-9 cursor-pointer items-center justify-center rounded-full py-0.5 pr-4.5 pl-0.5 hover:opacity-95',
              {
                'pr-0.5 pl-4.5': isDark,
              },
              isMobile ? '' : 'xl:hidden',
            )}
            onClick={toggleTheme}
          >
            <div className="text-foreground-light border-border rounded-full border bg-white p-0.5">
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

  return (
    <>
      {/* Mobile Drawer */}
      <Drawer open={isOpen} onOpenChange={setIsOpen} direction="left">
        <DrawerContent
          className="w-sidebar-mobile h-full rounded-none border-t-0 border-r border-b-0 border-l-0 pt-6 pb-6 font-sans xl:hidden"
          style={{ boxShadow: '2px 0 16px rgba(0, 0, 0, 0.08)' }}
          onKeyDown={handleKeyDown}
          role="navigation"
        >
          <SidebarContent isMobile={true} />
        </DrawerContent>
      </Drawer>

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
        <SidebarContent isMobile={false} />
      </div>
    </>
  );
};

export default Sidebar;
