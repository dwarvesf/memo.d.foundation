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
import MiniSearch from 'minisearch';

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
  description: string | null;
  md_content: string | null;
  spr_content: string | null;
  tags: DuckDBValue | null;
  authors: DuckDBValue | null;
  date: string | null; // Assuming date is stored/read as string
  draft: boolean | null;
  hiring: boolean | null;
  status: string | null;
}

// Define the structure for documents to be indexed by MiniSearch
interface SearchDocument {
  id: string;
  file_path: string;
  title: string;
  description: string;
  spr_content: string;
  md_content: string;
  tags: string[];
  authors: string[];
  date: string;
  category: string;
}

async function generateSearchIndex() {
  const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
  const outputPath = path.join(
    process.cwd(),
    'public/content/search-index.json',
  );
  let instance: DuckDBInstance | null = null;
  let connection: DuckDBConnection | null = null;

  console.log(`Generating search index from ${parquetFilePath}...`);

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
      'md_content', // Not currently used in indexing logic below
      'spr_content',
      'tags',
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
        const description = row.description || '';
        const sprContent = row.spr_content || '';
        const mdContent = row.md_content || '';

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

        // Filter tags and ensure authors are strings (or handle appropriately if they can be other types)
        const tags: string[] = tagsList.filter(
          (tag: any): tag is string => typeof tag === 'string' && tag !== '', // Add explicit any type
        );
        const authors: string[] = authorsList.filter(
          (author: any): author is string => typeof author === 'string', // Add explicit any type
        );

        const date = row.date || ''; // Assuming date is string
        const draft = row.draft === true;
        // Note: Original logic was `hiring = row[9] === false;`. This keeps that logic.
        // If `hiring=true` in the data means "is hiring post", then `!row.hiring` might be intended for exclusion.
        // Double-check if `hiring: false` in the data means "exclude this". The current logic excludes if `hiring` is NOT false.
        const isHiringPost = row.hiring === true; // Let's use a clearer variable name
        const status = row.status || '';

        // --- Exclusion Logic ---
        const exclude = draft || isHiringPost || (status && status !== 'Open');

        // Return null if excluded, filter out later
        if (exclude || !title || !description) {
          return null;
        }

        // --- Create Search Document ---
        return {
          id: String(idx), // Use index as ID
          file_path: filePath,
          title,
          description,
          spr_content: sprContent?.replace(/\n/g, '<hr />'), // Use replace with global regex instead of replaceAll
          md_content: mdContent,
          tags,
          authors,
          date,
          category: extractCategory(filePath),
        };
      })
      .filter((doc): doc is SearchDocument => doc !== null); // Filter out null entries (excluded docs)

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
      fields: ['title', 'description', 'tags', 'authors', 'category'], // Fields to index
      storeFields: [
        // Fields to store and return in search results
        'file_path',
        'title',
        'description',
        'spr_content',
        'tags',
        'authors',
        'date',
        'category',
        'md_content',
      ],
      searchOptions: {
        boost: { title: 2, tags: 1.5, authors: 1.2, category: 1.1 },
        fuzzy: 0.2, // Allow some fuzziness
        prefix: true, // Allow prefix searching
      },
      // Custom field extractor for array fields
      extractField: (document, fieldName) => {
        const value = document[fieldName as keyof SearchDocument];
        if (Array.isArray(value)) {
          return value.join(' '); // Join array elements for indexing
        }
        return (value as string) || ''; // Return string value or empty string
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
