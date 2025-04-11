import fs from 'fs/promises';
import path from 'path';
import duckdb from 'duckdb';

const DB_PATH = path.resolve(__dirname, '../../db/vault.db'); // Path to the DuckDB database file
const OUTPUT_PATH = path.resolve(__dirname, '../../public/redirects.json'); // Output JSON file path

interface VaultRow {
  file_path: string;
  short_links: string[] | null;
  previous_paths: string[] | null;
}

/**
 * Formats a file path from the vault into a URL-friendly path.
 * Removes '.md' extension and ensures a leading slash.
 * Example: 'folder/file.md' -> '/folder/file'
 */
function formatPathForUrl(filePath: string | null | undefined): string | null {
  if (!filePath) {
    return null;
  }
  // Remove .md extension if present
  const pathWithoutExt = filePath.endsWith('.md')
    ? filePath.slice(0, -3)
    : filePath;

  // Ensure leading slash
  return pathWithoutExt.startsWith('/') ? pathWithoutExt : `/${pathWithoutExt}`;
}

async function generateRedirectsMap() {
  console.log(`Connecting to DuckDB at ${DB_PATH}...`);
  const db = new duckdb.Database(DB_PATH, { access_mode: 'READ_ONLY' }); // Read-only access
  const con = db.connect();

  const redirects: Record<string, string> = {};

  try {
    console.log('Querying vault table for redirects...');
    // Query for entries with either short_links or previous_paths
    // Note: DuckDB array functions like array_length might require specific syntax or extensions.
    // Using a simpler check for non-null values first. Adjust query if needed.
    const query = `
      SELECT
        file_path,
        short_links,
        previous_paths
      FROM vault
      WHERE short_links IS NOT NULL OR previous_paths IS NOT NULL;
    `;

    // Fix TS error by casting to unknown first
    const results = (await con.all(query)) as unknown as VaultRow[];
    console.log(`Found ${results.length} entries with potential redirects.`);

    for (const row of results) {
      const currentPathFormatted = formatPathForUrl(row.file_path);
      if (!currentPathFormatted) {
        console.warn(`Skipping row with invalid file_path: ${row.file_path}`);
        continue;
      }

      // Process short links
      if (row.short_links && Array.isArray(row.short_links)) {
        for (const shortLink of row.short_links) {
          if (shortLink && typeof shortLink === 'string') {
            // Assume short links are already URL-path like, ensure leading slash if missing
            const formattedShortLink = shortLink.startsWith('/') ? shortLink : `/${shortLink}`;
            if (redirects[formattedShortLink] && redirects[formattedShortLink] !== currentPathFormatted) {
              console.warn(`Conflict: Short link '${formattedShortLink}' maps to both '${redirects[formattedShortLink]}' and '${currentPathFormatted}'. Overwriting with the latter.`);
            }
            redirects[formattedShortLink] = currentPathFormatted;
          }
        }
      }

      // Process previous paths
      if (row.previous_paths && Array.isArray(row.previous_paths)) {
        for (const oldPath of row.previous_paths) {
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

    // Write the map to the JSON file
    await fs.writeFile(OUTPUT_PATH, JSON.stringify(redirects, null, 2));
    console.log(`Redirects map successfully written to ${OUTPUT_PATH}`);

  } catch (error) {
    console.error('Error generating redirects map:', error);
  } finally {
    console.log('Closing DuckDB connection...');
    con.close();
    db.close();
  }
}

generateRedirectsMap();
