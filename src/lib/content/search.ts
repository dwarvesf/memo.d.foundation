import fs from 'fs';
import path from 'path';
import { asyncBufferFromFile, parquetRead } from 'hyparquet';
import MiniSearch from 'minisearch';
import { IMiniSearchIndex } from '@/types';

// Types
interface Document {
  id: string;
  file_path: string;
  title: string;
  description: string;
  authors?: string[];
  tags?: string[];
  md_content: string;
  spr_content?: string;
  category?: string;
  date?: string;
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

// Helper functions
/**
 * Extract paths from file path to create category
 * @param filePath File path
 * @returns Category string
 */
function extractCategory(filePath: string): string {
  const parts = filePath.split('/');
  parts.pop(); // Remove the file name
  return parts.join(' > ');
}

/**
 * Get matching lines from content based on search query
 * @param content Content to search in
 * @param pattern Search pattern
 * @returns Highlighted matching lines
 */
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

/**
 * Convert Markdown to plain text
 * @param markdown Markdown content
 * @returns Plain text
 */
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

/**
 * Parse search query for filters
 * @param query Search query
 * @returns Filters and cleaned query
 */
function parseQueryForFilters(query: string): {
  filters: { authors: string[]; tags: string[]; title: string };
  query: string;
} {
  const filters: { authors: string[]; tags: string[]; title: string } = {
    authors: [],
    tags: [],
    title: '',
  };

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

/**
 * Group search results by category
 * @param results Search results
 * @returns Grouped results
 */
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

// Main search functionality
let miniSearch: MiniSearch<Document> | null = null;
let searchIndex: Document[] = [];

/**
 * Initialize search index from parquet file
 */
export async function initializeSearchIndex(): Promise<void> {
  if (miniSearch) return; // Already initialized

  try {
    const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
    if (fs.existsSync(parquetFilePath)) {
      await parquetRead({
        file: await asyncBufferFromFile(parquetFilePath),
        columns: [
          'file_path',
          'title',
          'description',
          'md_content',
          'spr_content',
          'tags',
          'authors',
          'date',
          'draft',
          'hiring',
          'status',
        ],
        onComplete: data => {
          searchIndex = data
            .map((row, idx) => {
              const filePath = row[0]?.toString() || '';
              const title = row[1]?.toString() || '';
              const description = row[2]?.toString() || '';
              const mdContent = row[3]?.toString() || '';
              const sprContent = row[4]?.toString() || '';
              const tags = Array.isArray(row[5])
                ? (row[5] as string[]).filter(
                    tag => tag !== null && tag !== undefined && tag !== '',
                  )
                : [];
              const authors = Array.isArray(row[6]) ? (row[6] as string[]) : [];
              const date = row[7]?.toString() || '';
              const draft = row[8] === true;
              const hiring = row[9] === false;
              const status = row[10]?.toString() || '';

              return {
                id: String(idx),
                file_path: filePath,
                title,
                description,
                md_content: mdContent,
                spr_content: sprContent?.replaceAll('\n', '<hr />'),
                tags,
                authors,
                date,
                category: extractCategory(filePath),
                // Exclude items that should be filtered out
                _exclude: draft || hiring || (status && status !== 'Open'),
              };
            })
            .filter(doc => !doc._exclude && doc.title && doc.description);

          // Initialize MiniSearch
          miniSearch = new MiniSearch({
            fields: ['title', 'description', 'md_content', 'tags', 'authors'],
            storeFields: [
              'file_path',
              'title',
              'description',
              'md_content',
              'spr_content',
              'tags',
              'authors',
              'date',
              'category',
            ],
            searchOptions: {
              boost: { title: 2, tags: 1.5, authors: 1.2 },
              fuzzy: 0.2,
              prefix: true,
            },
            extractField: (document: Document, fieldName: string) => {
              if (fieldName === 'tags' && Array.isArray(document.tags)) {
                return document.tags
                  .filter(
                    tag => tag !== null && tag !== undefined && tag !== '',
                  )
                  .join(' ');
              }
              if (fieldName === 'authors' && Array.isArray(document.authors)) {
                return document.authors.join(' ');
              }
              // @ts-expect-error any type
              return document[fieldName] || '';
            },
          });

          // Add documents to index
          miniSearch.addAll(searchIndex);
        },
      });
    }
  } catch (error) {
    console.error('Error initializing search index:', error);
  }
}

/**
 * Search documents with filtering and highlighting
 * @param options Search options including query and filters
 * @returns Search results grouped by category
 */
export async function search(options: SearchOptions): Promise<SearchResult> {
  // Initialize if needed
  if (!miniSearch) {
    await initializeSearchIndex();
  }

  if (!miniSearch) {
    return { grouped: {}, flat: [] };
  }

  // Parse query and filters
  const { filters, query } = parseQueryForFilters(options.query);

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

  // Add matching lines and prepare result structure
  const enrichedResults = results.map(result => {
    const document = { ...result } as unknown as Document;
    document.matchingLines = getMatchingLines(document.md_content, query);
    return document;
  });

  // Group results by category
  const grouped = groupResultsByCategory(enrichedResults);

  return {
    grouped,
    flat: enrichedResults,
  };
}

/**
 * Get full document by file path
 * @param filePath Path to the file
 * @returns Document or null if not found
 */
export function getDocumentByPath(filePath: string): Document | null {
  if (!searchIndex.length) {
    return null;
  }

  return searchIndex.find(doc => doc.file_path === filePath) || null;
}

/**
 * Export search index for client-side use
 * @returns Search index data
 */
export function getSerializableSearchIndex(): IMiniSearchIndex | null {
  if (!miniSearch) {
    return null;
  }

  return {
    index: miniSearch.toJSON(),
    documents: searchIndex.map(doc => ({
      id: doc.id,
      file_path: doc.file_path,
      title: doc.title,
      description: doc.description,
      tags: doc.tags,
      authors: doc.authors,
      date: doc.date,
      category: doc.category,
    })),
  };
}
