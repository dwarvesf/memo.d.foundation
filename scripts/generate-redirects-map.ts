import fs from 'fs/promises';
import path from 'path';
import { DuckDBConnection, DuckDBInstance, DuckDBValue } from '@duckdb/node-api'; // Import Instance, Connection, and Value
// Import the project's own slugify function
import { slugifyPathComponents } from '../src/lib/utils/slugify.js'; // Use .js extension for ES module imports

// Get current directory in ES module scope
// Get project root directory
const PROJECT_ROOT = process.cwd();

const PARQUET_FILE_PATH = path.join(PROJECT_ROOT, 'db/vault.parquet'); // Path to the Parquet file relative to project root
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'public/content/redirects.json'); // Output JSON file path relative to project root

// Define the expected structure of a row after reading specific columns
// Adjust indices based on the actual column order in your Parquet file if needed.
// Define the structure of a row returned by DuckDB
interface DuckDbRowData {
  file_path: string | null;
  short_links: string[] | null;
  previous_paths: string[] | null;
}

/**
 * Formats a file path from the vault into a URL-friendly path.
 * Removes '.md' extension, slugifies path components using the project's logic,
 * and ensures a leading slash.
 * Example: 'Folder Name/File Name.md' -> '/folder-name/file-name'
 */
function formatPathForUrl(filePath: string | null | undefined): string | null {
  if (!filePath) {
    return null;
  }
  // Remove .md extension if present
  const pathWithoutExt = filePath.endsWith('.md')
    ? filePath.slice(0, -3)
    : filePath;

  // Slugify using the project's function
  const slugifiedPath = slugifyPathComponents(pathWithoutExt);

  // Ensure leading slash
  return slugifiedPath.startsWith('/') ? slugifiedPath : `/${slugifiedPath}`;
}

async function generateRedirectsMap() {
  console.log(`Reading Parquet file from ${PARQUET_FILE_PATH} using @duckdb/node-api...`);
  const redirects: Record<string, string> = {};
  let instance: DuckDBInstance | null = null; // Declare instance variable
  let connection: DuckDBConnection | null = null; // Declare connection variable

  try {
    instance = await DuckDBInstance.create(':memory:'); // Create instance first
    connection = await instance.connect(); // Then connect to the instance

    // Check if Parquet file exists
    await fs.access(PARQUET_FILE_PATH);

    // Use DuckDB to read the Parquet file
    // Ensure path separators are forward slashes for DuckDB compatibility
    const parquetPathForDb = PARQUET_FILE_PATH.replace(/\\/g, '/');
    const query = `
      SELECT file_path, short_links, previous_paths
      FROM read_parquet('${parquetPathForDb}');
    `;

    console.log('Executing DuckDB query...');
    // Use runAndReadAll and getRowObjects with the new API
    const reader = await connection.runAndReadAll(query);
    // Assert to unknown first due to DuckDBValue type, then to the desired structure
    const results = reader.getRowObjects() as unknown as DuckDbRowData[];
    console.log(`Processing ${results.length} rows from Parquet file via DuckDB...`);

    for (const row of results) { // Iterate over objects directly
      // Extract primitive values directly
      const filePath = row.file_path;
      // Extract the array from the .items property for list types
      const shortLinks = row.short_links && Array.isArray((row.short_links as any).items) ? (row.short_links as any).items : null;
      const previousPaths = row.previous_paths && Array.isArray((row.previous_paths as any).items) ? (row.previous_paths as any).items : null;


      const currentPathFormatted = formatPathForUrl(filePath);
      if (!currentPathFormatted) {
        console.warn(`Skipping row with invalid file_path: ${filePath}`);
        continue;
      }

      // Process short links
      if (shortLinks && Array.isArray(shortLinks)) {
        for (const shortLink of shortLinks) {
          if (shortLink && typeof shortLink === 'string') {
            const formattedShortLink = shortLink.startsWith('/') ? shortLink : `/${shortLink}`;
            if (redirects[formattedShortLink] && redirects[formattedShortLink] !== currentPathFormatted) {
              console.warn(`Conflict: Short link '${formattedShortLink}' maps to both '${redirects[formattedShortLink]}' and '${currentPathFormatted}'. Overwriting with the latter.`);
            }
            redirects[formattedShortLink] = currentPathFormatted;
          }
        }
      }

      // Process previous paths
      if (previousPaths && Array.isArray(previousPaths)) {
        for (const oldPath of previousPaths) {
          const oldPathFormatted = formatPathForUrl(oldPath);
          if (oldPathFormatted) {
            if (redirects[oldPathFormatted] && redirects[oldPathFormatted] !== currentPathFormatted) {
              console.warn(`Conflict: Old path '${oldPathFormatted}' maps to both '${redirects[oldPathFormatted]}' and '${currentPathFormatted}'. Overwriting with the latter.`);
            }
            redirects[oldPathFormatted] = currentPathFormatted;
          }
        }
      }
    }

    console.log(`Generated ${Object.keys(redirects).length} redirect entries.`);

    // Ensure output directory exists
    const publicDir = path.dirname(OUTPUT_PATH);
    await fs.mkdir(publicDir, { recursive: true });

    // Write the map to the JSON file
    await fs.writeFile(OUTPUT_PATH, JSON.stringify(redirects, null, 2));
    console.log(`Redirects map successfully written to ${OUTPUT_PATH}`);

  } catch (error: any) {
    console.error('Error generating redirects map:', error); // Log the actual error
    if (error.code === 'ENOENT' && error.path === PARQUET_FILE_PATH) {
      console.error(`Error: Parquet file not found at ${PARQUET_FILE_PATH}. Make sure the database export ran successfully.`);
    }
    // Exit with error code if map generation fails
    process.exit(1);
  } finally {
    // Ensure the database connection and instance are closed
    if (connection) {
      connection.closeSync(); // Use closeSync or disconnectSync
      console.log('DuckDB connection closed.');
    }
    // Instance doesn't have a close method in the new API based on docs,
    // rely on connection closing and garbage collection.
  }
}

generateRedirectsMap();
