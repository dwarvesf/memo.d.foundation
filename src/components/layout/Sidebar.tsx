import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import LogoIcon from '../icons/LogoIcon';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import SunIcon from '../icons/SunIcon';
import MoonIcon from '../icons/MoonIcon';
import { useThemeContext } from '@/contexts/theme';
import { cn } from '@/lib/utils';

// Define navigation links
const navLinks = [
  { title: 'Home', url: '/', icon: '/assets/img/home.svg' },
  {
    title: 'Consulting',
    url: '/consulting',
    icon: '/assets/img/consulting.svg',
  },
  { title: 'Earn', url: '/earn', icon: '/assets/img/earn.svg' },
  { title: 'Hiring', url: '/careers/hiring', icon: '/assets/img/hiring.svg' },
  { title: 'Digest', url: '/updates/digest', icon: '/assets/img/digest.svg' },
  { title: 'OGIFs', url: '/updates/ogif', icon: '/assets/img/ogifs.svg' },
];

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const Sidebar = ({ isOpen, setIsOpen }: SidebarProps) => {
  const router = useRouter();
  const { isDark, toggleTheme } = useThemeContext();
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

  // Check if current path matches link
  const isActiveUrl = (url: string) => {
    const exactMatch = navLinks.find(link => link.url === router.asPath);
    if (exactMatch) return router.asPath === url;
    const allMatchUrls = navLinks
      .filter(link => router.asPath.startsWith(link.url))
      .map(link => link.url);
    const longestMatch = allMatchUrls.reduce((a, b) =>
      a.length > b.length ? a : b,
    );
    if (longestMatch === '/' && router.asPath !== '/') return false;
    return longestMatch === url;
  };

  // Close sidebar when clicking outside on mobile
  const handleClickOutside = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Sidebar overlay - only shown on mobile when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`bg-background border-border fixed top-0 left-0 z-40 flex h-full w-[var(--nav-sidebar-width)] flex-col border-r pt-4 pb-12 font-sans transition-transform duration-300 ease-in-out xl:w-[72px] ${isOpen ? 'translate-x-0' : 'translate-x-[-100%] xl:translate-x-0'} `}
        onClick={e => e.target === e.currentTarget && handleClickOutside()}
      >
        {/* Logo and title */}
        <Link
          href="/"
          className="mx-4 flex h-10 items-center gap-2 px-2 md:justify-start"
        >
          <LogoIcon className="h-6.25 w-6 min-w-6"></LogoIcon>
          <span className="inline-block font-sans text-xs leading-tight font-bold tracking-tight uppercase xl:hidden">
            Dwarves
            <br />
            Memo
          </span>
        </Link>

        {/* Navigation items */}
        <nav className="flex flex-1 flex-col p-4">
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
                      <div
                        className="h-6 w-6"
                        style={{
                          maskImage: `url('${item.icon}')`,
                          WebkitMaskImage: `url('${item.icon}')`,
                          backgroundColor: 'currentColor',
                          maskRepeat: 'no-repeat',
                          WebkitMaskRepeat: 'no-repeat',
                          maskSize: 'contain',
                          WebkitMaskSize: 'contain',
                          maskPosition: 'center',
                          WebkitMaskPosition: 'center',
                        }}
                      ></div>
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

        <div className="mx-4 border-t pt-1">
          <div className="flex items-center justify-between gap-3 p-2">
            <button
              className="flex cursor-pointer items-center justify-center hover:opacity-80"
              onClick={toggleTheme}
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <span className="inline-block flex-1 shrink-0 text-sm leading-6 font-medium xl:hidden">
              {isDark ? 'Light mode' : 'Night mode'}
            </span>
            <button
              className={cn(
                'bg-border flex h-5 w-9 cursor-pointer items-center justify-center rounded-full py-0.5 pr-4.5 pl-0.5 hover:opacity-95 xl:hidden',
                {
                  'pr-0.5 pl-4.5': isDark,
                },
              )}
              onClick={toggleTheme}
            >
              <div className="text-foreground: dark:text-primary-foreground rounded-full bg-white p-0.5">
                {isDark ? (
                  <SunIcon width={12} height={12} />
                ) : (
                  <MoonIcon width={12} height={12} />
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
