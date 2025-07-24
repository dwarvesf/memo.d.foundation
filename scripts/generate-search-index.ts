/**
 * Search index generation script
 * Using ES module format as per package.json "type": "module"
 * @packageDocumentation
 */

import fs from 'fs';
import path from 'path';
import {
  DuckDBConnection,
  DuckDBInstance,
  DuckDBValue,
} from '@duckdb/node-api'; // Import DuckDB API
import { slugifyPathComponents } from '../src/lib/utils/slugify.js';
import MiniSearch from 'minisearch';
import { normalizePathWithSlash } from './common.js';

/**
 * Extract paths from file path to create category
 * @param filePath File path
 * @returns Category string
 */
function extractCategory(filePath: string): string {
  if (!filePath) return '';
  const parts = filePath.split('/');
  parts.pop(); // Remove the file name
  return parts.join(' > ');
}

// Define the structure for rows returned by DuckDB getRowObjects()
// Note: List types are wrapped in DuckDBValue objects
interface DuckDbQueryResultRow {
  file_path: string | null;
  title: string | null;
  short_title?: string | null;
  description: string | null;
  md_content: string | null;
  spr_content: string | null;
  tags: DuckDBValue | null;
  authors: DuckDBValue | null;
  keywords?: DuckDBValue | null;
  date: string | null; // Assuming date is stored/read as string
  draft: boolean | null;
  hiring: boolean | null;
  status: string | null;
}

// Define the structure for documents to be indexed by MiniSearch
export interface SearchDocument {
  id: string;
  file_path: string;
  web_path: string;
  title: string;
  short_title: string;
  description: string;
  spr_content: string;
  tags: string[];
  authors: string[];
  keywords: string[];
  date: string;
  category: string;
}

function transformWebPath(
  filePath: string,
  staticPaths: Record<string, string>,
): string {
  const originalFilePath = filePath;
  // Remove /readme, /_index suffixes with optional .md and case-insensitive
  const suffixRegex = /\/(readme|_index)(\.md)?$/i;
  const cleanedPath = originalFilePath.replace(suffixRegex, '');

  // Use the slugifyPathComponents function from backlinks.ts
  let slugifiedPath = slugifyPathComponents(cleanedPath);

  // If the slugifiedPath path ended with .md, remove the extension from the slugified path
  if (slugifiedPath.endsWith('.md')) {
    slugifiedPath = slugifiedPath.slice(0, -3); // Remove .md extension
  }
  // Check if the slugified path exists in static paths
  return (
    staticPaths[normalizePathWithSlash(slugifiedPath)] ||
    normalizePathWithSlash(slugifiedPath)
  );
}

async function generateSearchIndex() {
  const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
  const outputPath = path.join(
    process.cwd(),
    'public/content/search-index.json',
  );
  let instance: DuckDBInstance | null = null;
  let connection: DuckDBConnection | null = null;
  let staticJSONPaths: Record<string, string> = {};

  console.log(`Generating search index from ${parquetFilePath}...`);

  const staticJsonPath = path.join(
    process.cwd(),
    'public/content/static-paths.json',
  );

  if (fs.existsSync(staticJsonPath)) {
    try {
      const jsonData = fs.readFileSync(staticJsonPath, 'utf-8');
      const parsedPaths = JSON.parse(jsonData) as Record<string, string>;
      staticJSONPaths = Object.fromEntries(
        Object.entries(parsedPaths).map(([key, value]) => [value, key]),
      );
    } catch (error) {
      console.error('Error reading static paths JSON:', error);
    }
  }

  try {
    if (!fs.existsSync(parquetFilePath)) {
      console.error('Error: Parquet file not found:', parquetFilePath);
      process.exit(1);
    }

    instance = await DuckDBInstance.create(':memory:');
    connection = await instance.connect();
    console.log('DuckDB connection established.');

    const parquetPathForDb = parquetFilePath.replace(/\\/g, '/');
    const columnsToSelect = [
      'file_path',
      'title',
      'description',
      'short_title',
      // 'md_content', // Not currently used in indexing logic below
      'spr_content',
      'tags',
      'keywords',
      'authors',
      'date',
      'draft',
      'hiring',
      'status',
    ];
    const query = `SELECT ${columnsToSelect.join(', ')} FROM read_parquet('${parquetPathForDb}');`;

    console.log('Executing DuckDB query for search index data...');
    const reader = await connection.runAndReadAll(query);
    // Type assertion needed because getRowObjects returns Record<string, DuckDBValue>
    const results = reader.getRowObjects() as unknown as DuckDbQueryResultRow[];
    console.log(
      `Retrieved ${results.length} rows from Parquet file via DuckDB.`,
    );

    const searchDocuments: SearchDocument[] = results
      .map((row, idx) => {
        // --- Data Extraction and Transformation ---
        const filePath = row.file_path || '';
        const title = row.title || '';
        const shortTitle = row.short_title || '';
        const description = row.description || '';
        const sprContent = row.spr_content || '';

        // Extract items from DuckDBValue for list types, ensuring they are arrays
        const tagsList =
          row.tags &&
          (row.tags as any).items &&
          Array.isArray((row.tags as any).items)
            ? (row.tags as any).items
            : [];
        const authorsList =
          row.authors &&
          (row.authors as any).items &&
          Array.isArray((row.authors as any).items)
            ? (row.authors as any).items
            : [];
        const keywordsList =
          row.keywords &&
          (row.keywords as any).items &&
          Array.isArray((row.keywords as any).items)
            ? (row.keywords as any).items
            : [];

        // Filter tags, authors, keywords as strings
        const tags: string[] = tagsList.filter(
          (tag: any): tag is string => typeof tag === 'string' && tag !== '',
        );
        const authors: string[] = authorsList.filter(
          (author: any): author is string => typeof author === 'string',
        );
        const keywords: string[] = keywordsList.filter(
          (kw: any): kw is string => typeof kw === 'string' && kw !== '',
        );

        const date = row.date || '';
        const draft = row.draft === true;
        const isHiringPost = row.hiring === true;
        const status = row.status || '';

        // --- Exclusion Logic ---
        const exclude = draft || isHiringPost || (status && status !== 'Open');

        // Return null if excluded, filter out later
        if (exclude || (!title && !shortTitle)) {
          return null;
        }

        // --- Create Search Document ---
        return {
          id: String(idx),
          file_path: filePath,
          web_path: transformWebPath(filePath, staticJSONPaths),
          title,
          short_title: shortTitle,
          description,
          spr_content: sprContent?.replace(/\n/g, '<hr />'),
          tags,
          authors,
          keywords,
          date,
          category: extractCategory(filePath),
        };
      })
      .filter((doc): doc is SearchDocument => doc !== null);

    console.log(
      `Filtered down to ${searchDocuments.length} documents for indexing.`,
    );

    if (searchDocuments.length === 0) {
      console.warn(
        'Warning: No documents to index after filtering. Check exclusion logic and data source.',
      );
      // Write an empty index file
      fs.writeFileSync(outputPath, JSON.stringify({ index: {} }));
      console.log(`Empty search index generated at: ${outputPath}`);
      return; // Exit early as there's nothing to index
    }

    // --- MiniSearch Indexing ---
    console.log('Initializing MiniSearch...');
    const miniSearch = new MiniSearch<SearchDocument>({
      fields: [
        'title',
        'short_title',
        'description',
        'tags',
        'authors',
        'category',
        'keywords',
        'spr_content',
      ], // Fields to index (now includes spr_content and keywords)
      storeFields: [
        'file_path',
        'web_path',
        'title',
        'short_title',
        'description',
        'spr_content',
        'tags',
        'authors',
        'keywords',
        'date',
        'category',
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
      extractField: (document, fieldName) => {
        const value = document[fieldName as keyof SearchDocument];
        if (Array.isArray(value)) {
          return value.join(' ');
        }
        return (value as string) || '';
      },
    });

    console.log('Adding documents to MiniSearch index...');
    miniSearch.addAll(searchDocuments);
    console.log('MiniSearch indexing complete.');

    // --- Output ---
    // Create the output directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      console.log(`Creating output directory: ${outputDir}`);
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Writing search index to ${outputPath}...`);
    // Write the serialized index to the JSON file
    fs.writeFileSync(
      outputPath,
      JSON.stringify({
        index: miniSearch.toJSON(), // Serialize the index itself
      }),
    );

    console.log(`Search index successfully generated at: ${outputPath}`);
  } catch (error) {
    console.error('Error generating search index:', error);
    process.exit(1); // Exit with error on failure
  } finally {
    // Ensure the database connection is closed
    if (connection) {
      connection.closeSync();
      console.log('DuckDB connection closed.');
    }
    // Instance cleanup seems automatic or handled by connection closing in the new API
    console.log('Search index generation script finished.');
  }
}

// Run the function
generateSearchIndex();
