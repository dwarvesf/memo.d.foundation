import React from 'react';
import { Drawer, DrawerContent } from '../ui/drawer';
import Link from 'next/link';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { cn } from '@/lib/utils';
import { ChevronRightIcon } from 'lucide-react';

interface NavLink {
  title: string;
  url: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

interface MobileDrawerProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  navLinks: NavLink[];
  isActiveUrl: (url: string) => boolean;
  toggleTheme: () => void;
  isDark: boolean;
}

const MobileDrawer = ({
  isOpen,
  setIsOpen,
  handleKeyDown,
  navLinks,
  isActiveUrl,
  toggleTheme,
  isDark,
}: MobileDrawerProps) => {
  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen} direction="bottom">
      <DrawerContent
        className={cn(
          'h-full',
          'flex flex-col', // Added for vertical layout
        )}
        style={{ boxShadow: '2px 0 16px rgba(0, 0, 0, 0.08)' }}
        onKeyDown={handleKeyDown}
        role="navigation"
      >
        <div className="flex h-full flex-col">
          {/* Navigation items */}
          <nav className="flex flex-1 flex-col gap-1.5 p-4">
            {navLinks.map((item, index) => (
              <TooltipProvider key={item.url} skipDelayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.url}
                      className={cn(
                        'hover:bg-muted dark:hover:bg-muted flex items-center justify-start rounded-lg text-sm font-medium transition-colors',
                        'justify-between px-2 py-2', // Mobile specific styling
                        {
                          'text-primary': isActiveUrl(item.url),
                        },
                      )}
                      id={`sidebar-item-${index}`}
                      onClick={() => setIsOpen(false)}
                    >
                      <div className="flex items-center">
                        {item.Icon && <item.Icon className="h-5 w-5" />}
                        <span className="ml-3 inline-block">{item.title}</span>
                      </div>
                      <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="hidden">
                    {item.title}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </nav>

          {/* Theme toggle and Close Menu */}
          <div className="mx-4 space-y-2 border-t pt-4 pb-4">
            <div className="flex flex-col gap-2">
              <button
                className="bg-muted flex h-10 items-center justify-center rounded-lg border text-sm font-medium"
                onClick={toggleTheme}
              >
                {isDark ? 'Turn Light Mode On' : 'Turn Dark Mode On'}
              </button>
              <button
                className="hover:bg-muted flex h-10 items-center justify-center rounded-lg text-sm font-medium"
                onClick={() => setIsOpen(false)}
              >
                Close Menu
              </button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MobileDrawer;
