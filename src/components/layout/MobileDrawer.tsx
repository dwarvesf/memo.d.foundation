import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { Drawer, DrawerContent } from '../ui/drawer';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  FolderTreeIcon,
  BookmarkIcon,
  FilePenIcon,
  FolderIcon,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tab';
import { ITreeNode } from '@/types';
import { useRouter } from 'next/router';
import { MemoIcons } from '../icons';

interface NavLink {
  title: string;
  url: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  description?: string;
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
  isActiveUrl: (url: string) => boolean;
  autoScrollRef: React.RefObject<HTMLAnchorElement | null>;
}

const DirectoryTreeMenu: React.FC<DirectoryTreeMenuProps> = ({
  nodes,
  onSelectNode,
  onSelectLink,
  isActiveUrl,
  autoScrollRef,
}) => {
  const sortedNodes = Object.values(nodes).sort((a, b) => {
    const aIsFolder = a.children && Object.keys(a.children).length > 0;
    const bIsFolder = b.children && Object.keys(b.children).length > 0;

    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;
    return a.label.localeCompare(b.label);
  });

  return (
    <nav className="flex flex-1 flex-col px-5">
      {sortedNodes.map(node => {
        const hasChildren =
          node.children && Object.keys(node.children).length > 0;
        const isLink = node.url && !hasChildren;

        if (isLink) {
          const isActive = isActiveUrl(node.url!);
          return (
            <Link
              key={node.url}
              href={node.url!}
              className={cn(
                'flex items-center justify-start text-sm transition-colors',
                'justify-between px-2 py-2',
                {
                  'text-primary': isActive,
                },
              )}
              onClick={onSelectLink}
              data-path={node.url}
              ref={isActive ? autoScrollRef : null}
            >
              <div className="flex items-center">
                <div
                  className={cn(
                    'mr-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md',
                    {
                      'bg-primary/10': isActive,
                      'bg-muted/50': !isActive,
                    },
                  )}
                >
                  <FilePenIcon
                    className={cn('h-4 w-4', {
                      'text-muted-foreground': !isActive,
                      'text-primary': isActive,
                    })}
                  />
                </div>
                <span className="inline-block font-normal">{node.label}</span>
              </div>
            </Link>
          );
        } else if (hasChildren) {
          return (
            <button
              key={node.label}
              onClick={() => onSelectNode(node)}
              className={cn(
                'flex items-center justify-start text-sm transition-colors',
                'w-full justify-between px-2 py-2',
              )}
            >
              <div className="flex items-center">
                <div className="bg-primary/10 mr-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md">
                  <FolderIcon className="text-primary h-4 w-4" />
                </div>
                <span className="inline-block font-normal">{node.label}</span>
              </div>
            </button>
          );
        }
        return null;
      })}
    </nav>
  );
};

const DEFAULT_ROOT = '__ROOT__';

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
  const router = useRouter();
  const isInitializedRef = useRef(false);
  const autoScrollRef = useRef<HTMLAnchorElement>(null);

  const [currentTreeLevel, setCurrentTreeLevel] = useState<
    Record<string, ITreeNode> | undefined
  >(directoryTree);
  const navigationStack = useRef<
    { level: Record<string, ITreeNode>; title: string }[]
  >([]);
  const [currentTitle, setCurrentTitle] = useState<string>(DEFAULT_ROOT);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<
    'forward' | 'backward'
  >('forward');
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mobileDrawerTab') || 'main';
    }
    return 'main';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mobileDrawerTab', activeTab);
    }
  }, [activeTab]);

  // Memoize expensive tree traversal functions
  const findPathInTree = useCallback(
    (
      nodes: Record<string, ITreeNode>,
      targetPath: string,
      parentPaths: ITreeNode[] = [],
    ): { pathSegments: ITreeNode[]; leafNode: ITreeNode } | null => {
      for (const node of Object.values(nodes)) {
        if (node.url === targetPath) {
          return { pathSegments: [...parentPaths, node], leafNode: node };
        }

        if (node.children && Object.keys(node.children).length > 0) {
          const result = findPathInTree(node.children, targetPath, [
            ...parentPaths,
            node,
          ]);
          if (result) return result;
        }
      }
      return null;
    },
    [],
  );

  const findFolderByPath = useCallback(
    (
      nodes: Record<string, ITreeNode>,
      targetPathSegments: string[],
      currentSegmentIndex: number = 0,
      parentPaths: ITreeNode[] = [],
    ): { pathSegments: ITreeNode[]; folderNode: ITreeNode } | null => {
      if (currentSegmentIndex >= targetPathSegments.length) {
        return null; // Path segments exhausted, no folder found
      }

      const segmentLabel = targetPathSegments[currentSegmentIndex];

      for (const node of Object.values(nodes)) {
        if (node.label === segmentLabel) {
          const newParentPaths = [...parentPaths, node];
          if (currentSegmentIndex === targetPathSegments.length - 1) {
            // This is the last segment, check if it's a folder
            if (node.children && Object.keys(node.children).length > 0) {
              return { pathSegments: newParentPaths, folderNode: node };
            }
          } else if (node.children && Object.keys(node.children).length > 0) {
            // Not the last segment, but it's a folder, continue searching in children
            const result = findFolderByPath(
              node.children,
              targetPathSegments,
              currentSegmentIndex + 1,
              newParentPaths,
            );
            if (result) return result;
          }
        }
      }
      return null;
    },
    [],
  );

  // Memoize current path processing
  const currentPath = useMemo(() => {
    const path = router.asPath.endsWith('/')
      ? router.asPath.slice(0, -1)
      : router.asPath;
    return path;
  }, [router.asPath]);

  // Debounce and optimize the heavy tree processing
  useEffect(() => {
    // Only run when drawer is actually opened and we have a directory tree
    if (!directoryTree || !isOpen) return;

    // Use requestAnimationFrame to defer heavy computation
    const timeoutId = setTimeout(() => {
      const pathResult = findPathInTree(directoryTree, currentPath);

      if (pathResult) {
        // Case 1: A node with a URL matching the current path was found
        const { pathSegments, leafNode } = pathResult;

        const newNavigationStack: {
          level: Record<string, ITreeNode>;
          title: string;
        }[] = [];
        let tempCurrentTreeLevel: Record<string, ITreeNode> | undefined =
          directoryTree;
        let tempCurrentTitle: string = DEFAULT_ROOT;

        const leafNodeHasChildren =
          leafNode.children && Object.keys(leafNode.children).length > 0;

        if (leafNodeHasChildren) {
          // If the matched node is a folder (has children), navigate into it.
          // The navigation stack should include all parents up to this folder.
          for (let i = 0; i < pathSegments.length; i++) {
            const segment = pathSegments[i];
            newNavigationStack.push({
              level: tempCurrentTreeLevel!,
              title: tempCurrentTitle,
            });
            tempCurrentTreeLevel = segment.children;
            tempCurrentTitle = segment.label;
          }
        } else {
          // If the matched node is a file (no children), navigate to its parent's level.
          // The navigation stack should include all parents up to the parent of the leaf node.
          for (let i = 0; i < pathSegments.length - 1; i++) {
            const segment = pathSegments[i];
            newNavigationStack.push({
              level: tempCurrentTreeLevel!,
              title: tempCurrentTitle,
            });
            tempCurrentTreeLevel = segment.children;
            tempCurrentTitle = segment.label;
          }
        }

        setCurrentTreeLevel(tempCurrentTreeLevel);
        navigationStack.current = newNavigationStack;
        setCurrentTitle(tempCurrentTitle);

        // Auto-scroll the active link into view (only for actual links/files)
        if (autoScrollRef.current) {
          const scrollTimeout = setTimeout(() => {
            if (autoScrollRef.current) {
              let block: ScrollLogicalPosition = 'nearest';
              if (
                !isInitializedRef.current &&
                !checkInView(autoScrollRef.current)
              ) {
                block = 'center';
              }
              autoScrollRef.current.scrollIntoView({
                behavior: 'smooth',
                block,
                inline: 'start',
              });
            }
            isInitializedRef.current = true;
          }, 100); // Reduced from 500ms to 100ms

          return () => clearTimeout(scrollTimeout);
        }
      } else {
        // Case 2: No node with a URL was found. Check if the path corresponds to a folder node (without a URL).
        const pathSegments = currentPath.split('/').filter(s => s !== '');
        const folderResult = findFolderByPath(directoryTree, pathSegments);

        if (folderResult) {
          const { pathSegments: folderPathSegments } = folderResult;
          const newNavigationStack: {
            level: Record<string, ITreeNode>;
            title: string;
          }[] = [];
          let tempCurrentTreeLevel: Record<string, ITreeNode> | undefined =
            directoryTree;
          let tempCurrentTitle: string = DEFAULT_ROOT;

          // Navigate into the found folder
          for (let i = 0; i < folderPathSegments.length; i++) {
            const segment = folderPathSegments[i];
            newNavigationStack.push({
              level: tempCurrentTreeLevel!,
              title: tempCurrentTitle,
            });
            tempCurrentTreeLevel = segment.children;
            tempCurrentTitle = segment.label;
          }

          setCurrentTreeLevel(tempCurrentTreeLevel);
          navigationStack.current = newNavigationStack;
          setCurrentTitle(tempCurrentTitle);

          // No auto-scroll for folders, as per "only set the active node that contain the node that having no child"
        } else {
          // Case 3: No path found (neither file nor folder), reset to root
          setCurrentTreeLevel(directoryTree);
          navigationStack.current = [];
          setCurrentTitle(DEFAULT_ROOT);
        }
      }
    }, 16); // Use requestAnimationFrame timing (~16ms)

    return () => clearTimeout(timeoutId);
  }, [isOpen, directoryTree, currentPath, findPathInTree, findFolderByPath]);

  // Memoize handlers to prevent recreating on every render
  const handleSelectNode = useCallback(
    (node: ITreeNode) => {
      if (node.children) {
        setIsTransitioning(true);
        setTransitionDirection('forward');

        setTimeout(() => {
          navigationStack.current.push({
            level: currentTreeLevel!,
            title: currentTitle,
          }); // Store current level and its title
          setCurrentTreeLevel(node.children);
          setCurrentTitle(node.label);

          setTimeout(() => {
            setIsTransitioning(false);
          }, 50);
        }, 200);
      }
    },
    [currentTreeLevel, currentTitle],
  );

  // Memoize the click handler to prevent recreating
  const handleNavLinkClick = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  // Memoize navLinks rendering to prevent unnecessary re-renders
  const renderedNavLinks = useMemo(() => {
    return navLinks.map(item => {
      const isActive = isActiveUrl(item.url);
      return (
        <Link
          key={item.url}
          href={item.url}
          className={cn('flex items-center p-2 text-sm', {
            'text-primary': isActive,
          })}
          onClick={handleNavLinkClick}
        >
          {item.Icon && (
            <div className="cmd-idle-icon bg-primary/10 mr-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg">
              <item.Icon className="text-primary h-4 w-4" />
            </div>
          )}
          <div className="flex-1">
            <div className="inline-block">{item.title}</div>
            {item.description && (
              <div
                className={cn('mt-0.5 text-xs', {
                  'text-primary': isActive,
                  'text-muted-foreground': !isActive,
                })}
              >
                {item.description}
              </div>
            )}
          </div>
        </Link>
      );
    });
  }, [navLinks, isActiveUrl, handleNavLinkClick]);

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen} direction="bottom">
      <DrawerContent
        hideHandle
        // height = search command palette height
        className="flex h-full !max-h-[538px] flex-col border"
        onKeyDown={handleKeyDown}
        role="navigation"
        style={{
          background: 'color-mix(in oklab, var(--background) 75%, transparent)',
          WebkitBackdropFilter: 'blur(16px)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex h-full flex-col justify-between">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex max-h-[calc(100%-66px)] flex-1 flex-col"
          >
            <div className="border-b border-[#dbdbdb] p-1 dark:border-[var(--border)]">
              <TabsList className="grid w-full grid-cols-2 !bg-transparent">
                <TabsTrigger className="!shadow-none" value="main">
                  <BookmarkIcon className="mr-2 h-4 w-4" /> Main
                </TabsTrigger>
                <TabsTrigger className="!shadow-none" value="tree">
                  <FolderTreeIcon className="mr-2 h-4 w-4" /> All pages
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent
              value="main"
              className="flex flex-1 flex-col overflow-y-auto"
            >
              {/* Navigation items */}
              <nav className="space-y-1 px-4 py-2">{renderedNavLinks}</nav>
            </TabsContent>
            <TabsContent
              value="tree"
              className="m-0 flex flex-1 flex-col overflow-y-auto"
            >
              <div className="mx-4 flex h-14 items-center">
                <nav className="flex items-center space-x-0.5 text-sm">
                  <button
                    onClick={() => {
                      setIsTransitioning(true);
                      setTransitionDirection('backward');

                      setTimeout(() => {
                        setCurrentTreeLevel(directoryTree);
                        navigationStack.current = [];
                        setCurrentTitle(DEFAULT_ROOT);

                        setTimeout(() => {
                          setIsTransitioning(false);
                        }, 50);
                      }, 200);
                    }}
                    className="text-muted-foreground hover:text-foreground -ml-2 flex min-h-12 items-center justify-center rounded-md px-2 py-2 font-sans font-medium transition-colors"
                  >
                    <MemoIcons.home className="h-4 w-4" />
                  </button>
                  {navigationStack.current
                    .filter(navItem => navItem.title !== DEFAULT_ROOT)
                    .map((navItem, index) => (
                      <React.Fragment key={index}>
                        <span className="text-muted-foreground px-1">/</span>
                        <button
                          onClick={() => {
                            setIsTransitioning(true);
                            setTransitionDirection('backward');

                            setTimeout(() => {
                              // Navigate to this specific level - need to find the original index
                              const originalIndex =
                                navigationStack.current.findIndex(
                                  item => item === navItem,
                                );
                              const newStack = navigationStack.current.slice(
                                0,
                                originalIndex + 1,
                              );
                              const targetState = newStack[newStack.length - 1];
                              navigationStack.current = newStack.slice(0, -1);
                              setCurrentTreeLevel(targetState.level);
                              setCurrentTitle(targetState.title);

                              setTimeout(() => {
                                setIsTransitioning(false);
                              }, 50);
                            }, 200);
                          }}
                          className="text-muted-foreground hover:text-foreground min-h-12 rounded-md px-2 py-2 font-sans font-medium transition-colors"
                        >
                          {navItem.title}
                        </button>
                      </React.Fragment>
                    ))}
                  {navigationStack.current.length > 0 &&
                    currentTitle !== DEFAULT_ROOT && (
                      <>
                        <span className="text-muted-foreground px-1">/</span>
                        <span className="text-foreground flex min-h-12 items-center px-2 py-2 font-sans font-medium">
                          {currentTitle}
                        </span>
                      </>
                    )}
                </nav>
              </div>
              {currentTreeLevel && (
                <div
                  className={`flex-1 overflow-y-auto transition-all duration-300 ease-out ${
                    isTransitioning
                      ? transitionDirection === 'forward'
                        ? 'translate-x-8 transform opacity-0'
                        : '-translate-x-8 transform opacity-0'
                      : 'translate-x-0 transform opacity-100'
                  }`}
                >
                  <DirectoryTreeMenu
                    nodes={currentTreeLevel}
                    onSelectNode={handleSelectNode}
                    onSelectLink={handleNavLinkClick}
                    isActiveUrl={isActiveUrl}
                    autoScrollRef={autoScrollRef}
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Theme toggle and Close Menu */}
          <div className="flex-none space-y-2 border border-t-[#dbdbdb] p-3 dark:border-[var(--border)]">
            <button
              className="bg-muted flex h-10 w-full items-center justify-center rounded-lg border text-sm font-medium"
              onClick={toggleTheme}
            >
              {isDark ? 'Turn Light Mode On' : 'Turn Dark Mode On'}
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MobileDrawer;

function checkInView(element: Element | null) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const inView =
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth);

  return inView;
}
