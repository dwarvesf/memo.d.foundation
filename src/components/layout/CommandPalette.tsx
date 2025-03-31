import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useRouter } from 'next/router';
import { useSearch } from '../search';
import { groupBy } from '@/lib/utils';
import { SearchResult } from '../search/SearchProvider';
import { toast } from 'sonner';
import { useDebouncedCallback } from 'use-debounce';
import { IRecentPageStorageItem, ISearchResultItem } from '@/types';
import CommandPaletteModal from './CommandPaletteModal';
import { BookOpenIcon, PinIcon, CopyIcon } from 'lucide-react';
import HotIcon from '../icons/HotIcon';

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
  const [isSearching, setIsSearching] = useState(false);
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
      setIsSearching(false);
      return;
    }

    const result = await search({ query: searchQuery });
    setResult(result);
    setSelectedIndex(0);
    setSelectedCategory(result.flat[0]?.category || '');
    setIsSearching(false);
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
      <CommandPaletteModal
        isOpen={isOpen}
        searchInputRef={searchInputRef}
        searchContainerRef={searchContainerRef}
        query={query}
        setQuery={setQuery}
        result={result}
        defaultResult={defaultResult}
        selectedIndex={selectedIndex}
        setSelectedIndex={setSelectedIndex}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        goto={goto}
        isSearching={isSearching}
        setIsSearching={setIsSearching}
      />
    </div>
  );
};

export default CommandPalette;

function getDefaultSearchResult(recentPages: IRecentPageStorageItem[]) {
  const flat: ISearchResultItem[] = [
    ...recentPages.map(page => ({
      id: page.path,
      title: page.title,
      description: page.path.split('/').filter(Boolean).join(' > '),
      category: 'Recents',
      path: page.path,
      icon: <BookOpenIcon className="stroke-primary" />,
    })),
    {
      id: 'hot',
      title: 'What’s been hot lately',
      description: 'See featured posts',
      category: 'Welcome to Dwarves Memo',
      icon: <HotIcon className="stroke-primary" />,
      path: '/',
    },
    {
      id: 'pinned',
      title: 'Pinned note',
      description: 'View our latest announcement',
      category: 'Welcome to Dwarves Memo',
      icon: <PinIcon className="stroke-primary" />,
      path: '/',
    },
    {
      id: 'copy',
      title: 'Copy memo content',
      description: 'Copy memo content to clipboard',
      category: 'Actions',
      icon: <CopyIcon className="stroke-primary" />,
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
