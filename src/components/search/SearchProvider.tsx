import React, { createContext, useContext, useEffect, useState } from 'react';
import MiniSearch from 'minisearch';

// Types
interface Document {
  id: string;
  file_path: string;
  title: string;
  description: string;
  authors?: string[];
  tags?: string[];
  category?: string;
  date?: string;
  spr_content?: string;
  matchingLines?: string;
}

interface SearchResult {
  grouped: Record<string, Document[]>;
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

// Helper functions
// Function used by other code later
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const extractCategory = (filePath: string): string => {
  const parts = filePath.split('/');
  parts.pop(); // Remove the file name
  return parts.join(' > ');
};

// Marked as unused but kept for API compatibility
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getMatchingLines(content: string, pattern: string): string {
  if (!content || !pattern) return '';

  const lines = content.split('\n');
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

function parseQueryForFilters(query: string): {
  filters: { authors: string[]; tags: string[]; title: string };
  query: string;
} {
  const filters: { authors: string[]; tags: string[]; title: string } = { authors: [], tags: [], title: '' };

  const authorRe = /author:([^\s]*)/g;
  const tagRe = /tag:([^\s]*)/g;
  const titleRe = /title:([^\s]*)/g;
  const hashtagRe = /#([^\s#]+)/g;
  const atMentionRe = /@([^\s@]+)/g;

  const stripFilters = query.split(' ').filter(token => {
    const titleMatch = [...token.matchAll(titleRe)];
    if (titleMatch?.length) {
      filters.title = titleMatch[0][1];
      return false;
    }

    const authorMatch = [...token.matchAll(authorRe)];
    if (authorMatch?.length) {
      filters.authors = filters.authors.concat(authorMatch.map(m => m[1]));
      return false;
    }

    // Handle @mention format for authors
    const atMentionMatch = [...token.matchAll(atMentionRe)];
    if (atMentionMatch?.length) {
      filters.authors = filters.authors.concat(atMentionMatch.map(m => m[1]));
      return false;
    }

    const tagMatch = [...token.matchAll(tagRe)];
    if (tagMatch?.length) {
      filters.tags = filters.tags.concat(tagMatch.map(m => m[1]));
      return false;
    }

    // Handle hashtags (#tag format)
    const hashtagMatch = [...token.matchAll(hashtagRe)];
    if (hashtagMatch?.length) {
      filters.tags = filters.tags.concat(hashtagMatch.map(m => m[1]));
      return false;
    }

    return true;
  });

  return { filters, query: stripFilters.join(' ').trim() };
}

function groupResultsByCategory(
  results: Document[],
): Record<string, Document[]> {
  const grouped: Record<string, Document[]> = {};

  results.forEach(result => {
    const category = result.category || '';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(result);
  });

  return grouped;
}

// Provider Component
export const SearchProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [miniSearch, setMiniSearch] = useState<MiniSearch<Document> | null>(
    null,
  );
  const [, setDocuments] = useState<Document[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize search index from server-provided data
    const initializeSearch = async () => {
      setIsLoading(true);
      try {
        // Fetch search index from API endpoint
        const response = await fetch('/api/search-index');
        if (!response.ok) throw new Error('Failed to load search index');

        const data = await response.json();

        // Define common MiniSearch options
        const miniSearchOptions = {
          fields: ['title', 'description', 'tags', 'authors'],
          storeFields: [
            'file_path',
            'title',
            'description',
            'tags',
            'authors',
            'date',
            'category',
            'spr_content',
          ],
          searchOptions: {
            boost: { title: 2, tags: 1.5, authors: 1.2 },
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
            return document[fieldName] || '';
          },
        };

        // Create new MiniSearch instance
        const ms = new MiniSearch(miniSearchOptions);

        // Load pre-built index if available
        if (data.index) {
          // Use the static method instead of instance method
          const loadedSearch = MiniSearch.loadJSON(data.index, miniSearchOptions);
          setMiniSearch(loadedSearch);
        } else if (data.documents) {
          // Otherwise, add documents to index
          ms.addAll(data.documents);
        }

        setMiniSearch(ms);
        setDocuments(data.documents || []);
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing search:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!isInitialized && !isLoading) {
      initializeSearch();
    }
  }, [isInitialized, isLoading]);

  // Search function
  const search = async (options: SearchOptions): Promise<SearchResult> => {
    if (!miniSearch) {
      return { grouped: {}, flat: [] };
    }

    // Parse query and filters
    const { filters, query } = parseQueryForFilters(options.query);

    // Check cache first
    const cacheKey = options.query;
    const cachedResult = sessionStorage.getItem(cacheKey);
    if (cachedResult) {
      return JSON.parse(cachedResult);
    }

    // Perform search
    let results = miniSearch.search(query, {
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
          const documentAuthors = document.authors || [];
          if (
            !filters.authors.some(author =>
              documentAuthors.some((docAuthor: string) =>
                docAuthor.toLowerCase().includes(author.toLowerCase()),
              ),
            )
          ) {
            return false;
          }
        }

        // Filter by tags if specified
        if (filters.tags.length > 0) {
          const documentTags = document.tags || [];
          if (
            !filters.tags.some(tag =>
              documentTags.some((docTag: string) =>
                docTag.toLowerCase().includes(tag.toLowerCase()),
              ),
            )
          ) {
            return false;
          }
        }

        return true;
      },
    });

    // Limit to 10 results
    results = results.slice(0, 10);

    // Add matching lines
    // We need to fetch content for highlighting - this would come from an API
    // For now, we'll just return results without matching lines
    const enrichedResults = await Promise.all(
      results.map(async result => {
        const document = { ...result } as unknown as Document;

        // In a real implementation, you'd fetch the content for highlighting
        // For now, we'll just set a placeholder
        document.matchingLines = query
          ? `...matching content for "${query}"...`
          : '';

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

    return finalResult;
  };

  return (
    <SearchContext.Provider value={{ search, isInitialized, isLoading }}>
      {children}
    </SearchContext.Provider>
  );
};

// Hook to use search context
export const useSearch = () => useContext(SearchContext);

export default SearchProvider;
