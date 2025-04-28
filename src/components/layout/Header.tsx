import React from 'react';
import Link from 'next/link';
import CommandPalette from './CommandPalette';
import LogoIcon from '../icons/LogoIcon';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import HeaderUser from './HeaderUser';
import { useLayoutContext } from '@/contexts/layout';

interface HeaderProps {
  toggleSidebar: () => void;
  toggleTheme: () => void;
  toggleReadingMode: () => void;
  theme: 'light' | 'dark';
  readingMode: boolean;
}

const Header: React.FC<HeaderProps> = ({
  toggleSidebar,
  toggleReadingMode,
  readingMode,
}) => {
  const { isMacOS } = useLayoutContext();
  const modifier = isMacOS ? '⌘' : 'Ctrl';
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 top-0 w-full shrink-0 font-sans backdrop-blur">
      <div className="mx-auto flex h-full items-center justify-between border-b p-2 xl:border-none xl:px-5">
        <div className="flex items-center gap-2.5">
          {/* Mobile sidebar toggle button */}
          <button
            id="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
            className="flex h-10 w-10 cursor-pointer items-center justify-center focus:outline-none xl:hidden"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-current"
            >
              <path
                d="M4 6H20M4 12H20M4 18H20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Logo (shown on mobile) */}
          <Link href="/" className="flex items-center gap-2 xl:hidden">
            <LogoIcon className="h-[32px] w-[29px] min-w-6 shrink-0"></LogoIcon>
            <span className="font-ibm-sans text-xs text-[11px] leading-[14.849px] font-bold -tracking-[0.157px] uppercase">
              Dwarves
              <br />
              Memo
            </span>
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-3.5">
          {/* Command palette */}
          <CommandPalette />
          {/* Reading mode toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="hidden cursor-pointer items-center justify-center border-0 bg-transparent outline-none hover:opacity-95 active:opacity-100 xl:flex"
                  onClick={toggleReadingMode}
                  aria-label="Toggle reading mode"
                  data-reading-mode={readingMode ? 'true' : 'false'}
                >
                  <svg
                    width="48"
                    height="28"
                    viewBox="0 0 62 34"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-7 w-12 xl:w-14"
                  >
                    <g>
                      <rect
                        width="62"
                        height="34"
                        rx="17"
                        className="fill-border dark:fill-border"
                      />
                      <g
                        className={`transition-transform duration-150 ease-in-out ${readingMode ? 'translate-x-[45%]' : 'translate-x-0'}`}
                      >
                        <circle
                          cx="17"
                          cy="17"
                          r="14"
                          className={
                            readingMode ? 'fill-[#23252c]' : 'fill-white'
                          }
                        />
                        <path
                          d="M17 23.898V18.3265C17 17.9747 17.1398 17.6373 17.3885 17.3885C17.6373 17.1398 17.9747 17 18.3265 17C18.6783 17 19.0158 17.1398 19.2645 17.3885C19.5133 17.6373 19.6531 17.9747 19.6531 18.3265V21.2449H21.7755C22.3384 21.2449 22.8782 21.4685 23.2763 21.8666C23.6744 22.2646 23.898 22.8045 23.898 23.3673V23.898"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={
                            readingMode ? 'stroke-white' : 'stroke-[#333639]'
                          }
                        />
                        <path
                          d="M16.2119 12.8561C14.8891 11.4004 13.114 10.4334 11.1736 10.1113C11.0416 10.0926 10.9071 10.1022 10.7791 10.1395C10.6511 10.1768 10.5324 10.2409 10.4311 10.3275C10.3279 10.4158 10.245 10.5253 10.1883 10.6487C10.1315 10.772 10.1021 10.9062 10.1021 11.0419V18.6088C10.1007 18.8411 10.1854 19.0658 10.3399 19.2394C10.4944 19.413 10.7077 19.5232 10.9386 19.5487C12.4542 19.7543 13.8794 20.354 15.0774 21.276"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={
                            readingMode ? 'stroke-white' : 'stroke-[#333639]'
                          }
                        />
                        <path
                          d="M16.2124 15.7885V12.8561"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={
                            readingMode ? 'stroke-white' : 'stroke-[#333639]'
                          }
                        />
                        <path
                          d="M21.4852 19.5487C21.7161 19.5232 21.9295 19.413 22.084 19.2394C22.2385 19.0658 22.3232 18.8411 22.3218 18.6088V11.0419C22.3218 10.9062 22.2924 10.772 22.2356 10.6487C22.1788 10.5253 22.096 10.4158 21.9928 10.3275C21.8915 10.2409 21.7728 10.1768 21.6447 10.1395C21.5167 10.1022 21.3823 10.0926 21.2502 10.1113C19.3098 10.4334 17.5347 11.4004 16.2119 12.8561"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={
                            readingMode ? 'stroke-white' : 'stroke-[#333639]'
                          }
                        />
                      </g>
                    </g>
                  </svg>
                </button>
              </TooltipTrigger>
              <TooltipContent
                className="!bg-secondary !text-secondary-foreground rounded-lg p-2 text-center text-xs font-medium shadow-md"
                arrowClassName="!bg-secondary !fill-secondary"
              >
                <span className="!text-foreground-dark">Reading Mode</span>
                <div className="mt-1 flex items-center gap-0.5 text-[8px]">
                  <kbd className="bg-muted flex items-center justify-center rounded border px-1 py-0.5">
                    {modifier}
                  </kbd>
                  <span>+</span>
                  <kbd className="bg-muted flex items-center justify-center rounded border px-1 py-0.5">
                    Shift
                  </kbd>
                  <span>+</span>
                  <kbd className="bg-muted flex items-center justify-center rounded border px-1 py-0.5">
                    F
                  </kbd>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <HeaderUser />
        </div>
      </div>
    </header>
  );
};

export default Header;
