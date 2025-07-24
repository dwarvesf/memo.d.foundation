import React, { createContext, useContext, useEffect, useState } from 'react';
import MiniSearch from 'minisearch';
import { IMiniSearchIndex } from '@/types';
import { useEventCallback } from 'usehooks-ts';
import {
  SEARCH_AUTHOR_REGEX,
  SEARCH_DIR_REGEX,
  SEARCH_TAG_REGEX,
  SEARCH_TITLE_REGEX,
} from '@/constants/regex';

// Types
interface Document {
  id: string;
  file_path: string;
  web_path?: string;
  title: string;
  description: string;
  authors?: string[];
  tags?: string[];
  category?: string;
  date?: { days: number };
  spr_content?: string;
  matchingLines?: string;
}
export interface DocumentWithIndex extends Document {
  index: number;
}
export interface SearchResult {
  grouped: Record<string, DocumentWithIndex[]>;
  flat: Document[];
}

interface SearchOptions {
  query: string;
  filters?: {
    authors?: string[];
    tags?: string[];
    title?: string;
  };
}

interface SearchContextType {
  search: (options: SearchOptions) => Promise<SearchResult>;
  isInitialized: boolean;
  isLoading: boolean;
}

// Create context
const SearchContext = createContext<SearchContextType>({
  search: async () => ({ grouped: {}, flat: [] }),
  isInitialized: false,
  isLoading: false,
});

// Constants for search cache
const SEARCH_CACHE_PREFIX = 'search_result_';
const MAX_SEARCH_CACHE_ITEMS = 5;
const SEARCH_CACHE_KEYS = 'search_cache_keys';

// Helper functions
// Function used by other code later
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const extractCategory = (filePath: string): string => {
  const parts = filePath.split('/');
  parts.pop(); // Remove the file name
  return parts.join(' > ');
};

// Marked as unused but kept for API compatibility

function getMatchingLines(content: string, pattern: string): string {
  if (!content || !pattern) return '';

  const lines = content
    .replace(/\\n/g, '\n')
    .replace(/<hr\s*\/?>/gi, '\n')
    .split('\n');
  const regex = new RegExp(pattern.split(' ').join('|'), 'gi');
  const matchingLines = lines.filter(line => regex.test(line)).slice(0, 1);

  if (!matchingLines.length) return '';

  // Convert Markdown to plain text
  let str = markdownToPlainText(matchingLines[0]);

  // Highlight matching parts
  str = str.replace(regex, '<span>$&</span>');

  if (str.length <= 100) return `...${str}...`;

  // Trim to around 100 characters
  const trimmed = str.slice(0, 100);
  let lastSpaceIndex = trimmed.lastIndexOf(' ');

  // Ensure we don't cut off in the middle of a highlight
  while (lastSpaceIndex > 0) {
    const substring = trimmed.substring(0, lastSpaceIndex);
    if (
      substring.split('<span>').length === substring.split('</span>').length
    ) {
      break;
    }
    lastSpaceIndex = trimmed.lastIndexOf(' ', lastSpaceIndex - 1);
  }

  return `...${trimmed.slice(0, lastSpaceIndex)}...`;
}

function markdownToPlainText(markdown: string): string {
  if (!markdown) return '';

  // Remove image Markdown syntax
  let text = markdown.replace(/!\[.*?\]\(.*?\)/g, '');
  // Remove link Markdown syntax, keeping only the link text
  text = text.replace(/\[([^\]]+)\]\(.*?\)/g, '$1');
  // Remove other Markdown syntax
  text = text.replace(/[*_~`#]/g, '');
  return text;
}

function parseQueryForFilters(query: string) {
  const filters: {
    authors: string[];
    tags: string[];
    title: string;
    dir: string[];
  } = {
    authors: [],
    tags: [],
    title: '',
    dir: [],
  };

  const stripFilters = query.split(' ').filter(token => {
    const titleMatch = [...token.matchAll(SEARCH_TITLE_REGEX)];
    if (titleMatch?.length) {
      filters.title = titleMatch[0][1];
      return false;
    }

    const authorMatch = [...token.matchAll(SEARCH_AUTHOR_REGEX)];
    if (authorMatch?.length) {
      filters.authors = filters.authors.concat(authorMatch.map(m => m[1]));
      return false;
    }
    const dirMatch = [...token.matchAll(SEARCH_DIR_REGEX)];
    if (dirMatch?.length) {
      filters.dir = filters.dir.concat(dirMatch.map(m => m[1]));
      return false;
    }

    const tagMatch = [...token.matchAll(SEARCH_TAG_REGEX)];
    if (tagMatch?.length) {
      filters.tags = filters.tags.concat(tagMatch.map(m => m[1]));
      return false;
    }

    return true;
  });

  return { filters, query: stripFilters.join(' ').trim() };
}

function groupResultsByCategory(
  results: Document[],
): Record<string, DocumentWithIndex[]> {
  const grouped: Record<string, DocumentWithIndex[]> = {};

  results.forEach((result, index) => {
    const category = result.category || '';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push({
      ...result,
      index,
    });
  });
  return grouped;
}

// Provider Component
export const SearchProvider: React.FC<{
  children: React.ReactNode;
  searchIndex?: IMiniSearchIndex | null;
}> = ({ children, searchIndex }) => {
  const [miniSearch, setMiniSearch] = useState<MiniSearch<Document> | null>(
    null,
  );
  const [, setDocuments] = useState<Partial<Document>[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize search index from server-provided data
    const initializeSearch = async () => {
      setIsLoading(true);
      try {
        // Define common MiniSearch options
        const miniSearchOptions = {
          fields: [
            'title',
            'short_title',
            'description',
            'tags',
            'authors',
            'spr_content',
            'keywords',
          ],
          storeFields: [
            'file_path',
            'title',
            'short_title',
            'description',
            'tags',
            'authors',
            'date',
            'category',
            'spr_content',
            'keywords',
          ],
          searchOptions: {
            boost: {
              title: 2,
              short_title: 1.9,
              keywords: 1.7,
              spr_content: 1.5,
              tags: 1.4,
              authors: 1.2,
            },
            fuzzy: 0.2,
            prefix: true,
          },
          // @ts-expect-error mixed types
          extractField: (document, fieldName) => {
            if (fieldName === 'tags' && Array.isArray(document.tags)) {
              return document.tags.join(' ');
            }
            if (fieldName === 'authors' && Array.isArray(document.authors)) {
              return document.authors.join(' ');
            }
            if (fieldName === 'keywords' && Array.isArray(document.keywords)) {
              return document.keywords.join(' ');
            }
            return document[fieldName] || '';
          },
        };

        // First try to use provided search index from props (for SSR compatibility)
        if (searchIndex?.index) {
          // Use the static method instead of instance method
          const loadedSearch = MiniSearch.loadJS(
            searchIndex.index,
            miniSearchOptions,
          );
          setMiniSearch(loadedSearch);
          setDocuments(searchIndex.documents || []);
          setIsInitialized(true);
          setIsLoading(false);
          return;
        }

        // If not available from props, fetch it from the static JSON file
        try {
          const response = await fetch('/content/search-index.json');
          if (!response.ok) {
            throw new Error('Failed to fetch search index');
          }

          const data = await response.json();

          if (data?.index) {
            const loadedSearch = MiniSearch.loadJS(
              data.index,
              miniSearchOptions,
            );
            setMiniSearch(loadedSearch);
            setDocuments(data.documents || []);
          } else if (data?.documents) {
            // Create new MiniSearch instance if only documents are available
            const ms = new MiniSearch(miniSearchOptions);
            ms.addAll(data.documents);
            setMiniSearch(ms);
            setDocuments(data.documents);
          }
        } catch (error) {
          console.error('Error fetching search index:', error);
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing search:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeSearch();
  }, [searchIndex]);

  // Search function
  const search = useEventCallback(
    async (options: SearchOptions): Promise<SearchResult> => {
      if (!miniSearch) {
        return { grouped: {}, flat: [] };
      }

      // Parse query and filters
      const { filters, query } = parseQueryForFilters(options.query);
      // Check cache first
      const cacheKey = `${SEARCH_CACHE_PREFIX}${options.query}`;
      const cachedResult = sessionStorage.getItem(cacheKey);
      if (cachedResult) {
        return JSON.parse(cachedResult);
      }
      // Perform search
      let results = miniSearch.search(query || MiniSearch.wildcard, {
        filter: document => {
          // Filter by title if specified
          if (
            filters.title &&
            !document.title.toLowerCase().includes(filters.title.toLowerCase())
          ) {
            return false;
          }
          // Filter by authors if specified
          if (filters.authors.length > 0) {
            const documentAuthors: string[] =
              document.authors?.toLowerCase().split(' ') || [];
            const isMatch = filters.authors.every(author =>
              documentAuthors.includes(author.toLowerCase()),
            );
            if (!isMatch) {
              return false;
            }
          }

          if (filters.tags.length > 0) {
            const documentTags: string[] =
              document.tags?.toLowerCase().split(' ') || [];
            const isMatch = filters.tags.every(tag =>
              documentTags.includes(tag.toLowerCase()),
            );
            if (!isMatch) {
              return false;
            }
          }
          // Filter by directory if specified
          if (filters.dir.length > 0) {
            const documentDir = (document.file_path as string)
              .replace(' ', '-')
              .toLowerCase()
              .split('/')
              .slice(0, -1)
              .join('/');
            const isMatch = filters.dir.every(dir =>
              documentDir.includes(dir.toLowerCase()),
            );
            if (!isMatch) {
              return false;
            }
          }

          return true;
        },
      });
      // sort by date.days, days max => latest
      results.sort((a, b) => {
        const scoreA = Math.round(a.score);
        const scoreB = Math.round(b.score);

        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
        const aDate = a.date?.days || 0;
        const bDate = b.date?.days || 0;
        return bDate - aDate;
      });

      // Limit to 10 results
      results = results.slice(0, 50);

      // Add matching lines
      // We need to fetch content for highlighting - this would come from an API
      // For now, we'll just return results without matching lines
      const enrichedResults = await Promise.all(
        results.map(async result => {
          const document = { ...result } as unknown as Document;

          // In a real implementation, you'd fetch the content for highlighting
          // For now, we'll just set a placeholder
          document.matchingLines = query
            ? getMatchingLines(document.spr_content || '', query)
            : '';

          document.title = query
            ? document.title.replace(
                new RegExp(query, 'gi'),
                match => `<span>${match}</span>`,
              )
            : document.title;

          return document;
        }),
      );

      // Group results by category
      const grouped = groupResultsByCategory(enrichedResults);

      const finalResult = {
        grouped,
        flat: enrichedResults,
      };

      // Cache the result
      sessionStorage.setItem(cacheKey, JSON.stringify(finalResult));
      // Manage cache keys
      const cacheKeys = JSON.parse(
        sessionStorage.getItem(SEARCH_CACHE_KEYS) || '[]',
      ) as string[];
      cacheKeys.push(cacheKey);
      if (cacheKeys.length > MAX_SEARCH_CACHE_ITEMS) {
        const keysToRemove = cacheKeys.splice(
          0,
          cacheKeys.length - MAX_SEARCH_CACHE_ITEMS,
        );
        keysToRemove.forEach(key => sessionStorage.removeItem(key));
      }
      sessionStorage.setItem(SEARCH_CACHE_KEYS, JSON.stringify(cacheKeys));

      return finalResult;
    },
  );

  return (
    <SearchContext.Provider value={{ search, isInitialized, isLoading }}>
      {children}
    </SearchContext.Provider>
  );
};

// Hook to use search context
export const useSearch = () => useContext(SearchContext);

export default SearchProvider;
