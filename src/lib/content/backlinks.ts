import fs from 'fs';
import path from 'path';
import { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api'; // Import DuckDB API
import { IBackLinkItem } from '@/types';
import { getMarkdownMetadata } from './markdown'; // Keep this for title fallback

// --- Slugify Functions (Copied from menu.ts for consistency, keep if not imported from elsewhere) ---

/**
 * Slugify a string
 */
export function slugify(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '') // Remove invalid chars
    .replace(/\s+/g, '-') // Collapse whitespace to single dashes
    .replace(/-+/g, '-') // Collapse multiple dashes
    .trim() // Trim leading/trailing spaces/dashes
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing dashes
}

/**
 * Slugify filename
 */
export function slugifyFilename(filename: string): string {
  if (!filename) return '';
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  return slugify(name) + ext;
}

/**
 * Slugify path components
 */
export function slugifyPathComponents(pathStr: string): string {
  if (!pathStr) return '';
  return pathStr
    .split('/')
    .map(component => {
      if (['.', '..', ''].includes(component)) {
        return component;
      }
      return slugifyFilename(component);
    })
    .join('/');
}

// --- DuckDB Connection Helper (Reusing pattern from menu.ts) ---

async function connectDuckDB(): Promise<DuckDBConnection> {
  const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
  if (!fs.existsSync(parquetFilePath)) {
    throw new Error(`Parquet file not found: ${parquetFilePath}`);
  }
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  return connection;
}

// --- Backlinks Function ---

// Define structure for rows read from DuckDB for getBacklinks
interface BacklinkDbRow {
  file_path: string | null;
  md_content: string | null;
  title: string | null;
  description: string | null; // Keep description if needed for filtering/context, though not used in final output
}

/**
 * Queries the parquet database using DuckDB for backlinks to a specific page
 * @param slug The slug array of the current page (e.g., ['guide', 'getting-started'])
 * @returns Array of backlink items
 */
export async function getBacklinks(slug: string[]): Promise<IBackLinkItem[]> {
  let connection: DuckDBConnection | null = null;
  const targetFullPath = slug.join('/'); // e.g., "guide/getting-started"
  console.log(`Fetching backlinks for: /${targetFullPath}`);

  try {
    connection = await connectDuckDB();
    const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
    const parquetPathForDb = parquetFilePath.replace(/\\/g, '/');

    // Prepare patterns for SQL query (use LIKE for broader matching)
    // Pattern 1: Link to the full path (e.g., /guide/getting-started)
    const fullPathPattern = `%/${targetFullPath}%`;
    // Pattern 2: Link using just the final slug (e.g., #getting-started or /getting-started)
    // Need to be careful with simple slug matching to avoid false positives.
    // Let's focus on full path links for now, as they are less ambiguous.
    // A more robust solution might involve parsing markdown links properly.
    // For simplicity, we'll stick to full path matching in content for this version.
    // Consider adding title/description checks if needed, but content is primary.

    // Filter directly in SQL for efficiency
    const query = `
      SELECT file_path, title, description, md_content
      FROM read_parquet('${parquetPathForDb}')
      WHERE
        md_content LIKE ? AND -- Match links to the full path
        file_path != ? AND -- Exclude self-references
        title IS NOT NULL AND title != '' AND
        description IS NOT NULL AND description != ''; -- Ensure basic content validity
    `;

    console.log('Executing DuckDB query for backlinks...');
    const preparedStatement = await connection.prepare(query);
    // Bind the pattern and the file path to exclude self-references
    preparedStatement.bind([fullPathPattern, `${targetFullPath}.md`]); // Assuming target file ends with .md
    const reader = await preparedStatement.runAndReadAll();
    const results = reader.getRowObjects() as unknown as BacklinkDbRow[];
    console.log(`Retrieved ${results.length} potential backlink rows from Parquet file.`);

    const backlinks = results.map(row => {
      const filePath = row.file_path || '';
      const titleFromParquet = row.title || ''; // Already filtered non-empty

      // Slugify the path components for the URL
      const slugifiedPath = slugifyPathComponents(filePath);

      // Remove .md extension from the output path
      let finalPath = slugifiedPath.endsWith('.md')
        ? slugifiedPath.slice(0, -3)
        : slugifiedPath;

      // Remove trailing /readme if present
      if (finalPath.endsWith('/readme')) {
        finalPath = finalPath.slice(0, -'/readme'.length);
      }
      // Ensure leading slash
      if (!finalPath.startsWith('/')) {
        finalPath = '/' + finalPath;
      }


      // Fallback title logic (less critical now as we filter on title in SQL)
      const calculatedTitle =
        getMarkdownMetadata(filePath).title || // Check actual file metadata
        finalPath.split('/').pop() || // Use final segment of path
        finalPath; // Fallback to full path

      return {
        title: titleFromParquet || calculatedTitle, // Prefer title from DB
        path: finalPath,
      };
    });

    // Deduplicate based on path
    const uniqueBacklinks = Array.from(new Map(backlinks.map(item => [item.path, item])).values());

    console.log(`Found ${uniqueBacklinks.length} unique backlinks.`);
    return uniqueBacklinks;

  } catch (error) {
    console.error('Error fetching backlinks:', error);
    return []; // Return empty array on error
  } finally {
    if (connection) {
      connection.closeSync();
      console.log('DuckDB connection for backlinks closed.');
    }
  }
}
