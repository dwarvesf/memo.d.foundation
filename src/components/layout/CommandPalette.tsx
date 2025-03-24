import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';

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
  const [groupedResults, setGroupedResults] = useState<Record<string, SearchResult[]>>({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedSection, setSelectedSection] = useState<'recents' | 'welcome' | 'suggestions' | 'search'>('recents');
  const [selectedRecent, setSelectedRecent] = useState<RecentPage | null>(mockRecentPages[0] || null);
  const [selectedWelcomeItem, setSelectedWelcomeItem] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Open/close the command palette
  const toggleCommandPalette = useCallback(() => {
    // Save scroll position before opening
    const scrollY = window.scrollY;

    setIsOpen(!isOpen);
    setQuery('');
    setResults([]);
    setGroupedResults({});

    if (!isOpen) {
      // Opening command palette
      document.body.classList.add('cmd-palette-open');
      document.body.style.top = `-${scrollY}px`;
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';

      // Set initial selection
      if (mockRecentPages.length > 0) {
        setSelectedRecent(mockRecentPages[0]);
        setSelectedSection('recents');
      } else {
        setSelectedSection('welcome');
        setSelectedWelcomeItem(0);
      }
    } else {
      // Closing command palette
      document.body.classList.remove('cmd-palette-open');
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      // Restore scroll position
      window.scrollTo(0, scrollY);
    }
  }, [isOpen]);

  // Close the palette
  const close = () => {
    setIsOpen(false);
    setQuery('');
    document.body.classList.remove('cmd-palette-open');
  };

  // Navigate to the selected item
  const goto = () => {
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
  };

  // Navigate through results with arrow keys
  const navigateNext = () => {
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
      if (nextItem >= 2) { // 2 welcome items
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
  };

  const navigatePrev = () => {
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
  };

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
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, results, selectedIndex, selectedSection, selectedRecent, selectedWelcomeItem, router, toggleCommandPalette]);

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
        matchingText: 'This handbook explains how to get started with Dwarves Memo',
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
    ].filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.matchingText?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Group results by category
    const grouped = mockResults.reduce<Record<string, SearchResult[]>>((acc, result) => {
      const category = result.category || 'Other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(result);
      return acc;
    }, {});

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
        className="hidden md:flex items-center justify-between w-40 lg:w-52 h-10 px-3 text-sm border border-border dark:border-border rounded-md hover:border-primary transition-colors bg-muted"
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
            className="mr-2 text-muted-foreground"
            aria-hidden="true"
          >
            <circle cx="6.88881" cy="6.8889" r="5.55556" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11.3333 11.3333L14.6666 14.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-muted-foreground">Search...</span>
        </div>
        <div className="flex items-center text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 bg-background border rounded">
            ⌘/Ctrl
          </kbd>
          <span className="mx-0.5">+</span>
          <kbd className="px-1.5 py-0.5 bg-background border rounded">K</kbd>
        </div>
      </button>

      {/* Mobile search button */}
      <button
        className="md:hidden flex items-center justify-center w-10 h-10 p-0 border-none bg-transparent text-foreground"
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
          <circle cx="6.88881" cy="6.8889" r="5.55556" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M11.3333 11.3333L14.6666 14.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Command palette modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/50 backdrop-blur-sm">
          <div
            ref={searchContainerRef}
            className="relative z-10 w-full max-w-2xl rounded-lg bg-white dark:bg-background border border-border shadow-lg overflow-hidden"
          >
            {/* Search input */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center">
                <svg
                  className="mr-2 text-muted-foreground"
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
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search documentation..."
                  className="flex-1 bg-transparent border-none outline-none text-foreground"
                />
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {/* Search results */}
              {query && Object.keys(groupedResults).length > 0 && (
                <div className="p-2">
                  {Object.entries(groupedResults).map(([category, categoryResults]) => (
                    <div key={category}>
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-muted">
                        {category}
                      </div>
                      {categoryResults.map((result, index) => {
                        const resultIndex = results.findIndex(r => r.file_path === result.file_path);
                        const isSelected = resultIndex === selectedIndex && selectedSection === 'search';
                        return (
                          <button
                            key={result.file_path}
                            className={`w-full flex flex-col px-2 py-2 text-sm rounded-md text-left border-b border-border last:border-b-0 ${
                              isSelected ? 'bg-primary text-white' : 'hover:bg-muted'
                            }`}
                            onClick={() => {
                              router.push(result.url);
                              close();
                            }}
                          >
                            <div className="font-medium">{result.title}</div>
                            {result.matchingText && (
                              <div className={`text-xs truncate mt-1 ${isSelected ? 'text-white' : 'text-muted-foreground'}`}>
                                {result.matchingText}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {/* No results state */}
              {query && Object.keys(groupedResults).length === 0 && (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                  <img
                    src="/img/404.png"
                    alt="No results"
                    className="w-32 opacity-40 dark:invert mb-2"
                  />
                  <p>No results found.</p>
                </div>
              )}

              {/* Recent pages when no query */}
              {!query && mockRecentPages.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Recents
                  </div>
                  {mockRecentPages.map((page, index) => (
                    <div
                      key={index}
                      className={`flex items-center px-2 py-2 text-sm rounded-md cursor-pointer ${
                        selectedSection === 'recents' && selectedRecent === page
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
                      <div className="cmd-idle-icon mr-3 flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
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
                        <span className="text-xs text-muted-foreground">
                          {page.path.split('/').filter(p => p).join(' > ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Welcome section */}
              {!query && (
                <div className="p-2">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Welcome to Dwarves Memo
                  </div>
                  <div
                    className={`flex items-center px-2 py-2 text-sm rounded-md cursor-pointer ${
                      selectedSection === 'welcome' && selectedWelcomeItem === 0
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
                    <div className="cmd-idle-icon mr-3 flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
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
                      <span className="text-foreground">What's been hot lately</span>
                      <span className="text-xs text-muted-foreground">
                        See featured posts
                      </span>
                    </div>
                  </div>

                  <div
                    className={`flex items-center px-2 py-2 text-sm rounded-md cursor-pointer ${
                      selectedSection === 'welcome' && selectedWelcomeItem === 1
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
                    <div className="cmd-idle-icon mr-3 flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
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
                      <span className="text-xs text-muted-foreground">
                        View our latest announcement
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions section */}
              {!query && (
                <div className="p-2">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Actions
                  </div>
                  <div
                    className={`flex items-center px-2 py-2 text-sm rounded-md cursor-pointer ${
                      selectedSection === 'suggestions' ? 'bg-muted' : 'hover:bg-muted'
                    }`}
                    onClick={() => {
                      const memoContent = document.querySelector('.memo-content');
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
                    <div className="cmd-idle-icon mr-3 flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
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
                    </div>
                    <div className="flex flex-col">
                      <span className="text-foreground">Copy memo content</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with keyboard shortcuts */}
            <div className="p-2 border-t border-border text-xs text-muted-foreground flex justify-between">
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
                  <kbd className="px-1 py-0.5 bg-muted border rounded mr-1">↵</kbd>
                  to select
                </div>
              </div>
              <div className="flex items-center">
                <kbd className="px-1 py-0.5 bg-muted border rounded mr-1">Esc</kbd>
                to close
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommandPalette;
