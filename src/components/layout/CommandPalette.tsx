import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useRouter } from 'next/router';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useSearch } from '../search';
import { cn, groupBy } from '@/lib/utils';
import { SearchResult } from '../search/SearchProvider';
import { toast } from 'sonner';
import { useDebouncedCallback } from 'use-debounce';
interface IRecentPageStorageItem {
  path: string;
  title: string;
  timestamp: number;
}
interface ISearchResultItem {
  id: string;
  title: string;
  description: string;
  path: string;
  category: string;
  icon?: React.ReactNode;
  action?: string;
  index?: number;
}

const defaultSearchResult: SearchResult = {
  flat: [],
  grouped: {},
};

const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult>(defaultSearchResult);
  const [recentPages, setRecentPages] = useState<IRecentPageStorageItem[]>([]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isMacOS, setIsMacOS] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { search } = useSearch();

  const defaultResult = useMemo(() => {
    return getDefaultSearchResult(recentPages);
  }, [recentPages]);

  // Open/close the command palette
  const toggleCommandPalette = useCallback(() => {
    const newIsOpen = !isOpen;

    setIsOpen(newIsOpen);
    setQuery('');
    setResult(defaultSearchResult);

    if (newIsOpen) {
      // Opening command palette - just add the class to body
      document.body.classList.add('cmd-palette-open');
    } else {
      // Closing command palette - simply remove the class
      document.body.classList.remove('cmd-palette-open');
    }
  }, [isOpen]);

  // Close the palette
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    document.body.classList.remove('cmd-palette-open');
    // Make sure we delay focus restoration to avoid scroll position jumps
    setTimeout(() => {
      document.body.focus();
    }, 50);
  }, []);

  // Navigate to the selected item
  const goto = useCallback(() => {
    if (query) {
      const selected = result.grouped[selectedCategory]?.[selectedIndex];
      if (selected && selected.file_path) {
        router.push(selected.file_path.toLowerCase().replace(/\.md$/, ''));
        close();
      }
      return;
    }
    // If no query, navigate to the default result
    const selected = defaultResult.grouped[selectedCategory]?.[selectedIndex];
    if (selected && selected.path) {
      if (selected.action === 'copy') {
        const memoContent = document.querySelector(
          '.memo-content',
        ) as HTMLElement;
        let content = 'No content found';
        if (memoContent) {
          content =
            memoContent.textContent ||
            memoContent.innerHTML ||
            ''.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
        }
        navigator.clipboard.writeText(content);
        toast.success('Copied memo content!');
        close();
      } else {
        router.push(selected.path);
        close();
      }
    }
  }, [query, result.flat, selectedIndex, router, close]);

  const scrollResultIntoView = useCallback((id?: string) => {
    if (!id) {
      return;
    }
    const selectedElement = document.getElementById(
      `result-${id}`,
    ) as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, []);

  // Navigate through result.flat with arrow keys
  const navigateNext = useCallback(() => {
    const data = query ? result.grouped : defaultResult.grouped;
    const categories = Object.keys(data);
    const currentCategory = categories.includes(selectedCategory)
      ? selectedCategory
      : categories[0];
    if (selectedIndex + 1 < data[currentCategory]?.length) {
      setSelectedIndex(selectedIndex + 1);
      scrollResultIntoView(data[currentCategory][selectedIndex + 1]?.id);
      return;
    }

    let currentCategoryIndex = categories.indexOf(currentCategory);
    if (currentCategoryIndex === -1) {
      currentCategoryIndex = 0;
    }
    const nextCategoryIndex = (currentCategoryIndex + 1) % categories.length;
    const nextCategory = categories[nextCategoryIndex];
    setSelectedCategory(nextCategory);
    setSelectedIndex(0);
    scrollResultIntoView(data[nextCategory][0]?.id);
  }, [
    query,
    defaultResult,
    result.flat.length,
    selectedIndex,
    selectedCategory,
  ]);

  const navigatePrev = useCallback(() => {
    const data = query ? result.grouped : defaultResult.grouped;
    const categories = Object.keys(data);
    const currentCategory = categories.includes(selectedCategory)
      ? selectedCategory
      : categories[0];

    if (selectedIndex - 1 >= 0) {
      setSelectedIndex(selectedIndex - 1);
      scrollResultIntoView(data[currentCategory][selectedIndex - 1]?.id);

      return;
    }
    let currentCategoryIndex = categories.indexOf(currentCategory);
    if (currentCategoryIndex === -1) {
      currentCategoryIndex = 0;
    }
    const prevCategoryIndex =
      (currentCategoryIndex - 1 + categories.length) % categories.length;
    const prevCategory = categories[prevCategoryIndex];
    setSelectedCategory(prevCategory);
    setSelectedIndex(data[prevCategory].length - 1);
    scrollResultIntoView(data[prevCategory][data[prevCategory].length - 1]?.id);
  }, [
    query,
    defaultResult,
    result.flat.length,
    selectedIndex,
    selectedCategory,
  ]);

  // Handle keyboard shortcuts and navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command/Ctrl + K to toggle palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }

      // Only process other keyboard events if palette is open
      if (!isOpen) return;

      // Escape to close
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }

      // Arrow down to navigate result.flat
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateNext();
      }

      // Arrow up to navigate result.flat
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigatePrev();
      }

      // Enter to select
      if (e.key === 'Enter') {
        e.preventDefault();
        goto();
      }
    };

    // Close when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [
    isOpen,
    result.flat,
    selectedIndex,
    router,
    toggleCommandPalette,
    goto,
    navigateNext,
    navigatePrev,
    close,
  ]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 10);
    }
  }, [isOpen]);

  // Mock search function - replace with actual search implementation
  const performSearch = useDebouncedCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResult(defaultSearchResult);
      return;
    }

    const result = await search({ query: searchQuery });
    setResult(result);
    setSelectedIndex(0);
    setSelectedCategory(result.flat[0]?.category || '');
  }, 300);

  // Debounced search
  useEffect(() => {
    performSearch(query);
  }, [query, performSearch]);

  // Load recent pages from localStorage
  useEffect(() => {
    const storedRecents = localStorage.getItem('recentPages');
    // Record current page visit
    const currentPath = router.asPath;
    const currentTitle = document.title;
    const isSkip = currentPath !== '/' && currentPath !== '/index.html';
    const timestamp = new Date().getTime();

    // Get current page info and strip redundant title parts if present
    let pageTitle = currentTitle;
    if (pageTitle.includes(' | ')) {
      pageTitle = pageTitle.split(' | ')[0].trim();
    }

    const currentPage: IRecentPageStorageItem = {
      path: currentPath,
      title: pageTitle,
      timestamp: timestamp,
    };

    if (storedRecents) {
      try {
        const parsed = JSON.parse(storedRecents);
        setRecentPages(parsed);

        // Skip recording if this is the home page
        if (isSkip) {
          // Remove current page if it exists already (to avoid duplicates)
          let newRecentPages = recentPages.filter(
            page => page.path !== currentPath,
          );

          // Add current page to the beginning
          newRecentPages.unshift(currentPage);

          // Keep only the last 10 pages
          if (recentPages.length > 10) {
            newRecentPages = recentPages.slice(0, 10);
          }

          // Store back to localStorage
          localStorage.setItem('recentPages', JSON.stringify(newRecentPages));
          return;
        }
        return;
      } catch (e) {
        console.error('Error parsing recent pages', e);
      }
    } else {
      // If no recent pages, create an array
      const initialRecentPages: IRecentPageStorageItem[] = [currentPage];
      localStorage.setItem('recentPages', JSON.stringify(initialRecentPages));
    }
  }, [router.asPath]);

  useEffect(() => {
    setIsMacOS(window.navigator.userAgent.includes('Macintosh'));
  }, []);

  const modifier = isMacOS ? '⌘' : 'ctrl';
  const selectedItem = result.grouped[selectedCategory]?.[selectedIndex];
  return (
    <div className="command-palette relative z-50">
      {/* Search button */}
      <button
        className="hidden w-50 cursor-pointer justify-between rounded-md border bg-transparent px-3 py-1.5 transition-all duration-100 ease-in-out hover:shadow-md lg:flex"
        onClick={toggleCommandPalette}
        aria-label="Open command palette"
      >
        <div className="flex items-center gap-0.5">
          <span className="text-muted-foreground text-sm filter-[opacity(50%)]">
            🔍 Search...
          </span>
        </div>
        <div className="text-muted-foreground flex items-center gap-0.5 text-xs">
          <kbd
            className="bg-background rounded border px-1.5 py-0.5"
            suppressHydrationWarning
          >
            {modifier}
          </kbd>
          <kbd className="bg-background rounded border px-1.5 py-0.5">K</kbd>
        </div>
      </button>

      {/* Mobile search button */}
      <button
        className="text-foreground flex h-10 w-10 items-center justify-center border-none bg-transparent p-0 lg:hidden"
        onClick={toggleCommandPalette}
        aria-label="Open search"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 16 16"
          fill="none"
          className="text-foreground"
          aria-hidden="true"
        >
          <circle
            cx="6.88881"
            cy="6.8889"
            r="5.55556"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M11.3333 11.3333L14.6666 14.6667"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Command palette modal */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div
              ref={searchContainerRef}
              className="dark:bg-background mt-[10vh] w-full max-w-[800px] overflow-hidden rounded-lg bg-white shadow-lg"
              style={{ animation: 'fadeIn 0.15s ease-out' }}
            >
              {/* Search input */}
              <div className="border-border border-b p-4">
                <div className="flex items-center">
                  <svg
                    className="text-muted-foreground mr-2"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search documentation..."
                    className="text-foreground flex-1 border-none bg-transparent outline-none"
                  />
                </div>
              </div>

              <div className="flex max-h-[70vh]">
                <div className="flex flex-1 basis-2/5 flex-col overflow-y-auto">
                  {/* Search result.flat */}
                  {query && Object.keys(result.grouped).length > 0 && (
                    <div>
                      {Object.entries(result.grouped).map(
                        ([category, categoryResults]) => (
                          <div key={category} className="flex flex-col">
                            <div className="bg-border px-3 py-1.5 text-xs font-medium capitalize">
                              {category}
                            </div>
                            {categoryResults.map((result, index) => {
                              const isSelected =
                                (selectedCategory === category ||
                                  (index === 0 && !selectedCategory)) &&
                                index === selectedIndex;
                              return (
                                <button
                                  id={`result-${result.id}`}
                                  key={result.file_path}
                                  className={cn(
                                    'border-border group flex w-full flex-col border-b px-4 py-2.5 text-left text-sm last:border-b-0',
                                    {
                                      'bg-primary text-primary-foreground':
                                        isSelected,
                                    },
                                  )}
                                  onClick={() => {
                                    goto();
                                    close();
                                  }}
                                  onMouseEnter={() => {
                                    setSelectedIndex(index);
                                    setSelectedCategory(category);
                                  }}
                                >
                                  <div className="font-medium">
                                    {result.title}
                                  </div>
                                  {result.matchingLines && (
                                    <div
                                      className={cn(
                                        'text-muted-foreground [&_span]:text-primary mt-1 line-clamp-2 text-xs [&_span]:underline',
                                        {
                                          'text-secondary-dark [&_span]:text-white':
                                            isSelected,
                                        },
                                      )}
                                      dangerouslySetInnerHTML={{
                                        __html: result.matchingLines,
                                      }}
                                    ></div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ),
                      )}
                    </div>
                  )}

                  {/* No result.flat state */}
                  {query && Object.keys(result.grouped).length === 0 && (
                    <div className="text-muted-foreground flex flex-col items-center p-8 text-center">
                      <Image
                        src="/assets/img/404.png"
                        alt="No result.flat"
                        className="mb-2 w-32 opacity-40 dark:invert"
                        width={128}
                        height={128}
                      />
                      <p>No result found.</p>
                    </div>
                  )}

                  {!query &&
                    Object.entries(defaultResult.grouped).map(
                      ([category, categoryResults]) => (
                        <div className="my-4 px-3" key={category}>
                          <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
                            {category}
                          </div>
                          <div className="space-y-0.5">
                            {categoryResults.map((result, index) => {
                              const isSelected =
                                (selectedCategory === category ||
                                  (index === 0 && !selectedCategory)) &&
                                index === selectedIndex;
                              return (
                                <div
                                  id={`result-${result.id}`}
                                  key={result.title}
                                  className={cn(
                                    `hover:bg-muted hover:bg-muted flex cursor-pointer items-center rounded-md px-2 py-2 text-sm`,
                                    {
                                      'bg-muted': isSelected,
                                    },
                                  )}
                                  onClick={e => {
                                    e.preventDefault();
                                    goto();
                                  }}
                                  onMouseEnter={() => {
                                    setSelectedIndex(index);
                                    setSelectedCategory(category);
                                  }}
                                  data-suggestion-id="0"
                                >
                                  <div className="cmd-idle-icon bg-primary/10 mr-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                                    {result.icon}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-foreground">
                                      {result.title}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                      {result.description}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ),
                    )}
                </div>
                {query && !!result.flat.length && (
                  <div
                    className={cn(
                      'flex-1 basis-3/5 shadow-[inset_1px_1px_2px_rgba(147,149,159,.24),inset_2px_2px_8px_rgba(147,149,159,.1)]',
                      'bg-background-secondary hidden flex-col items-center overflow-y-auto border-l px-9 py-6 md:flex',
                    )}
                  >
                    <div className="h-9 w-9">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                      >
                        <g fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M4.125 3C3.089 3 2.25 3.84 2.25 4.875V18a3 3 0 0 0 3 3h15a3 3 0 0 1-3-3V4.875C17.25 3.839 16.41 3 15.375 3zM12 9.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5zm-.75-2.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H12a.75.75 0 0 1-.75-.75M6 12.75a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5zm-.75 3.75a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75M6 6.75a.75.75 0 0 0-.75.75v3c0 .414.336.75.75.75h3a.75.75 0 0 0 .75-.75v-3A.75.75 0 0 0 9 6.75z"
                            clipRule="evenodd"
                          />
                          <path d="M18.75 6.75h1.875c.621 0 1.125.504 1.125 1.125V18a1.5 1.5 0 0 1-3 0z" />
                        </g>
                      </svg>
                    </div>

                    {selectedItem && (
                      <>
                        {/* Category/Path */}
                        <span className="mt-3.5 text-center text-xs">
                          {selectedItem.category}
                        </span>

                        {/* Title */}
                        <h3 className="m-0 mt-2 text-center font-serif text-2xl leading-tight font-medium">
                          {selectedItem.title}
                        </h3>

                        {/* Description */}
                        <p className="mt-3.5 w-full font-serif text-sm font-medium">
                          {selectedItem.description}
                        </p>

                        {/* Content preview */}
                        {selectedItem.spr_content && (
                          <div className="text-secondary-light dark:text-secondary-dark mt-8 self-start font-serif">
                            <span className="text-xs font-medium uppercase underline">
                              on this page
                            </span>
                            <div
                              className="mt-5 text-xs whitespace-pre-wrap [&_hr]:my-2.5"
                              dangerouslySetInnerHTML={{
                                __html: selectedItem.spr_content,
                              }}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Footer with keyboard shortcuts */}
              <div className="border-border text-muted-foreground flex justify-between border-t p-2 text-xs">
                <div className="flex space-x-4">
                  <div className="flex items-center">
                    <svg
                      className="mr-1"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="18 15 12 9 6 15"></polyline>
                    </svg>
                    <svg
                      className="mr-1"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                    to navigate
                  </div>
                  <div className="flex items-center">
                    <kbd className="bg-muted mr-1 rounded border px-1 py-0.5">
                      ↵
                    </kbd>
                    to select
                  </div>
                </div>
                <div className="flex items-center">
                  <kbd className="bg-muted mr-1 rounded border px-1 py-0.5">
                    Esc
                  </kbd>
                  to close
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default CommandPalette;

function HotIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="stroke-primary"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

function BookOpenIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="stroke-primary"
    >
      <path d="M12 7v14" />
      <path d="M16 12h2" />
      <path d="M16 8h2" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
      <path d="M6 12h2" />
      <path d="M6 8h2" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="stroke-primary"
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
    </svg>
  );
}
function PinIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="stroke-primary"
    >
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}

function getDefaultSearchResult(recentPages: IRecentPageStorageItem[]) {
  const flat: ISearchResultItem[] = [
    ...recentPages.map(page => ({
      id: page.path,
      title: page.title,
      description: page.path.split('/').filter(Boolean).join(' > '),
      category: 'Recents',
      path: page.path,
      icon: <BookOpenIcon />,
    })),
    {
      id: 'hot',
      title: 'What’s been hot lately',
      description: 'See featured posts',
      category: 'Welcome to Dwarves Memo',
      icon: <HotIcon />,
      path: '/',
    },
    {
      id: 'pinned',
      title: 'Pinned note',
      description: 'View our latest announcement',
      category: 'Welcome to Dwarves Memo',
      icon: <PinIcon />,
      path: '/',
    },
    {
      id: 'copy',
      title: 'Copy memo content',
      description: 'Copy memo content to clipboard',
      category: 'Actions',
      icon: <CopyIcon />,
      action: 'copy',
      path: 'copy',
    },
  ].map((item, index) => ({
    ...item,
    index,
  }));

  return {
    flat: flat,
    grouped: groupBy(flat, 'category'),
  };
}
