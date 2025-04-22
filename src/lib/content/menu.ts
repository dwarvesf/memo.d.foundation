import fs from 'fs';
import path from 'path';
import { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api'; // Import DuckDB API

// --- Shared DuckDB Connection ---
let sharedDuckDBConnection: DuckDBConnection | null = null;

// --- Slugify Functions (Keep as they are used for URL generation) ---

/**
 * Slugify a string (based on Memo.Common.Slugify.slugify)
 * @param str The string to slugify
 * @returns Slugified string
 */
function slugify(str: string): string {
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
 * Slugify filename (based on Memo.Common.Slugify.slugify_filename)
 * @param filename The filename to slugify
 * @returns Slugified filename with extension preserved
 */
function slugifyFilename(filename: string): string {
  if (!filename) return '';
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  return slugify(name) + ext;
}

/**
 * Slugify path components (based on Memo.Common.Slugify.slugify_path_components)
 * @param pathStr The path to slugify
 * @returns Path with components slugified
 */
export function slugifyPathComponents(pathStr: string): string {
  if (!pathStr) return '';
  return pathStr
    .split('/')
    .map(component => {
      // Keep special directory names
      if (['.', '..', ''].includes(component)) {
        return component;
      }
      // Slugify other components, preserving extension
      return slugifyFilename(component);
    })
    .join('/');
}

// --- Interfaces ---

/**
 * Interface for menu file paths within a group
 */
export interface MenuFilePath {
  file_path: string;
  title: string;
  date: string; // Keep date for sorting
}

/**
 * Interface for grouped path data (menu hierarchy node)
 */
export interface GroupedPath {
  grouped_path: string; // The path of the directory itself
  file_paths: MenuFilePath[]; // Files directly within this directory
  next_path: Record<string, GroupedPath>; // Subdirectories
}

// --- Helper Functions for Menu Generation ---

/**
 * Nest paths to create a hierarchical menu structure
 * @param data Array of grouped paths with their files
 * @returns Nested object representing menu hierarchy
 */
function nestPaths(
  data: { grouped_path: string; file_paths: MenuFilePath[] }[],
): Record<string, GroupedPath> {
  const result: Record<string, GroupedPath> = {};

  data.forEach(item => {
    const paths = item.grouped_path.split('/').filter((p: string) => p); // Get directory components
    let currentLevel = result;

    paths.forEach((pathPart: string, index: number) => {
      if (!currentLevel[pathPart]) {
        currentLevel[pathPart] = {
          // Path up to this level
          grouped_path: '/' + paths.slice(0, index + 1).join('/'),
          file_paths: [], // Initialize files for this level
          next_path: {}, // Initialize subdirectories
        };
      }

      // If this is the last part of the path, assign the files
      if (index === paths.length - 1) {
        currentLevel[pathPart].file_paths = item.file_paths;
        // Sort file_paths: special characters first, then by date descending
        currentLevel[pathPart].file_paths.sort((a, b) => {
          const specialChars = /^[§¶&]/; // Regex for special starting characters
          const aHasSpecial = specialChars.test(a.title);
          const bHasSpecial = specialChars.test(b.title);

          if (aHasSpecial && !bHasSpecial) return -1; // a comes first
          if (!aHasSpecial && bHasSpecial) return 1; // b comes first
          // If both or neither have special chars, sort by date descending
          try {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA; // Newer first
          } catch {
            // Removed unused 'e' variable
            return 0; // Keep order if dates are invalid
          }
        });
      }
      // Move to the next level in the hierarchy
      currentLevel = currentLevel[pathPart].next_path;
    });
  });

  // Recursively sort the keys (directory names) at each level
  return sortGroupedPaths(result);
}

/**
 * Sort the grouped paths alphabetically at each level
 * @param obj Object containing grouped paths
 * @returns Sorted object
 */
function sortGroupedPaths(
  obj: Record<string, GroupedPath>,
): Record<string, GroupedPath> {
  // Sort keys alphabetically
  const sortedKeys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  const sortedObj: Record<string, GroupedPath> = {};

  sortedKeys.forEach(key => {
    sortedObj[key] = obj[key];
    // Recursively sort subdirectories if they exist
    if (Object.keys(sortedObj[key].next_path).length > 0) {
      sortedObj[key].next_path = sortGroupedPaths(sortedObj[key].next_path);
    }
  });

  return sortedObj;
}

// --- DuckDB Connection Helper ---

// Modified to use a shared connection
async function connectDuckDB(): Promise<DuckDBConnection> {
  if (sharedDuckDBConnection) {
    return sharedDuckDBConnection;
  }

  const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
  if (!fs.existsSync(parquetFilePath)) {
    throw new Error(`Parquet file not found: ${parquetFilePath}`);
  }
  // Instance is created internally but not returned if not needed
  const instance = await DuckDBInstance.create(':memory:'); // Instance is created here
  const connection = await instance.connect();
  sharedDuckDBConnection = connection; // Store the connection

  // Consider managing instance lifecycle if needed elsewhere, but for these functions, connection is sufficient
  return connection;
}

// --- Data Fetching Functions ---

// Define structure for rows read from DuckDB for getMenu
interface MenuDbRow {
  file_path: string | null;
  short_title: string | null;
  title: string | null;
  date: string | null; // Assuming date is stored/read as string
  draft: boolean | null;
  hiring: boolean | null;
  status: string | null;
  hide_on_sidebar: boolean | null;
}

/**
 * Get menu data from the parquet database using DuckDB
 * @returns Promise resolving to menu structure
 */
export async function getMenu(): Promise<Record<string, GroupedPath>> {
  let connection: DuckDBConnection | null = null;

  try {
    connection = await connectDuckDB(); // Get the shared connection
    const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet'); // Needed for query
    const parquetPathForDb = parquetFilePath.replace(/\\/g, '/');

    const columnsToSelect = [
      'file_path',
      'short_title',
      'title',
      'date',
      'draft',
      'hiring',
      'status',
      'hide_on_sidebar',
    ];
    // Filter directly in SQL for efficiency
    const query = `
      SELECT ${columnsToSelect.join(', ')}
      FROM read_parquet('${parquetPathForDb}')
      WHERE
        title IS NOT NULL AND title != '' AND
        draft IS NOT TRUE AND
        hiring IS NOT TRUE AND -- Assuming hiring=true means exclude
        hide_on_sidebar IS NOT TRUE AND
        (status IS NULL OR status = 'Open') AND
        NOT file_path LIKE '%archived/%' AND
        NOT file_path LIKE '%_radar/%';
    `;

    const reader = await connection.runAndReadAll(query);
    const results = reader.getRowObjects() as unknown as MenuDbRow[];

    // Create a map to collect file paths by grouped path (directory)
    const groupedPathMap = new Map<string, MenuFilePath[]>();

    results.forEach(row => {
      const filePath = row.file_path || '';
      const shortTitle = row.short_title || '';
      const title = row.title || ''; // Already filtered non-empty titles in SQL
      const date = row.date || ''; // Use empty string if null

      // Extract grouped path (parent directory)
      let groupedPath = '';
      const lastSlashPos = filePath.lastIndexOf('/');
      // Ensure it's not the root directory itself and has a parent
      if (lastSlashPos > 0) {
        groupedPath = filePath.substring(0, lastSlashPos);
      } else if (lastSlashPos === 0) {
        groupedPath = '/'; // Handle files directly under root if needed, though likely not for menu
      } else {
        groupedPath = '/'; // Files without a slash are considered root
      }

      if (groupedPath) {
        const filePathObj: MenuFilePath = {
          file_path: filePath,
          title: shortTitle || title, // Prefer short_title if available
          date: date, // Store date for sorting
        };

        // Add to grouped path map
        if (!groupedPathMap.has(groupedPath)) {
          groupedPathMap.set(groupedPath, []);
        }
        groupedPathMap.get(groupedPath)!.push(filePathObj);
      }
    });

    // Convert map to array format expected by nestPaths
    const parsedData = Array.from(groupedPathMap.entries()).map(
      ([grouped_path, file_paths]) => ({
        grouped_path,
        file_paths,
      }),
    );

    // Sort groups by path descending before nesting (optional, might affect final order)
    // parsedData.sort((a, b) => b.grouped_path.localeCompare(a.grouped_path));

    // Nest the paths to create menu structure
    const menuData = nestPaths(parsedData);
    return menuData;
  } catch (error) {
    console.error('Error generating menu:', error);
    return {}; // Return empty object on error
  }
  // Removed finally block to keep connection open
}

// Define structure for rows read from DuckDB for getPinnedNotes
interface PinnedNoteDbRow {
  file_path: string | null;
  title: string | null;
  date: string | null; // Assuming date is stored/read as string
  pinned: boolean | null;
}

/**
 * Get pinned notes from the parquet database using DuckDB
 * @param limit Number of pinned notes to return
 * @returns Promise resolving to array of pinned notes
 */
export async function getPinnedNotes(
  limit: number = 3,
): Promise<{ title: string; url: string; date: string }[]> {
  let connection: DuckDBConnection | null = null;

  try {
    connection = await connectDuckDB(); // Get the shared connection
    const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
    const parquetPathForDb = parquetFilePath.replace(/\\/g, '/');

    // Use SQL for filtering, ordering, and limiting
    const query = `
      SELECT file_path, title, date
      FROM read_parquet('${parquetPathForDb}')
      WHERE
        pinned = true AND
        title IS NOT NULL AND title != ''
      ORDER BY date DESC
      LIMIT ${limit};
    `;

    // Execute the query directly without a prepared statement
    const reader = await connection.runAndReadAll(query);
    const results = reader.getRowObjects() as unknown as PinnedNoteDbRow[];

    const pinnedNotes = results.map(row => {
      const filePath = row.file_path || '';
      const title = row.title || ''; // Already filtered non-empty in SQL
      const date = String(row.date || ''); // Explicitly convert date to string

      // Slugify the path for URL generation
      const slugifiedPath = slugifyPathComponents(filePath);

      // Create URL (remove .md extension if present)
      const url =
        '/' +
        (slugifiedPath.endsWith('.md')
          ? slugifiedPath.slice(0, -3)
          : slugifiedPath);

      return { title, url, date };
    });

    return pinnedNotes; // Already sorted and limited by SQL
  } catch (error) {
    console.error('Error fetching pinned notes:', error);
    return []; // Return empty array on error
  }
  // Removed finally block to keep connection open
}

/**
 * Get all unique tags from the parquet database using DuckDB
 * @returns Promise resolving to array of tags sorted alphabetically
 */
export async function getTags(): Promise<string[]> {
  let connection: DuckDBConnection | null = null;

  try {
    connection = await connectDuckDB(); // Get the shared connection
    const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
    const parquetPathForDb = parquetFilePath.replace(/\\/g, '/');

    // Use UNNEST and DISTINCT directly in SQL for efficiency
    const query = `
      SELECT DISTINCT unnest(tags) AS tag
      FROM read_parquet('${parquetPathForDb}')
      WHERE tags IS NOT NULL
      ORDER BY tag ASC;
    `;

    const reader = await connection.runAndReadAll(query);
    // getRows returns array of arrays, e.g., [[tag1], [tag2]]
    const results = reader.getRows() as string[][];

    // Extract the tag from each inner array
    const tags = results.map(row => row[0]).filter(tag => tag); // Filter out any potential null/empty tags just in case

    return tags; // Already unique and sorted by SQL
  } catch (error) {
    console.error('Error fetching tags:', error);
    return []; // Return empty array on error
  }
  // Removed finally block to keep connection open
}
