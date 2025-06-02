import fs from 'fs/promises';
import path from 'path';
import {
  DuckDBConnection,
  DuckDBInstance,
  DuckDBValue,
} from '@duckdb/node-api'; // Import Instance, Connection, and Value
import yaml from 'js-yaml';
// Import the project's own slugify function
import { slugifyPathComponents } from '../src/lib/utils/slugify.js'; // Use .js extension for ES module imports

// Get current directory in ES module scope
// Get project root directory
const PROJECT_ROOT = process.cwd();
const VAULT_PATH = path.join(PROJECT_ROOT, 'vault'); // Path to the vault directory

const PARQUET_FILE_PATH = path.join(PROJECT_ROOT, 'db/vault.parquet'); // Path to the Parquet file relative to project root
const REDIRECTS_OUTPUT_PATH = path.join(
  PROJECT_ROOT,
  'public/content/redirects.json',
); // Output JSON file path relative to project root
const ALIASES_OUTPUT_PATH = path.join(
  PROJECT_ROOT,
  'public/content/aliases.json',
); // Output JSON file path for aliases

// Define the expected structure of a row after reading specific columns
// Adjust indices based on the actual column order in your Parquet file if needed.
// Define the structure of a row returned by DuckDB
interface DuckDbRowData {
  file_path: string | null;
  aliases: string[] | null;
  previous_paths: string[] | null;
}

interface YamlConfig {
  aliases?: string[];
  redirects?: Record<string, string>; // Although not in the current plan, adding for future flexibility
}

/**
 * Recursively finds all .config.yaml files within a directory.
 */
async function findConfigFiles(dir: string): Promise<string[]> {
  let configFiles: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Exclude .git directories
        if (entry.name !== '.git') {
          configFiles = configFiles.concat(await findConfigFiles(fullPath));
        }
      } else if (
        entry.isFile() &&
        (entry.name === '.config.yaml' || entry.name === '.config.yml')
      ) {
        configFiles.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  return configFiles;
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
  console.log(
    `Reading Parquet file from ${PARQUET_FILE_PATH} using @duckdb/node-api...`,
  );
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
      SELECT file_path, aliases, previous_paths
      FROM read_parquet('${parquetPathForDb}');
    `;

    console.log('Executing DuckDB query...');
    // Use runAndReadAll and getRowObjects with the new API
    const reader = await connection.runAndReadAll(query);
    // Assert to unknown first due to DuckDBValue type, then to the desired structure
    const results = reader.getRowObjects() as unknown as DuckDbRowData[];
    console.log(
      `Processing ${results.length} rows from Parquet file via DuckDB...`,
    );

    for (const row of results) {
      // Iterate over objects directly
      // Extract primitive values directly
      const filePath = row.file_path;
      // Extract the array from the .items property for list types
      const shortLinks =
        row.aliases && Array.isArray((row.aliases as any).items)
          ? (row.aliases as any).items
          : null;
      const previousPaths =
        row.previous_paths && Array.isArray((row.previous_paths as any).items)
          ? (row.previous_paths as any).items
          : null;

      const currentPathFormatted = formatPathForUrl(filePath);
      if (!currentPathFormatted) {
        console.warn(`Skipping row with invalid file_path: ${filePath}`);
        continue;
      }

      // Add redirect for README.md files to parent directory URL
      if (filePath && /\/README\.md$/i.test(filePath)) {
        // Slugify the original .md path (relative to vault)
        const relativeMdPath = filePath.startsWith('/')
          ? filePath
          : `/${filePath}`;
        const slugifiedMdPath = slugifyPathComponents(relativeMdPath);
        // Format parent directory URL
        const parentDir = path.dirname(filePath);
        const parentUrl = formatPathForUrl(parentDir);
        if (parentUrl && slugifiedMdPath) {
          redirects[slugifiedMdPath] = parentUrl;
        }
      }

      // Process short links
      if (shortLinks && Array.isArray(shortLinks)) {
        for (const shortLink of shortLinks) {
          if (shortLink && typeof shortLink === 'string') {
            const formattedShortLink = shortLink.startsWith('/')
              ? shortLink
              : `/${shortLink}`;
            redirects[formattedShortLink] = currentPathFormatted;
          }
        }
      }

      // Process previous paths
      if (previousPaths && Array.isArray(previousPaths)) {
        for (const oldPath of previousPaths) {
          const oldPathFormatted = formatPathForUrl(oldPath);
          if (oldPathFormatted) {
            redirects[oldPathFormatted] = currentPathFormatted;
          }
        }
      }
    }

    console.log(
      `Generated ${Object.keys(redirects).length} redirects from DuckDB.`,
    );

    // Process YAML config files for aliases
    console.log(`Searching for .config.yaml files in ${VAULT_PATH}...`);
    const configFiles = await findConfigFiles(VAULT_PATH);
    console.log(`Found ${configFiles.length} .config.yaml files.`);

    const aliases: Record<string, string> = {};

    for (const configFile of configFiles) {
      try {
        const yamlContent = await fs.readFile(configFile, 'utf8');
        const config = yaml.load(yamlContent) as YamlConfig;

        if (config && config.aliases && Array.isArray(config.aliases)) {
          // Determine the canonical path for the directory containing the config file
          const configDir = path.dirname(configFile);
          // Get the path relative to the vault directory
          const relativeConfigDir = path.relative(VAULT_PATH, configDir);
          // Format the canonical path for URL
          const canonicalPath = formatPathForUrl(relativeConfigDir) || '/'; // Default to root if relative path is empty

          for (const alias of config.aliases) {
            if (alias && typeof alias === 'string') {
              const formattedAlias = alias.startsWith('/')
                ? alias
                : `/${alias}`;

              // Add to aliases map for getStaticPaths
              if (
                aliases[formattedAlias] &&
                aliases[formattedAlias] !== canonicalPath
              ) {
                console.warn(
                  `Conflict: Alias '${formattedAlias}' maps to both '${aliases[formattedAlias]}' and '${canonicalPath}'. Overwriting with the latter.`,
                );
              }
              aliases[formattedAlias] = canonicalPath;

              // Add to redirects map, prioritizing YAML over DuckDB
              if (
                redirects[formattedAlias] &&
                redirects[formattedAlias] !== canonicalPath
              ) {
                console.warn(
                  `Conflict: Alias '${formattedAlias}' from YAML conflicts with DuckDB redirect to '${redirects[formattedAlias]}'. Overwriting with YAML target '${canonicalPath}'.`,
                );
              }
              redirects[formattedAlias] = canonicalPath;
            }
          }
        }
      } catch (error: any) {
        if (error.name === 'YAMLException') {
          console.warn(
            `Skipping config file ${configFile} due to YAML error: ${error.reason}`,
          );
        } else {
          console.error(`Error processing config file ${configFile}:`, error);
        }
      }
    }

    console.log(`Generated ${Object.keys(aliases).length} aliases from YAML.`);
    console.log(
      `Total redirects after merging: ${Object.keys(redirects).length}`,
    );

    // Ensure output directory exists
    const publicDir = path.dirname(REDIRECTS_OUTPUT_PATH);
    await fs.mkdir(publicDir, { recursive: true });

    // Write the redirects map to the JSON file
    await fs.writeFile(
      REDIRECTS_OUTPUT_PATH,
      JSON.stringify(redirects, null, 2),
    );
    console.log(
      `Redirects map successfully written to ${REDIRECTS_OUTPUT_PATH}`,
    );

    // Write the aliases map to a separate JSON file
    await fs.writeFile(ALIASES_OUTPUT_PATH, JSON.stringify(aliases, null, 2));
    console.log(`Aliases map successfully written to ${ALIASES_OUTPUT_PATH}`);
  } catch (error: any) {
    console.error('Error generating redirects map:', error); // Log the actual error
    if (error.code === 'ENOENT' && error.path === PARQUET_FILE_PATH) {
      console.error(
        `Error: Parquet file not found at ${PARQUET_FILE_PATH}. Make sure the database export ran successfully.`,
      );
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
