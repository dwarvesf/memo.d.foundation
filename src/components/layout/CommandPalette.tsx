import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useRouter } from 'next/router';
import { useSearch } from '../search';
import { groupBy, slugToTitle } from '@/lib/utils';
import { SearchResult } from '../search/SearchProvider';
import { toast } from 'sonner';
import { useDebouncedCallback } from 'use-debounce';
import { IRecentPageStorageItem, ISearchResultItem } from '@/types';
import CommandPaletteModal from './CommandPaletteModal';
import { BookOpenIcon, PinIcon, CopyIcon, Share2Icon } from 'lucide-react';
import HotIcon from '../icons/HotIcon';
import { slugifyPathComponents } from '@/lib/utils/slugify';
import SearchIcon from '../icons/SearchIcon';
import { Editor } from 'draft-js';
import { useLayoutContext } from '@/contexts/layout';

const defaultSearchResult: SearchResult = {
  flat: [],
  grouped: {},
};

const CommandPalette: React.FC = () => {
  const { isMacOS } = useLayoutContext();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult>(defaultSearchResult);
  const [recentPages, setRecentPages] = useState<IRecentPageStorageItem[]>([]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');
  const searchInputRef = useRef<Editor>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [isSearching, setIsSearching] = useState(false);
  const { search } = useSearch();

  const defaultResult = useMemo(() => {
    return getDefaultSearchResult(recentPages);
  }, [recentPages]);

  // Open/close the command palette
  const toggleCommandPalette = useCallback(() => {
    setIsOpen(prev => {
      const newIsOpen = !prev;
      if (newIsOpen) {
        // Opening command palette - just add the class to body
        document.body.classList.add('cmd-palette-open');
      } else {
        // Closing command palette - simply remove the class
        document.body.classList.remove('cmd-palette-open');
      }
      return newIsOpen;
    });
    setQuery('');
    setResult(defaultSearchResult);
  }, []);

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
    try {
      if (query) {
        const selected = result.grouped[selectedCategory]?.[selectedIndex];
        if (selected && selected.file_path) {
          // Use the slugifyPathComponents function from backlinks.ts
          const slugifiedPath = selected.file_path.endsWith('.md')
            ? slugifyPathComponents(selected.file_path).slice(0, -3) // Remove .md extension
            : slugifyPathComponents(selected.file_path);

          router.push('/' + slugifiedPath);
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
        } else if (selected.action === 'share') {
          navigator.clipboard.writeText(window.location.href);
          toast.success('Copied memo link!');
          close();
        } else {
          // Use router.push with a more reliable approach to prevent tab closing
          // Make sure path starts with '/' to ensure relative navigation
          const path = selected.path.startsWith('/')
            ? selected.path
            : '/' + selected.path;
          router.push(path);
          close();
        }
      }
    } catch (error) {
      console.error('Error navigating to selected item:', error);
    }
  }, [
    query,
    result.grouped,
    selectedCategory,
    selectedIndex,
    defaultResult.grouped,
    router,
    close,
  ]);

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
    defaultResult.grouped,
    result.grouped,
    selectedIndex,
    selectedCategory,
    scrollResultIntoView,
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
    defaultResult.grouped,
    result.grouped,
    selectedIndex,
    selectedCategory,
    scrollResultIntoView,
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
    const options = {
      capture: true,
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

    document.addEventListener('keydown', handleKeyDown, options);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, options);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [
    isOpen,
    result.grouped,
    selectedCategory,
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
        const parsed = JSON.parse(storedRecents) as IRecentPageStorageItem[];

        // Skip recording if this is the home page
        if (isSkip) {
          // Remove current page if it exists already (to avoid duplicates)
          let newRecentPages = parsed.filter(page => page.path !== currentPath);

          // Add current page to the beginning
          newRecentPages.unshift(currentPage);
          const maxLength = 5;
          // Keep only the last 10 pages
          if (newRecentPages.length > maxLength) {
            newRecentPages = parsed.slice(0, maxLength);
          }
          setRecentPages(newRecentPages);

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
      setRecentPages(initialRecentPages);
      localStorage.setItem('recentPages', JSON.stringify(initialRecentPages));
    }
  }, [router.asPath]);

  const modifier = isMacOS ? '⌘' : 'ctrl';

  return (
    <div className="command-palette relative z-50">
      {/* Search button */}
      <button
        className="hover:border-border hidden w-50 cursor-pointer justify-between rounded-lg border border-transparent bg-transparent px-3 py-1.5 transition-all duration-100 ease-in-out md:flex"
        onClick={toggleCommandPalette}
        aria-label="Open command palette"
      >
        <div className="flex items-center gap-0.5">
          <div className="text-muted-foreground flex items-center gap-1 text-sm filter-[opacity(50%)]">
            <SearchIcon />
            <span className="">Search note</span>
          </div>
        </div>
        <div className="text-muted-foreground flex items-center gap-0.5 text-xs">
          <kbd
            className="text-black-secondary dark:bg-border dark:text-foreground rounded-[2px] bg-[#F7F7F7] px-1.5 py-0.5 font-sans shadow-[0px_2px_0px_0px_#D4D3D0] dark:shadow-[0px_2px_0px_0px_#2D2D2D]"
            suppressHydrationWarning
          >
            {modifier}
          </kbd>
          <kbd className="text-black-secondary dark:bg-border dark:text-foreground rounded-[2px] bg-[#F7F7F7] px-1.5 py-0.5 font-sans shadow-[0px_2px_0px_0px_#D4D3D0] dark:shadow-[0px_2px_0px_0px_#2D2D2D]">
            K
          </kbd>
        </div>
      </button>

      {/* Mobile search button */}
      <button
        className="text-foreground flex h-10 w-10 items-center justify-center border-none bg-transparent p-0 md:hidden"
        onClick={toggleCommandPalette}
        aria-label="Open search"
      >
        <SearchIcon />
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
      description: page.path
        .split('/')
        .filter(Boolean)
        .slice(0, -1)
        .map(slug => slugToTitle(slug))
        .join(' > '),
      category: 'Recents',
      path: page.path,
      icon: <BookOpenIcon className="stroke-primary" />,
    })),
    {
      id: 'hot',
      title: "What's been hot lately",
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
    {
      id: 'share',
      title: 'Share memo link',
      description: 'Copy memo link to clipboard',
      category: 'Actions',
      icon: <Share2Icon className="stroke-primary" />,
      action: 'share',
      path: 'share',
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
