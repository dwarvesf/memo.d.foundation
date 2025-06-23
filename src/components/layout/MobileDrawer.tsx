import React from 'react';
import { Drawer, DrawerContent } from '../ui/drawer';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ChevronRightIcon, FolderTreeIcon, BookmarkIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tab';
import { ITreeNode } from '@/types';

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
  directoryTree?: Record<string, ITreeNode>;
}

const MobileDrawer = ({
  isOpen,
  setIsOpen,
  handleKeyDown,
  navLinks,
  isActiveUrl,
  toggleTheme,
  isDark,
  directoryTree,
}: MobileDrawerProps) => {
  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen} direction="bottom">
      <DrawerContent
        hideHandle
        className={cn('h-full', 'flex flex-col')}
        onKeyDown={handleKeyDown}
        role="navigation"
      >
        <div className="flex h-full flex-col">
          <Tabs defaultValue="main" className="flex h-full flex-col !p-0">
            <TabsList className="grid !h-10 w-full grid-cols-2 !overflow-hidden !rounded-none !rounded-t-xl !border-none !p-0">
              <TabsTrigger
                className="!h-10 !rounded-none !shadow-none"
                value="main"
              >
                <BookmarkIcon className="mr-2 h-4 w-4" /> Home
              </TabsTrigger>
              <TabsTrigger
                className="!h-10 !rounded-none !shadow-none"
                value="tree"
              >
                <FolderTreeIcon className="mr-2 h-4 w-4" /> All pages
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="main"
              className="flex flex-1 flex-col overflow-y-auto"
            >
              {/* Navigation items */}
              <nav className="flex flex-1 flex-col gap-1.5 p-4">
                {navLinks.map((item, index) => (
                  <Link
                    key={item.url}
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
                ))}
              </nav>
            </TabsContent>
            <TabsContent
              value="tree"
              className="flex flex-1 flex-col overflow-y-auto p-4"
            >
              {/* Tree directory content will go here */}
              <pre>{JSON.stringify(directoryTree, null, 2)}</pre>
            </TabsContent>
          </Tabs>

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
