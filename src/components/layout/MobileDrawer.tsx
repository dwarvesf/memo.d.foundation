import React, { useState, useRef } from 'react';
import { Drawer, DrawerContent } from '../ui/drawer';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  ChevronRightIcon,
  FolderTreeIcon,
  BookmarkIcon,
  ArrowLeftIcon,
  FileTextIcon,
  FolderIcon,
} from 'lucide-react';
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

interface DirectoryTreeMenuProps {
  nodes: Record<string, ITreeNode>;
  onSelectNode: (node: ITreeNode) => void;
  onSelectLink: () => void;
}

const DirectoryTreeMenu: React.FC<DirectoryTreeMenuProps> = ({
  nodes,
  onSelectNode,
  onSelectLink,
}) => {
  const sortedNodes = Object.values(nodes).sort((a, b) => {
    const aIsFolder = a.children && Object.keys(a.children).length > 0;
    const bIsFolder = b.children && Object.keys(b.children).length > 0;

    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;
    return a.label.localeCompare(b.label);
  });

  return (
    <nav className="flex flex-1 flex-col gap-1.5 p-4">
      {sortedNodes.map(node => {
        const hasChildren =
          node.children && Object.keys(node.children).length > 0;
        const isLink = node.url && !hasChildren;

        if (isLink) {
          return (
            <Link
              key={node.url}
              href={node.url!}
              className={cn(
                'hover:bg-muted dark:hover:bg-muted flex items-center justify-start rounded-lg text-sm transition-colors',
                'justify-between px-2 py-1.5',
              )}
              onClick={onSelectLink}
            >
              <div className="flex items-center">
                <FileTextIcon className="text-muted-foreground h-4 w-4 flex-none" />
                <span className="ml-3 inline-block">{node.label}</span>
              </div>
            </Link>
          );
        } else if (hasChildren) {
          return (
            <button
              key={node.label}
              onClick={() => onSelectNode(node)}
              className={cn(
                'hover:bg-muted dark:hover:bg-muted flex items-center justify-start rounded-lg text-sm transition-colors',
                'w-full justify-between px-2 py-1.5',
              )}
            >
              <div className="flex items-center">
                <FolderIcon className="text-muted-foreground h-4 w-4 flex-none" />
                <span className="ml-3 inline-block">{node.label}</span>
              </div>
              <ChevronRightIcon className="h-4 w-4 text-gray-400" />
            </button>
          );
        }
        return null;
      })}
    </nav>
  );
};

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
  const [currentTreeLevel, setCurrentTreeLevel] = useState<
    Record<string, ITreeNode> | undefined
  >(directoryTree);
  const navigationStack = useRef<Record<string, ITreeNode>[]>([]);
  const [currentTitle, setCurrentTitle] = useState<string>('./');

  React.useEffect(() => {
    if (isOpen) {
      setCurrentTreeLevel(directoryTree);
      navigationStack.current = [];
      setCurrentTitle('./');
    }
  }, [isOpen, directoryTree]);

  const handleSelectNode = (node: ITreeNode) => {
    if (node.children) {
      navigationStack.current.push(currentTreeLevel!);
      setCurrentTreeLevel(node.children);
      setCurrentTitle(node.label);
    }
  };

  const handleBack = () => {
    if (navigationStack.current.length > 0) {
      const previousLevel = navigationStack.current.pop();
      setCurrentTreeLevel(previousLevel);
      setCurrentTitle(
        navigationStack.current.length === 0
          ? './'
          : Object.values(previousLevel!)[0]?.label || './',
      );
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen} direction="bottom">
      <DrawerContent
        hideHandle
        className={cn('h-full', 'flex flex-col')}
        onKeyDown={handleKeyDown}
        role="navigation"
      >
        <div className="flex h-full flex-col justify-between">
          <Tabs
            defaultValue="main"
            className="flex max-h-[calc(100%-120px)] flex-1 flex-col !p-0"
          >
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
                      {item.Icon && <item.Icon className="bg-muted h-4 w-4" />}
                      <span className="ml-3 inline-block">{item.title}</span>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 flex-none text-gray-400" />
                  </Link>
                ))}
              </nav>
            </TabsContent>
            <TabsContent
              value="tree"
              className="m-0 flex flex-1 flex-col overflow-y-auto py-0"
            >
              {/* Tree directory content */}
              <div className="mx-4 flex items-center border-b py-3">
                {navigationStack.current.length > 0 && (
                  <button
                    onClick={handleBack}
                    className="hover:bg-muted mr-2 rounded-md p-0"
                  >
                    <ArrowLeftIcon className="bg-muted h-4 w-4 flex-none" />
                  </button>
                )}
                <h3 className="font-sans !text-sm font-medium">
                  {currentTitle}
                </h3>
              </div>
              {currentTreeLevel && (
                <div className="flex-1 overflow-y-auto">
                  <DirectoryTreeMenu
                    nodes={currentTreeLevel}
                    onSelectNode={handleSelectNode}
                    onSelectLink={() => setIsOpen(false)}
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Theme toggle and Close Menu */}
          <div className="mx-4 flex-none space-y-2 border-t pt-4 pb-4">
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
