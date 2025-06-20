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
import { CommandPaletteModal } from './CommandPaletteModal';
import { BookOpenIcon, PinIcon, CopyIcon, Share2Icon } from 'lucide-react';
import HotIcon from '../icons/HotIcon';
import { slugifyPathComponents } from '@/lib/utils/slugify';
import SearchIcon from '../icons/SearchIcon';
import { Editor } from 'draft-js';
import { useLayoutContext } from '@/contexts/layout';
import { getClientSideRedirectPath } from '@/lib/utils/path-utils';

const defaultSearchResult: SearchResult = {
  flat: [],
  grouped: {},
};

const NOT_FOUND_TITLE = '404 - page not found';

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
        // Store current scroll position
        const scrollY = window.scrollY;
        document.body.style.top = `-${scrollY}px`;
        document.body.classList.add('cmd-palette-open');
      } else {
        // Restore scroll position
        const scrollY = document.body.style.top;
        document.body.classList.remove('cmd-palette-open');
        document.body.style.top = '';
        if (scrollY) {
          window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
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
    // Restore scroll position
    const scrollY = document.body.style.top;
    document.body.classList.remove('cmd-palette-open');
    document.body.style.top = '';
    if (scrollY) {
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
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
          const originalFilePath = selected.file_path;
          // Remove /readme, /_index suffixes with optional .md and case-insensitive
          const suffixRegex = /\/(readme|_index)(\.md)?$/i;
          const cleanedPath = originalFilePath.replace(suffixRegex, '');

          // Use the slugifyPathComponents function from backlinks.ts
          let slugifiedPath = slugifyPathComponents(cleanedPath);

          // If the original file path ended with .md, remove the extension from the slugified path
          if (originalFilePath.endsWith('.md')) {
            slugifiedPath = slugifiedPath.slice(0, -3); // Remove .md extension
          }

          router.push(getClientSideRedirectPath('/' + slugifiedPath));

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
          const shareLink = (window?._memo_frontmatter?.redirect || [])
            .map(link => {
              return (
                window.location.protocol + '//' + window.location.host + link
              );
            })
            .reduce((a, c) => {
              if (c.length < a.length) {
                return c;
              }
              return a;
            }, window.location.href);
          navigator.clipboard.writeText(shareLink);
          toast.success('Copied memo link!');
          close();
        } else {
          // Use router.push with a more reliable approach to prevent tab closing
          // Make sure path starts with '/' to ensure relative navigation
          const path = selected.path.startsWith('/')
            ? selected.path
            : '/' + selected.path;

          router.push(getClientSideRedirectPath(path));
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

    // Add index to results
    const flatWithIndex = result.flat.map((item, index) => ({
      ...item,
      index,
    }));

    // Remove /readme, /_index suffixes with optional .md and case-insensitive
    const suffixRegex = /\/(readme|_index)(\.md)?$/i;
    const resultsWithCleanedPaths = flatWithIndex.map(item => {
      const cleanedPath = item.file_path.replace(suffixRegex, '');
      return {
        ...item,
        file_path: cleanedPath,
      };
    });

    // Re-group the results with cleaned paths
    const grouped = groupBy(resultsWithCleanedPaths, 'category');

    setResult({ flat: resultsWithCleanedPaths, grouped: grouped });
    setSelectedIndex(0);
    setSelectedCategory(resultsWithCleanedPaths[0]?.category || '');
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
    const currentTitle = document.title; // This is the most reliable source after page navigation
    const isHomePage = currentPath === '/' || currentPath === '/index.html';
    const timestamp = new Date().getTime();

    // Normalize page title for checks
    let pageTitle = currentTitle;
    // The title set by RootLayout for 404 pages is "404 - Page Not Found"
    // The title set by [...slug].tsx for other pages might include " - Dwarves Memo"
    // We should primarily check against the specific 404 title.
    const is404Page = pageTitle.toLowerCase() === NOT_FOUND_TITLE;

    // Filter out 404s from existing stored recents
    let existingRecents: IRecentPageStorageItem[] = [];
    if (storedRecents) {
      try {
        const parsed = JSON.parse(storedRecents);
        if (Array.isArray(parsed)) {
          existingRecents = parsed.filter(
            page => page.title.toLowerCase() !== NOT_FOUND_TITLE,
          );
        }
      } catch (error) {
        console.error(
          'Error parsing or filtering recent pages from localStorage',
          error,
        );
        existingRecents = []; // Reset if parsing/filtering fails
      }
    }

    if (isHomePage || is404Page) {
      // If it's the home page or a 404 page, just set the (filtered) recents and don't add current page
      setRecentPages(existingRecents);
      if (
        is404Page &&
        storedRecents &&
        JSON.stringify(existingRecents) !== storedRecents
      ) {
        // If 404s were filtered out, update localStorage
        localStorage.setItem('recentPages', JSON.stringify(existingRecents));
      }
      return;
    }

    // Proceed to add the current valid page
    // Strip " | {suffix}" suffix if present for consistency
    if (pageTitle.toLowerCase().indexOf(' | ') > -1) {
      pageTitle = pageTitle.split(' | ')[0].trim();
    }

    const currentPage: IRecentPageStorageItem = {
      path: currentPath,
      title: pageTitle, // Use the potentially stripped title
      timestamp: timestamp,
    };

    // Remove current page if it exists already (to avoid duplicates and update timestamp)
    let newRecentPages = existingRecents.filter(
      page => page.path !== currentPath,
    );

    // Add current page to the beginning
    newRecentPages.unshift(currentPage);

    const maxLength = 5; // Max recent pages to keep
    if (newRecentPages.length > maxLength) {
      newRecentPages = newRecentPages.slice(0, maxLength);
    }

    setRecentPages(newRecentPages);
    localStorage.setItem('recentPages', JSON.stringify(newRecentPages));
  }, [router.asPath]);

  const modifier = isMacOS ? '⌘' : 'ctrl';

  return (
    <div className="command-palette relative z-50">
      {/* Search button */}
      <button
        className="hover:border-border hidden w-[240px] cursor-pointer justify-between rounded-lg border border-transparent bg-transparent px-2 py-2 transition-all duration-100 ease-in-out md:flex"
        onClick={toggleCommandPalette}
        aria-label="Open command palette"
      >
        <div className="flex items-center gap-0.5">
          <div className="text-muted-foreground flex items-center gap-2 text-sm filter-[opacity(50%)]">
            <SearchIcon />
            <span className="">Search note</span>
          </div>
        </div>
        <div className="text-muted-foreground flex items-center gap-0.5 text-xs">
          <span
            className="flex items-center justify-center rounded-md bg-[var(--border)] px-1 py-0.5 font-sans text-[12px] leading-4 font-medium text-[var(--muted-foreground)]"
            suppressHydrationWarning
          >
            {modifier} K
          </span>
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
        onClose={close}
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
