import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearch } from './SearchProvider';
import Image from 'next/image';
import Link from 'next/link';

interface RecentPage {
  title: string;
  path: string;
}

interface Document {
  file_path: string;
  title: string;
  description: string;
  category?: string;
  matchingLines?: string;
  spr_content?: string;
}

const CommandPalette: React.FC = () => {
  const { search } = useSearch();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ grouped: Record<string, Document[]>, flat: Document[] }>({ grouped: {}, flat: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Document | null>(null);
  const [selectedSection, setSelectedSection] = useState<'recents' | 'welcome' | 'suggestions' | 'search'>('welcome');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);
  const [pinnedNotes, setPinnedNotes] = useState<{ title: string, url: string }[]>([]);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Load recent pages from localStorage
  useEffect(() => {
    const storedRecents = localStorage.getItem('recentPages');
    if (storedRecents) {
      try {
        const parsed = JSON.parse(storedRecents);
        setRecentPages(parsed);
      } catch (e) {
        console.error('Error parsing recent pages', e);
      }
    }
  }, []);

  // Load pinned notes (would come from server in real implementation)
  useEffect(() => {
    // Placeholder - in a real app, these would be fetched from the server
    setPinnedNotes([
      { title: 'Getting Started with Dwarves Memo', url: '/' }
    ]);
  }, []);

  // Handle key commands
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command/Ctrl + K to open palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          setIsOpen(false);
        } else {
          setIsOpen(true);
          setTimeout(() => {
            searchInputRef.current?.focus();
          }, 10);
        }
      }
      
      // If palette is open
      if (isOpen) {
        switch (e.key) {
          case 'Escape':
            e.preventDefault();
            setIsOpen(false);
            break;
          case 'ArrowDown':
            e.preventDefault();
            handleArrowDown();
            break;
          case 'ArrowUp':
            e.preventDefault();
            handleArrowUp();
            break;
          case 'Enter':
            e.preventDefault();
            handleEnter();
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleArrowDown, handleArrowUp, handleEnter]);

  // Handle search
  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) {
        setResults({ grouped: {}, flat: [] });
        setSelectedItem(null);
        return;
      }
      
      setIsSearching(true);
      
      try {
        const searchResults = await search({ query });
        setResults(searchResults);
        
        if (searchResults.flat.length > 0) {
          setSelectedItem(searchResults.flat[0]);
          setSelectedSection('search');
        }
      } catch (error) {
        console.error('Error searching:', error);
      } finally {
        setIsSearching(false);
      }
    };
    
    // Debounce search
    const timer = setTimeout(() => {
      performSearch();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [query, search]);

  // Create the scrollSelectedIntoView function first so we can use it in callbacks
  const scrollSelectedIntoView = useCallback((selector?: string) => {
    if (!searchContainerRef.current) return;
    
    setTimeout(() => {
      const selected = searchContainerRef.current?.querySelector(
        selector || 
        (selectedSection === 'search' ? '.cmd-result-selected' : 
         selectedSection === 'recents' ? `.cmd-idle-item[data-recent-id="${selectedIndex}"]` :
         selectedSection === 'welcome' ? `.cmd-idle-item[data-welcome-id="${selectedIndex}"]` :
         '.cmd-idle-item[data-suggestion-id="0"]')
      );
      
      if (selected) {
        selected.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      }
    }, 10);
  }, [selectedSection, selectedIndex]);

  // Navigation helpers
  const handleArrowDown = useCallback(() => {
    if (query && results.flat.length > 0) {
      // Search results navigation
      const currentIndex = results.flat.findIndex(item => item === selectedItem);
      const nextIndex = (currentIndex + 1) % results.flat.length;
      setSelectedItem(results.flat[nextIndex]);
      scrollSelectedIntoView(`.cmd-result-item[data-index="${nextIndex}"]`);
    } else {
      // Navigation between sections
      if (selectedSection === 'recents') {
        if (recentPages.length === 0) {
          setSelectedSection('welcome');
          setSelectedIndex(0);
        } else if (selectedIndex < recentPages.length - 1) {
          setSelectedIndex(selectedIndex + 1);
        } else {
          setSelectedSection('welcome');
          setSelectedIndex(0);
        }
      } else if (selectedSection === 'welcome') {
        if (selectedIndex < 1) { // 2 welcome items
          setSelectedIndex(selectedIndex + 1);
        } else {
          setSelectedSection('suggestions');
          setSelectedIndex(0);
        }
      } else if (selectedSection === 'suggestions') {
        setSelectedSection('recents');
        setSelectedIndex(0);
      }
      
      scrollSelectedIntoView();
    }
  }, [query, results.flat, selectedItem, selectedSection, selectedIndex, recentPages, scrollSelectedIntoView]);

  const handleArrowUp = useCallback(() => {
    if (query && results.flat.length > 0) {
      // Search results navigation
      const currentIndex = results.flat.findIndex(item => item === selectedItem);
      const prevIndex = currentIndex <= 0 ? results.flat.length - 1 : currentIndex - 1;
      setSelectedItem(results.flat[prevIndex]);
      scrollSelectedIntoView(`.cmd-result-item[data-index="${prevIndex}"]`);
    } else {
      // Navigation between sections
      if (selectedSection === 'recents') {
        if (selectedIndex > 0) {
          setSelectedIndex(selectedIndex - 1);
        } else {
          setSelectedSection('suggestions');
          setSelectedIndex(0);
        }
      } else if (selectedSection === 'welcome') {
        if (selectedIndex > 0) {
          setSelectedIndex(selectedIndex - 1);
        } else {
          if (recentPages.length > 0) {
            setSelectedSection('recents');
            setSelectedIndex(recentPages.length - 1);
          } else {
            setSelectedSection('suggestions');
            setSelectedIndex(0);
          }
        }
      } else if (selectedSection === 'suggestions') {
        setSelectedSection('welcome');
        setSelectedIndex(1);
      }
      
      scrollSelectedIntoView();
    }
  }, [query, results.flat, selectedItem, selectedSection, selectedIndex, recentPages, scrollSelectedIntoView]);

  const handleEnter = useCallback(() => {
    if (query && selectedItem) {
      // Navigate to selected search result
      const path = formatFilePath(selectedItem.file_path);
      window.location.href = path;
    } else if (selectedSection === 'recents' && recentPages[selectedIndex]) {
      // Navigate to selected recent page
      window.location.href = recentPages[selectedIndex].path;
    } else if (selectedSection === 'welcome') {
      if (selectedIndex === 0) {
        // Navigate to home
        window.location.href = '/';
      } else if (selectedIndex === 1 && pinnedNotes.length > 0) {
        // Navigate to first pinned note
        window.location.href = pinnedNotes[0].url;
      }
    } else if (selectedSection === 'suggestions') {
      // Copy page content
      const pageContent = document.querySelector('.memo-content');
      let content = 'No content found';
      if (pageContent) {
        content = pageContent.textContent || 'No content found';
      }
      navigator.clipboard.writeText(content);
      // Would show toast in real implementation
      alert('Copied memo content!');
      setIsOpen(false);
    }
  }, [query, selectedItem, selectedSection, selectedIndex, recentPages, pinnedNotes]);

  const scrollSelectedIntoView = useCallback((selector?: string) => {
    if (!searchContainerRef.current) return;
    
    setTimeout(() => {
      const selected = searchContainerRef.current?.querySelector(
        selector || 
        (selectedSection === 'search' ? '.cmd-result-selected' : 
         selectedSection === 'recents' ? `.cmd-idle-item[data-recent-id="${selectedIndex}"]` :
         selectedSection === 'welcome' ? `.cmd-idle-item[data-welcome-id="${selectedIndex}"]` :
         '.cmd-idle-item[data-suggestion-id="0"]')
      );
      
      if (selected) {
        selected.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      }
    }, 10);
  }, [selectedSection, selectedIndex]);

  // Helper to format file path for URL
  const formatFilePath = (filePath: string): string => {
    return '/' + filePath
      .replace(/\.md$/, '')
      .replace(/[\§\¶\&]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/\/_index/g, '')
      .replace(/\/readme/g, '')
      .replace(/\/+/g, '/')
      .split('/')
      .map(segment => segment.replace(/^-+|-+$/g, ''))
      .filter(segment => segment)
      .join('/');
  };

  // Show correct items based on state
  const renderSearchResults = () => {
    if (isSearching) {
      return (
        <div className="cmd-searching">
          <p>Searching...</p>
        </div>
      );
    }

    if (query && Object.keys(results.grouped).length === 0) {
      return (
        <div className="cmd-no-results">
          <Image src="/assets/img/404.png" alt="No results" width={200} height={200} />
          <p>No results found</p>
        </div>
      );
    }

    if (query && Object.keys(results.grouped).length > 0) {
      return (
        <div className="cmd-results-list-wrapper">
          <ul className="cmd-results-list">
            {Object.entries(results.grouped).map(([group, items]) => (
              <div key={group} className="cmd-results-group">
                <span>{group}</span>
                {items.map((result) => (
                  <li
                    key={result.file_path}
                    className={`cmd-result-item ${result === selectedItem ? 'cmd-result-selected' : ''}`}
                    data-index={results.flat.indexOf(result)}
                    onMouseEnter={() => {
                      setSelectedItem(result);
                      setSelectedSection('search');
                    }}
                  >
                    <Link href={formatFilePath(result.file_path)}>
                      <div className="cmd-result-title">{result.title}</div>
                      {result.matchingLines && (
                        <p className="cmd-matching-line" dangerouslySetInnerHTML={{ __html: result.matchingLines }} />
                      )}
                    </Link>
                  </li>
                ))}
              </div>
            ))}
          </ul>

          {selectedItem && (
            <div className="cmd-result-preview">
              <div className="cmd-preview-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <g fill="currentColor">
                    <path fillRule="evenodd"
                      d="M4.125 3C3.089 3 2.25 3.84 2.25 4.875V18a3 3 0 0 0 3 3h15a3 3 0 0 1-3-3V4.875C17.25 3.839 16.41 3 15.375 3zM12 9.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5zm-.75-2.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H12a.75.75 0 0 1-.75-.75M6 12.75a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5zm-.75 3.75a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75M6 6.75a.75.75 0 0 0-.75.75v3c0 .414.336.75.75.75h3a.75.75 0 0 0 .75-.75v-3A.75.75 0 0 0 9 6.75z"
                      clipRule="evenodd" />
                    <path d="M18.75 6.75h1.875c.621 0 1.125.504 1.125 1.125V18a1.5 1.5 0 0 1-3 0z" />
                  </g>
                </svg>
              </div>
              <span className="cmd-preview-path">{selectedItem.category}</span>
              <p className="cmd-preview-title">{selectedItem.title}</p>
              <p className="cmd-preview-description">{selectedItem.description}</p>
              {selectedItem.spr_content && (
                <div className="cmd-preview-recap">
                  <span>on this page</span>
                  <p dangerouslySetInnerHTML={{ __html: selectedItem.spr_content }} />
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const renderIdleSections = () => {
    if (query) return null;
    
    return (
      <>
        {/* Recents Section */}
        {recentPages.length > 0 && (
          <div className="cmd-idle-section">
            <span className="cmd-idle-group-title">Recents</span>
            <ul className="cmd-idle-list">
              {recentPages.map((page, index) => (
                <div 
                  key={index}
                  className={`cmd-idle-item ${selectedSection === 'recents' && selectedIndex === index ? 'cmd-idle-selected' : ''}`}
                  data-recent-id={index}
                  onMouseEnter={() => {
                    setSelectedSection('recents');
                    setSelectedIndex(index);
                  }}
                  onClick={handleEnter}
                >
                  <div className="cmd-idle-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 7v14" />
                      <path d="M16 12h2" />
                      <path d="M16 8h2" />
                      <path
                        d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
                      <path d="M6 12h2" />
                      <path d="M6 8h2" />
                    </svg>
                  </div>
                  <div className="cmd-idle-item-text">
                    <span className="cmd-idle-item-title">{page.title}</span>
                    <span className="cmd-idle-item-subtitle">{page.path.split('/').filter(p => p).join(' > ')}</span>
                  </div>
                </div>
              ))}
            </ul>
          </div>
        )}

        {/* Welcome Section */}
        <div className="cmd-idle-section">
          <div className="cmd-idle-header">
            <span className="cmd-idle-group-title">Welcome to Dwarves Memo</span>
          </div>
          <ul className="cmd-idle-list">
            <div 
              className={`cmd-idle-item ${selectedSection === 'welcome' && selectedIndex === 0 ? 'cmd-idle-selected' : ''}`}
              data-welcome-id="0"
              onMouseEnter={() => {
                setSelectedSection('welcome');
                setSelectedIndex(0);
              }}
              onClick={() => {
                window.location.href = '/';
                setIsOpen(false);
              }}
            >
              <div className="cmd-idle-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path
                    d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                </svg>
              </div>
              <div className="cmd-idle-item-text">
                <span className="cmd-idle-item-title">What&apos;s been hot lately</span>
                <span className="cmd-idle-item-subtitle">See featured posts</span>
              </div>
            </div>
            
            <div 
              className={`cmd-idle-item ${selectedSection === 'welcome' && selectedIndex === 1 ? 'cmd-idle-selected' : ''}`}
              data-welcome-id="1"
              onMouseEnter={() => {
                setSelectedSection('welcome');
                setSelectedIndex(1);
              }}
              onClick={() => {
                if (pinnedNotes.length > 0) {
                  window.location.href = pinnedNotes[0].url;
                } else {
                  window.location.href = '/';
                }
                setIsOpen(false);
              }}
            >
              <div className="cmd-idle-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 17v5" />
                  <path
                    d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
                </svg>
              </div>
              <div className="cmd-idle-item-text">
                <span className="cmd-idle-item-title">Pinned note</span>
                <span className="cmd-idle-item-subtitle">View our latest announcement</span>
              </div>
            </div>
          </ul>
        </div>

        {/* Suggestions Section */}
        <div className="cmd-idle-section">
          <div className="cmd-idle-header">
            <span className="cmd-idle-group-title">Actions</span>
          </div>
          <ul className="cmd-idle-list">
            <div 
              className={`cmd-idle-item ${selectedSection === 'suggestions' && selectedIndex === 0 ? 'cmd-idle-selected' : ''}`}
              data-suggestion-id="0"
              onMouseEnter={() => {
                setSelectedSection('suggestions');
                setSelectedIndex(0);
              }}
              onClick={() => {
                const pageContent = document.querySelector('.memo-content');
                let content = 'No content found';
                if (pageContent) {
                  content = pageContent.textContent || 'No content found';
                }
                navigator.clipboard.writeText(content);
                alert('Copied memo content!');
                setIsOpen(false);
              }}
            >
              <div className="cmd-idle-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                </svg>
              </div>
              <div className="cmd-idle-item-text">
                <span className="cmd-idle-item-title">Copy memo content</span>
              </div>
            </div>
          </ul>
        </div>
      </>
    );
  };

  return (
    <div className="cmd-palette">
      <button className="cmd-search-button" onClick={() => setIsOpen(true)}>
        <span className="cmd-search-button-text">🔍 Search</span>
        <span className="cmd-search-button-keys">
          <kbd className="memo-tag">⌘</kbd>
          <kbd className="memo-tag">K</kbd>
        </span>
      </button>
      
      <button className="cmd-search-button-mobile" onClick={() => setIsOpen(true)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      
      {isOpen && (
        <div className="cmd-overlay cmd-modal-active" ref={searchContainerRef}>
          <div 
            className="cmd-modal" 
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsOpen(false);
              }
            }}
          >
            <input 
              ref={searchInputRef}
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..." 
              className="cmd-search-input"
              autoComplete="off"
            />
            
            <div className={`cmd-results ${isOpen ? 'cmd-results-active' : 'cmd-results-hidden'}`}>
              {renderSearchResults()}
              {renderIdleSections()}
              
              {query && Object.keys(results.grouped).length === 0 && !isSearching && (
                <div className="cmd-no-results">
                  <Image src="/assets/img/404.png" alt="No results" width={200} height={200} />
                </div>
              )}
              
              <div className="cmd-instructions">
                Type <kbd className="memo-tag">ESC</kbd> to close search bar
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommandPalette;