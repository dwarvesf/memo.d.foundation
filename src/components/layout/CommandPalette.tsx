import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

interface SearchResult {
  title: string;
  description?: string;
  url: string;
  category?: string;
  matchingText?: string;
}

// Mock recent pages for now - in a real implementation, you'd fetch these
const mockRecentPages = [
  { title: 'Getting Started', path: '/handbook/getting-started' },
  { title: 'How We Work', path: '/handbook/how-we-work' },
  { title: 'Engineering Ladder', path: '/handbook/engineering-ladder' },
];

const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Open/close the command palette
  const toggleCommandPalette = () => {
    setIsOpen(!isOpen);
    setQuery('');
    setResults([]);
  };

  // Close when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.command-palette-container')) return;
    setIsOpen(false);
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }
      
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
      
      // Arrow down to navigate results
      if (e.key === 'ArrowDown' && isOpen) {
        e.preventDefault();
        setSelectedIndex(prev => 
          results.length ? (prev + 1) % results.length : 0
        );
      }
      
      // Arrow up to navigate results
      if (e.key === 'ArrowUp' && isOpen) {
        e.preventDefault();
        setSelectedIndex(prev => 
          results.length ? (prev - 1 + results.length) % results.length : 0
        );
      }
      
      // Enter to select
      if (e.key === 'Enter' && isOpen && results.length > 0) {
        e.preventDefault();
        const selected = results[selectedIndex];
        if (selected) {
          router.push(selected.url);
          setIsOpen(false);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, results, selectedIndex, router]);
  
  // Focus input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 10);
    }
  }, [isOpen]);
  
  // Mock search function - replace with actual search in a real implementation
  const performSearch = (search: string) => {
    // Mock data for demo purposes
    const mockResults: SearchResult[] = [
      { 
        title: 'Getting Started', 
        description: 'Learn how to get started with Dwarves Memo', 
        url: '/handbook/getting-started',
        category: 'Handbook',
        matchingText: 'This handbook explains how to get started with Dwarves Memo',
      },
      { 
        title: 'Engineering Ladder', 
        description: 'The engineering career ladder at Dwarves', 
        url: '/handbook/engineering-ladder',
        category: 'Handbook',
        matchingText: 'Our engineering ladder defines career growth',
      },
      { 
        title: 'How We Work', 
        description: 'Our working process and methodology', 
        url: '/handbook/how-we-work',
        category: 'Handbook',
        matchingText: 'Learn about our process and methodology',
      },
    ].filter(item => 
      item.title.toLowerCase().includes(search.toLowerCase()) || 
      (item.description?.toLowerCase().includes(search.toLowerCase()))
    );
    
    setResults(mockResults);
    setSelectedIndex(0);
  };
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) {
        performSearch(query);
      } else {
        setResults([]);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [query]);
  
  return (
    <div className="command-palette relative">
      {/* Trigger button */}
      <button 
        className="flex items-center justify-between w-64 h-10 px-3 text-sm rounded-md border hover:border-primary transition-colors"
        style={{ backgroundColor: 'var(--muted)' }}
        onClick={toggleCommandPalette}
      >
        <div className="flex items-center">
          <svg 
            className="mr-2 text-muted-foreground" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <span className="text-muted-foreground">Search...</span>
        </div>
        <div className="flex items-center text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 border rounded" style={{ backgroundColor: 'var(--background)' }}>
            {navigator.platform.indexOf('Mac') === 0 ? '⌘' : 'Ctrl'}
          </kbd>
          <span className="mx-0.5">+</span>
          <kbd className="px-1.5 py-0.5 border rounded" style={{ backgroundColor: 'var(--background)' }}>K</kbd>
        </div>
      </button>
      
      {/* Command palette modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/50">
          <div className="command-palette-container w-full max-w-2xl rounded-lg bg-card border shadow-lg overflow-hidden">
            {/* Search input */}
            <div className="p-4 border-b">
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
                  className="flex-1 bg-transparent border-none outline-none"
                />
              </div>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto">
              {/* Recent pages when no query */}
              {!query && (
                <div className="p-2">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Recent
                  </div>
                  {mockRecentPages.map((page, index) => (
                    <button
                      key={index}
                      className="w-full flex items-center px-2 py-2 text-sm rounded-md hover:bg-muted text-left"
                      onClick={() => {
                        router.push(page.path);
                        setIsOpen(false);
                      }}
                    >
                      <svg 
                        className="mr-2 text-muted-foreground" 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path>
                        <path d="M14 2v4a2 2 0 0 0 2 2h4"></path>
                      </svg>
                      <span>{page.title}</span>
                    </button>
                  ))}
                </div>
              )}
              
              {/* Search results */}
              {query && results.length > 0 && (
                <div className="p-2">
                  {/* Group results by category */}
                  {Object.entries(
                    results.reduce<Record<string, SearchResult[]>>((acc, result) => {
                      const category = result.category || 'Other';
                      if (!acc[category]) acc[category] = [];
                      acc[category].push(result);
                      return acc;
                    }, {})
                  ).map(([category, categoryResults]) => (
                    <div key={category}>
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        {category}
                      </div>
                      {categoryResults.map((result, index) => {
                        const isSelected = results.indexOf(result) === selectedIndex;
                        return (
                          <button
                            key={index}
                            className={`w-full flex flex-col px-2 py-2 text-sm rounded-md hover:bg-muted text-left ${
                              isSelected ? 'bg-muted' : ''
                            }`}
                            onClick={() => {
                              router.push(result.url);
                              setIsOpen(false);
                            }}
                          >
                            <div className="font-medium">{result.title}</div>
                            {result.matchingText && (
                              <div className="text-xs text-muted-foreground truncate mt-1">
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
              {query && results.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <p>No results found.</p>
                </div>
              )}
            </div>
            
            {/* Footer with keyboard shortcuts */}
            <div className="p-2 border-t text-xs text-muted-foreground flex justify-between">
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