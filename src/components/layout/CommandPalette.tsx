import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { createPortal } from 'react-dom';
import Image from 'next/image';

interface SearchResult {
  title: string;
  description?: string;
  url: string;
  category?: string;
  matchingText?: string;
  file_path?: string;
  spr_content?: string;
}

interface RecentPage {
  title: string;
  path: string;
}

// Mock recent pages for now - in a real implementation, you'd fetch these
const mockRecentPages: RecentPage[] = [
  { title: 'Getting Started', path: '/handbook/getting-started' },
  { title: 'How We Work', path: '/handbook/how-we-work' },
  { title: 'Engineering Ladder', path: '/handbook/engineering-ladder' },
];

const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [groupedResults, setGroupedResults] = useState<
    Record<string, SearchResult[]>
  >({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedSection, setSelectedSection] = useState<
    'recents' | 'welcome' | 'suggestions' | 'search'
  >('recents');
  const [selectedRecent, setSelectedRecent] = useState<RecentPage | null>(
    mockRecentPages[0] || null,
  );
  const [selectedWelcomeItem, setSelectedWelcomeItem] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Open/close the command palette
  const toggleCommandPalette = useCallback(() => {
    const newIsOpen = !isOpen;

    setIsOpen(newIsOpen);
    setQuery('');
    setResults([]);
    setGroupedResults({});

    if (newIsOpen) {
      // Opening command palette - just add the class to body
      document.body.classList.add('cmd-palette-open');

      // Set initial selection
      if (mockRecentPages.length > 0) {
        setSelectedRecent(mockRecentPages[0]);
        setSelectedSection('recents');
      } else {
        setSelectedSection('welcome');
        setSelectedWelcomeItem(0);
      }
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
    if (query.length > 0 && results.length > 0) {
      // Handle search results
      const selected = results[selectedIndex];
      if (selected && selected.url) {
        router.push(selected.url);
        close();
      }
    } else if (selectedSection === 'recents' && selectedRecent) {
      // Navigate to recent page
      router.push(selectedRecent.path);
      close();
    } else if (selectedSection === 'welcome') {
      // Handle welcome section actions
      if (selectedWelcomeItem === 0) {
        // What's been hot lately
        router.push('/');
        close();
      } else {
        // Check pinned note - in real implementation, fetch this data
        router.push('/');
        close();
      }
    } else if (selectedSection === 'suggestions') {
      // Copy memo content functionality
      const memoContent = document.querySelector('.memo-content');
      let content = 'No content found';
      if (memoContent) {
        content = memoContent.innerText
          .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace 3+ newlines with 2
          .trim();
      }
      navigator.clipboard.writeText(content);
      // In a real implementation, show a toast notification here
      close();
    }
  }, [
    query,
    results,
    selectedIndex,
    selectedSection,
    selectedRecent,
    selectedWelcomeItem,
    router,
    close,
  ]);

  // Navigate through results with arrow keys
  const navigateNext = useCallback(() => {
    if (query.length > 0 && results.length > 0) {
      setSelectedIndex(prev => (prev + 1) % results.length);
      setSelectedSection('search');
    } else if (selectedSection === 'recents') {
      const currentIndex = mockRecentPages.findIndex(p => p === selectedRecent);
      const nextIndex = currentIndex + 1;

      if (nextIndex >= mockRecentPages.length) {
        // Move to welcome section
        setSelectedSection('welcome');
        setSelectedWelcomeItem(0);
      } else {
        // Next recent item
        setSelectedRecent(mockRecentPages[nextIndex]);
      }
    } else if (selectedSection === 'welcome') {
      const nextItem = selectedWelcomeItem + 1;
      if (nextItem >= 2) {
        // 2 welcome items
        // Move to suggestions section
        setSelectedSection('suggestions');
      } else {
        setSelectedWelcomeItem(nextItem);
      }
    } else if (selectedSection === 'suggestions') {
      // Only one suggestion item, go back to recents
      if (mockRecentPages.length > 0) {
        setSelectedSection('recents');
        setSelectedRecent(mockRecentPages[0]);
      } else {
        // No recents, go to welcome
        setSelectedSection('welcome');
        setSelectedWelcomeItem(0);
      }
    }
  }, [
    query,
    results.length,
    selectedSection,
    selectedRecent,
    selectedWelcomeItem,
  ]);

  const navigatePrev = useCallback(() => {
    if (query.length > 0 && results.length > 0) {
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
      setSelectedSection('search');
    } else if (selectedSection === 'recents') {
      const currentIndex = mockRecentPages.findIndex(p => p === selectedRecent);
      const prevIndex = currentIndex - 1;

      if (prevIndex < 0) {
        // Move to suggestions section
        setSelectedSection('suggestions');
      } else {
        // Previous recent item
        setSelectedRecent(mockRecentPages[prevIndex]);
      }
    } else if (selectedSection === 'welcome') {
      const prevItem = selectedWelcomeItem - 1;
      if (prevItem < 0) {
        // Move to recents section if available
        if (mockRecentPages.length > 0) {
          setSelectedSection('recents');
          setSelectedRecent(mockRecentPages[mockRecentPages.length - 1]);
        } else {
          // No recents, wrap to suggestions
          setSelectedSection('suggestions');
        }
      } else {
        setSelectedWelcomeItem(prevItem);
      }
    } else if (selectedSection === 'suggestions') {
      // Move to welcome section
      setSelectedSection('welcome');
      setSelectedWelcomeItem(1); // Last welcome item
    }
  }, [
    query,
    results.length,
    selectedSection,
    selectedRecent,
    selectedWelcomeItem,
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

      // Arrow down to navigate results
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateNext();
      }

      // Arrow up to navigate results
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
    results,
    selectedIndex,
    selectedSection,
    selectedRecent,
    selectedWelcomeItem,
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
  const performSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setGroupedResults({});
      return;
    }

    // Mock data for demo
    const mockResults: SearchResult[] = [
      {
        title: 'Getting Started',
        description: 'Learn how to get started with Dwarves Memo',
        url: '/handbook/getting-started',
        category: 'Handbook',
        matchingText:
          'This handbook explains how to get started with Dwarves Memo',
        file_path: 'handbook/getting-started.md',
      },
      {
        title: 'Engineering Ladder',
        description: 'The engineering career ladder at Dwarves',
        url: '/handbook/engineering-ladder',
        category: 'Handbook',
        matchingText: 'Our engineering ladder defines career growth',
        file_path: 'handbook/engineering-ladder.md',
      },
      {
        title: 'How We Work',
        description: 'Our working process and methodology',
        url: '/handbook/how-we-work',
        category: 'Handbook',
        matchingText: 'Learn about our process and methodology',
        file_path: 'handbook/how-we-work.md',
      },
      {
        title: 'Technical Writer Position',
        description: 'Open position for a technical writer',
        url: '/careers/open-positions/technical-writer',
        category: 'Careers',
        matchingText: 'We are looking for a technical writer to join our team',
        file_path: 'careers/open-positions/technical-writer.md',
      },
    ].filter(
      item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.matchingText?.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    // Group results by category
    const grouped = mockResults.reduce<Record<string, SearchResult[]>>(
      (acc, result) => {
        const category = result.category || 'Other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(result);
        return acc;
      },
      {},
    );

    setResults(mockResults);
    setGroupedResults(grouped);
    setSelectedIndex(0);
    setSelectedSection('search');
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="command-palette relative z-50">
      {/* Search button */}
      <button
        className="border-border dark:border-border hover:border-primary bg-muted hidden h-10 w-40 items-center justify-between rounded-md border px-3 text-sm transition-colors md:flex lg:w-52"
        onClick={toggleCommandPalette}
        aria-label="Open command palette"
      >
        <div className="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 16 16"
            fill="none"
            className="text-muted-foreground mr-2"
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
          <span className="text-muted-foreground">Search...</span>
        </div>
        <div className="text-muted-foreground flex items-center text-xs">
          <kbd className="bg-background rounded border px-1.5 py-0.5">
            ⌘/Ctrl
          </kbd>
          <span className="mx-0.5">+</span>
          <kbd className="bg-background rounded border px-1.5 py-0.5">K</kbd>
        </div>
      </button>

      {/* Mobile search button */}
      <button
        className="text-foreground flex h-10 w-10 items-center justify-center border-none bg-transparent p-0 md:hidden"
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
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div
              ref={searchContainerRef}
              className="dark:bg-background border-border w-full max-w-2xl overflow-hidden rounded-lg border bg-white shadow-lg"
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

              <div className="max-h-[60vh] overflow-y-auto">
                {/* Search results */}
                {query && Object.keys(groupedResults).length > 0 && (
                  <div className="p-2">
                    {Object.entries(groupedResults).map(
                      ([category, categoryResults]) => (
                        <div key={category}>
                          <div className="text-muted-foreground bg-muted px-2 py-1.5 text-xs font-medium">
                            {category}
                          </div>
                          {categoryResults.map(result => {
                            const resultIndex = results.findIndex(
                              r => r.file_path === result.file_path,
                            );
                            const isSelected =
                              resultIndex === selectedIndex &&
                              selectedSection === 'search';
                            return (
                              <button
                                key={result.file_path}
                                className={`border-border flex w-full flex-col rounded-md border-b px-2 py-2 text-left text-sm last:border-b-0 ${
                                  isSelected
                                    ? 'bg-primary text-white'
                                    : 'hover:bg-muted'
                                }`}
                                onClick={() => {
                                  router.push(result.url);
                                  close();
                                }}
                              >
                                <div className="font-medium">
                                  {result.title}
                                </div>
                                {result.matchingText && (
                                  <div
                                    className={`mt-1 truncate text-xs ${isSelected ? 'text-white' : 'text-muted-foreground'}`}
                                  >
                                    {result.matchingText}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ),
                    )}
                  </div>
                )}

                {/* No results state */}
                {query && Object.keys(groupedResults).length === 0 && (
                  <div className="text-muted-foreground flex flex-col items-center p-8 text-center">
                    <Image
                      src="/assets/img/404.png"
                      alt="No results"
                      className="mb-2 w-32 opacity-40 dark:invert"
                      width={128}
                      height={128}
                    />
                    <p>No results found.</p>
                  </div>
                )}

                {/* Recent pages when no query */}
                {!query && mockRecentPages.length > 0 && (
                  <div className="p-2">
                    <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
                      Recents
                    </div>
                    {mockRecentPages.map((page, index) => (
                      <div
                        key={index}
                        className={`flex cursor-pointer items-center rounded-md px-2 py-2 text-sm ${
                          selectedSection === 'recents' &&
                          selectedRecent === page
                            ? 'bg-muted'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => {
                          router.push(page.path);
                          close();
                        }}
                        onMouseEnter={() => {
                          setSelectedSection('recents');
                          setSelectedRecent(page);
                        }}
                        data-recent-id={index}
                      >
                        <div className="cmd-idle-icon bg-primary/10 mr-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
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
                        </div>
                        <div className="flex flex-col">
                          <span className="text-foreground">{page.title}</span>
                          <span className="text-muted-foreground text-xs">
                            {page.path
                              .split('/')
                              .filter(p => p)
                              .join(' > ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Welcome section */}
                {!query && (
                  <div className="p-2">
                    <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
                      Welcome to Dwarves Memo
                    </div>
                    <div
                      className={`flex cursor-pointer items-center rounded-md px-2 py-2 text-sm ${
                        selectedSection === 'welcome' &&
                        selectedWelcomeItem === 0
                          ? 'bg-muted'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => {
                        router.push('/');
                        close();
                      }}
                      onMouseEnter={() => {
                        setSelectedSection('welcome');
                        setSelectedWelcomeItem(0);
                      }}
                      data-welcome-id="0"
                    >
                      <div className="cmd-idle-icon bg-primary/10 mr-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
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
                      </div>
                      <div className="flex flex-col">
                        <span className="text-foreground">
                          What&apos;s been hot lately
                        </span>
                        <span className="text-muted-foreground text-xs">
                          See featured posts
                        </span>
                      </div>
                    </div>

                    <div
                      className={`flex cursor-pointer items-center rounded-md px-2 py-2 text-sm ${
                        selectedSection === 'welcome' &&
                        selectedWelcomeItem === 1
                          ? 'bg-muted'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => {
                        router.push('/');
                        close();
                      }}
                      onMouseEnter={() => {
                        setSelectedSection('welcome');
                        setSelectedWelcomeItem(1);
                      }}
                      data-welcome-id="1"
                    >
                      <div className="cmd-idle-icon bg-primary/10 mr-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
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
                      </div>
                      <div className="flex flex-col">
                        <span className="text-foreground">Pinned note</span>
                        <span className="text-muted-foreground text-xs">
                          View our latest announcement
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions section */}
                {!query && (
                  <div className="p-2">
                    <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
                      Actions
                    </div>
                    <div
                      className={`flex cursor-pointer items-center rounded-md px-2 py-2 text-sm ${
                        selectedSection === 'suggestions'
                          ? 'bg-muted'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => {
                        const memoContent =
                          document.querySelector('.memo-content');
                        let content = 'No content found';
                        if (memoContent) {
                          content = memoContent.innerText
                            .replace(/\n\s*\n\s*\n/g, '\n\n')
                            .trim();
                        }
                        navigator.clipboard.writeText(content);
                        // In a real implementation, show a toast notification here
                        close();
                      }}
                      onMouseEnter={() => {
                        setSelectedSection('suggestions');
                      }}
                      data-suggestion-id="0"
                    >
                      <div className="cmd-idle-icon bg-primary/10 mr-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
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
                          <rect
                            x="8"
                            y="2"
                            width="8"
                            height="4"
                            rx="1"
                            ry="1"
                          ></rect>
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-foreground">
                          Copy memo content
                        </span>
                      </div>
                    </div>
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
