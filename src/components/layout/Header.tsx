import React from 'react';
import Link from 'next/link';
import CommandPalette from './CommandPalette';

interface HeaderProps {
  toggleSidebar: () => void;
  toggleTheme: () => void;
  toggleReadingMode: () => void;
  theme: 'light' | 'dark';
  readingMode: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  toggleSidebar, 
  toggleTheme, 
  toggleReadingMode,
  theme,
  readingMode
}) => {
  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-[var(--header-height)] font-sans">
      <div className="container-fluid px-4 h-full flex items-center justify-between max-w-[1400px] mx-auto font-sans">
        {/* Mobile sidebar toggle button */}
        <button
          id="sidebar-toggle"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          className="flex items-center justify-center w-10 h-10 md:hidden focus:outline-none"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-current">
            <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Logo (shown on mobile) */}
        <Link href="/" className="md:hidden flex items-center gap-2">
          <svg className="min-w-6 w-6 h-7 shrink-0" width="24" height="24" viewBox="0 0 19 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.41664 20C1.08113 20 0 18.8812 0 17.4991V2.50091C0 1.11883 1.08113 0 2.41664 0L8.46529 0.00731261C13.8427 0.00731261 18.1954 4.55576 18.1248 10.1353C18.0541 15.6271 13.6307 20 8.32397 20H2.41664Z" fill="var(--primary)"/>
            <path d="M3.63209 15.6271H3.32118C3.15159 15.6271 3.01733 15.4881 3.01733 15.3126V12.8044C3.01733 12.6289 3.15159 12.49 3.32118 12.49H5.74488C5.91447 12.49 6.04873 12.6289 6.04873 12.8044V13.1262C6.04873 14.5082 4.9676 15.6271 3.63209 15.6271Z" fill="white"/>
            <path d="M3.32119 8.11701H10.8749C12.2105 8.11701 13.2916 6.99818 13.2916 5.6161V5.31628C13.2916 5.13347 13.1503 4.98721 12.9736 4.98721H5.44105C4.10554 4.98721 3.02441 6.10604 3.02441 7.48813V7.80257C3.02441 7.97807 3.15867 8.11701 3.32119 8.11701Z" fill="white"/>
            <path d="M3.32118 11.8684H7.24998C8.58549 11.8684 9.66661 10.7496 9.66661 9.36747V9.05303C9.66661 8.87753 9.53236 8.73859 9.36277 8.73859H3.32118C3.15159 8.73859 3.01733 8.87753 3.01733 9.05303V11.5539C3.0244 11.7294 3.15866 11.8684 3.32118 11.8684Z" fill="white"/>
          </svg>
          <span className="font-sans text-xs font-bold uppercase leading-tight tracking-tight">
            Dwarves<br/>Memo
          </span>
        </Link>

        <div className="flex items-center gap-2 md:gap-4">
          {/* Command palette */}
          <CommandPalette />

          <div className="h-6 w-px bg-border hidden md:block"></div>

          {/* Reading mode toggle */}
          <button
            className="flex items-center justify-center cursor-pointer bg-transparent border-0 outline-none hover:opacity-95 active:opacity-100 w-12 md:w-14"
            onClick={toggleReadingMode}
            aria-label="Toggle reading mode"
            data-reading-mode={readingMode ? 'true' : 'false'}
          >
            <svg width="48" height="28" viewBox="0 0 62 34" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 w-12 md:w-14">
              <g>
                <rect width="62" height="34" rx="17" className="fill-border dark:fill-border" />
                <g className={`transition-transform duration-150 ease-in-out ${readingMode ? 'translate-x-[45%]' : 'translate-x-0'}`}>
                  <circle cx="17" cy="17" r="14" className={readingMode ? 'fill-[#23252c]' : 'fill-white'} />
                  <path d="M17 23.898V18.3265C17 17.9747 17.1398 17.6373 17.3885 17.3885C17.6373 17.1398 17.9747 17 18.3265 17C18.6783 17 19.0158 17.1398 19.2645 17.3885C19.5133 17.6373 19.6531 17.9747 19.6531 18.3265V21.2449H21.7755C22.3384 21.2449 22.8782 21.4685 23.2763 21.8666C23.6744 22.2646 23.898 22.8045 23.898 23.3673V23.898" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className={readingMode ? 'stroke-white' : 'stroke-[#333639]'}
                  />
                  <path d="M16.2119 12.8561C14.8891 11.4004 13.114 10.4334 11.1736 10.1113C11.0416 10.0926 10.9071 10.1022 10.7791 10.1395C10.6511 10.1768 10.5324 10.2409 10.4311 10.3275C10.3279 10.4158 10.245 10.5253 10.1883 10.6487C10.1315 10.772 10.1021 10.9062 10.1021 11.0419V18.6088C10.1007 18.8411 10.1854 19.0658 10.3399 19.2394C10.4944 19.413 10.7077 19.5232 10.9386 19.5487C12.4542 19.7543 13.8794 20.354 15.0774 21.276" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className={readingMode ? 'stroke-white' : 'stroke-[#333639]'}
                  />
                  <path d="M16.2124 15.7885V12.8561" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className={readingMode ? 'stroke-white' : 'stroke-[#333639]'}
                  />
                  <path d="M21.4852 19.5487C21.7161 19.5232 21.9295 19.413 22.084 19.2394C22.2385 19.0658 22.3232 18.8411 22.3218 18.6088V11.0419C22.3218 10.9062 22.2924 10.772 22.2356 10.6487C22.1788 10.5253 22.096 10.4158 21.9928 10.3275C21.8915 10.2409 21.7728 10.1768 21.6447 10.1395C21.5167 10.1022 21.3823 10.0926 21.2502 10.1113C19.3098 10.4334 17.5347 11.4004 16.2119 12.8561" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className={readingMode ? 'stroke-white' : 'stroke-[#333639]'}
                  />
                </g>
              </g>
            </svg>
          </button>

          <div 
            className="hidden absolute top-14 right-12 bg-secondary text-secondary-foreground font-medium p-2 text-xs rounded-lg shadow-md z-50" 
            role="tooltip"
            id="reading-mode-tooltip"
          >
            <span>Reading Mode</span>
            <div className="mt-1 flex items-center gap-0.5">
              <kbd className="px-1.5 py-0.5 text-xs bg-muted border rounded flex items-center justify-center">⌘/Ctrl</kbd>
              <span>+</span>
              <kbd className="px-1.5 py-0.5 text-xs bg-muted border rounded flex items-center justify-center">Shift</kbd>
              <span>+</span>
              <kbd className="px-1.5 py-0.5 text-xs bg-muted border rounded flex items-center justify-center">F</kbd>
            </div>
            <div className="arrow" data-popper-arrow></div>
          </div>

          {/* Theme toggler */}
          <button
            className="flex items-center justify-center cursor-pointer bg-transparent border-0 w-8 h-8"
            aria-label="Toggle theme"
            onClick={toggleTheme}
            data-theme={theme}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" width="24" height="24" className="text-secondary-foreground">
                <path fill="currentColor"
                  d="M12,9c1.65,0,3,1.35,3,3s-1.35,3-3,3s-3-1.35-3-3S10.35,9,12,9 M12,7c-2.76,0-5,2.24-5,5s2.24,5,5,5s5-2.24,5-5 S14.76,7,12,7L12,7z M2,13l2,0c0.55,0,1-0.45,1-1s-0.45-1-1-1l-2,0c-0.55,0-1,0.45-1,1S1.45,13,2,13z M20,13l2,0c0.55,0,1-0.45,1-1 s-0.45-1-1-1l-2,0c-0.55,0-1,0.45-1,1S19.45,13,20,13z M11,2v2c0,0.55,0.45,1,1,1s1-0.45,1-1V2c0-0.55-0.45-1-1-1S11,1.45,11,2z M11,20v2c0,0.55,0.45,1,1,1s1-0.45,1-1v-2c0-0.55-0.45-1-1-1C11.45,19,11,19.45,11,20z M5.99,4.58c-0.39-0.39-1.03-0.39-1.41,0 c-0.39,0.39-0.39,1.03,0,1.41l1.06,1.06c0.39,0.39,1.03,0.39,1.41,0s0.39-1.03,0-1.41L5.99,4.58z M18.36,16.95 c-0.39-0.39-1.03-0.39-1.41,0c-0.39,0.39-0.39,1.03,0,1.41l1.06,1.06c0.39,0.39,1.03,0.39,1.41,0c0.39-0.39,0.39-1.03,0-1.41 L18.36,16.95z M19.42,5.99c0.39-0.39,0.39-1.03,0-1.41c-0.39-0.39-1.03-0.39-1.41,0l-1.06,1.06c-0.39,0.39-0.39,1.03,0,1.41 s1.03,0.39,1.41,0L19.42,5.99z M7.05,18.36c0.39-0.39,0.39-1.03,0-1.41c-0.39-0.39-1.03-0.39-1.41,0l-1.06,1.06 c-0.39,0.39-0.39,1.03,0,1.41s1.03,0.39,1.41,0L7.05,18.36z">
                </path>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="24" height="24" className="text-current">
                <path fill="currentColor"
                  d="M9.37,5.51C9.19,6.15,9.1,6.82,9.1,7.5c0,4.08,3.32,7.4,7.4,7.4c0.68,0,1.35-0.09,1.99-0.27C17.45,17.19,14.93,19,12,19
                  c-3.86,0-7-3.14-7-7C5,9.07,6.81,6.55,9.37,5.51z M12,3c-4.97,0-9,4.03-9,9s4.03,9,9,9s9-4.03,9-9c0-0.46-0.04-0.92-0.1-1.36
                  c-0.98,1.37-2.58,2.26-4.4,2.26c-2.98,0-5.4-2.42-5.4-5.4c0-1.81,0.89-3.42,2.26-4.4C12.92,3.04,12.46,3,12,3L12,3z">
                </path>
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;