import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { asyncBufferFromFile, parquetRead } from 'hyparquet';
import slugifyLib from 'slugify'; // Import with a different name

// Use the default export if available, otherwise use the library itself
const slugify = (slugifyLib as any).default || slugifyLib;

// Get current directory in ES module scope
// Get project root directory
const PROJECT_ROOT = process.cwd();

const PARQUET_FILE_PATH = path.join(PROJECT_ROOT, 'db/vault.parquet'); // Path to the Parquet file relative to project root
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'public/redirects.json'); // Output JSON file path relative to project root

// Define the expected structure of a row after reading specific columns
// Adjust indices based on the actual column order in your Parquet file if needed.
// Assuming order: file_path (0), short_links (1), previous_paths (2)
type ParquetRowData = [
  string | null, // file_path
  string[] | null, // short_links
  string[] | null, // previous_paths
];

/**
 * Formats a file path from the vault into a URL-friendly path.
 * Removes '.md' extension, slugifies each part, and ensures a leading slash.
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

  // Split path into parts, slugify each part, and rejoin
  const slugifiedParts = pathWithoutExt
    .split('/')
    .map(part => slugify(part, { lower: true, strict: true })); // Apply slugify options

  const slugifiedPath = slugifiedParts.join('/');

  // Ensure leading slash
  return slugifiedPath.startsWith('/') ? slugifiedPath : `/${slugifiedPath}`;
}

async function generateRedirectsMap() {
  console.log(`Reading Parquet file from ${PARQUET_FILE_PATH}...`);
  const redirects: Record<string, string> = {};

  try {
    // Check if Parquet file exists
    await fs.access(PARQUET_FILE_PATH);

    await parquetRead({
      file: await asyncBufferFromFile(PARQUET_FILE_PATH),
      columns: ['file_path', 'short_links', 'previous_paths'], // Specify columns to read
      onComplete: data => {
        console.log(`Processing ${data.length} rows from Parquet file...`);
        for (const row of data as ParquetRowData[]) {
          const filePath = row[0];
          const shortLinks = row[1];
          const previousPaths = row[2];

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
      },
    });

    console.log(`Generated ${Object.keys(redirects).length} redirect entries.`);

    // Ensure public directory exists
    const publicDir = path.dirname(OUTPUT_PATH);
    await fs.mkdir(publicDir, { recursive: true });

    // Write the map to the JSON file
    await fs.writeFile(OUTPUT_PATH, JSON.stringify(redirects, null, 2));
    console.log(`Redirects map successfully written to ${OUTPUT_PATH}`);

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.error(`Error: Parquet file not found at ${PARQUET_FILE_PATH}. Make sure 'make duckdb-export-all' ran successfully.`);
    } else {
      console.error('Error generating redirects map:', error);
    }
    // Exit with error code if map generation fails
    process.exit(1);
  }
}

generateRedirectsMap();
