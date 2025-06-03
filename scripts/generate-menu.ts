import fs from 'fs';
import path from 'path';
import { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api'; // Import DuckDB API
import { slugifyPathComponents } from '../src/lib/utils/slugify.js'; // Import from shared utility

// TODO: Remove these interface definitions once module resolution from src/lib/content to src/types is fixed
/**
 * Interface for menu file paths within a group
 */
interface MenuFilePath {
  file_path: string;
  title: string;
  date: string; // Keep date for sorting
}

/**
 * Interface for grouped path data (menu hierarchy node)
 */
interface GroupedPath {
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
  const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
  if (!fs.existsSync(parquetFilePath)) {
    throw new Error(`Parquet file not found: ${parquetFilePath}`);
  }
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  return connection;
}

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

async function generateMenuIndex(): Promise<void> {
  const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
  const outputPath = path.join(process.cwd(), 'public/content/menu.json');
  let connection: DuckDBConnection | null = null;

  console.log(`Generating menu index from ${parquetFilePath}...`);

  try {
    if (!fs.existsSync(parquetFilePath)) {
      console.error('Error: Parquet file not found:', parquetFilePath);
      process.exit(1);
    }

    connection = await connectDuckDB();
    console.log('DuckDB connection established.');

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

    console.log('Executing DuckDB query for menu data...');
    const reader = await connection.runAndReadAll(query);
    const results = reader.getRowObjects() as unknown as MenuDbRow[];
    console.log(
      `Retrieved ${results.length} rows from Parquet file via DuckDB.`,
    );

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
        // Clean the file path for the menu URL
        let cleanedFilePath = filePath;
        if (cleanedFilePath.endsWith('/readme')) {
          cleanedFilePath = cleanedFilePath.slice(0, -'/readme'.length);
        } else if (cleanedFilePath.endsWith('/_index')) {
          cleanedFilePath = cleanedFilePath.slice(0, -'/_index'.length);
        }

        const filePathObj: MenuFilePath = {
          file_path: cleanedFilePath, // Use cleaned path
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

    // Create the output directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      console.log(`Creating output directory: ${outputDir}`);
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Writing menu index to ${outputPath}...`);
    // Write the generated menu data to the JSON file
    fs.writeFileSync(
      outputPath,
      JSON.stringify(menuData, null, 2), // Use 2 spaces for indentation
    );

    console.log(`Menu index successfully generated at: ${outputPath}`);
  } catch (error) {
    console.error('Error generating menu index:', error);
    process.exit(1); // Exit with error on failure
  } finally {
    // Ensure the database connection is closed
    if (connection) {
      connection.closeSync();
      console.log('DuckDB connection closed.');
    }
    console.log('Menu index generation script finished.');
  }
}

// Define structure for rows read from DuckDB for getPinnedNotes
interface PinnedNoteDbRow {
  file_path: string | null;
  title: string | null;
  short_title: string | null;
  date: string | null; // Assuming date is stored/read as string
  pinned: boolean | null;
}

/**
 * Get pinned notes from the parquet database using DuckDB and save to JSON
 * @returns Promise resolving when complete
 */
async function generatePinnedNotes(): Promise<void> {
  const outputPath = path.join(
    process.cwd(),
    'public/content/pinned-notes.json',
  );
  const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
  const parquetPathForDb = parquetFilePath.replace(/\\/g, '/');
  let connection: DuckDBConnection | null = null;

  console.log(`Generating pinned notes from ${parquetFilePath}...`);

  try {
    if (!fs.existsSync(parquetFilePath)) {
      console.error('Error: Parquet file not found:', parquetFilePath);
      process.exit(1);
    }

    connection = await connectDuckDB();
    console.log('DuckDB connection established.');

    // Use SQL for filtering, ordering, and limiting
    const query = `
      SELECT file_path, title, short_title, date
      FROM read_parquet('${parquetPathForDb}')
      WHERE
        pinned = true AND
        title IS NOT NULL AND title != ''
      ORDER BY date DESC
      LIMIT 10; -- Assuming a limit of 3 as in the original function
    `;

    const reader = await connection.runAndReadAll(query);
    const results = reader.getRowObjects() as unknown as PinnedNoteDbRow[];

    const pinnedNotes = results.map(row => {
      const filePath = row.file_path || '';
      const title = row.title || ''; // Already filtered non-empty in SQL
      const short_title = row.short_title || ''; // Already filtered non-empty in SQL
      const date = String(row.date || ''); // Explicitly convert date to string

      // Slugify the path for URL generation
      let slugifiedPath = slugifyPathComponents(filePath);

      // 1. Remove .md extension if present
      if (slugifiedPath.endsWith('.md')) {
        slugifiedPath = slugifiedPath.slice(0, -3);
      }

      // 2. Remove trailing /readme or /_index
      if (slugifiedPath.endsWith('/readme')) {
        slugifiedPath = slugifiedPath.slice(0, -'/readme'.length);
      } else if (slugifiedPath.endsWith('/_index')) {
        slugifiedPath = slugifiedPath.slice(0, -'/_index'.length);
      }

      // 3. Prepend slash for final URL
      const url = '/' + slugifiedPath;

      return { title, url, short_title, date };
    });

    // Create the output directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      console.log(`Creating output directory: ${outputDir}`);
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Writing pinned notes to ${outputPath}...`);
    fs.writeFileSync(
      outputPath,
      JSON.stringify(pinnedNotes, null, 2), // Use 2 spaces for indentation
    );

    console.log(`Pinned notes successfully generated at: ${outputPath}`);
  } catch (error) {
    console.error('Error generating pinned notes:', error);
    process.exit(1); // Exit with error on failure
  } finally {
    // Ensure the database connection is closed
    if (connection) {
      connection.closeSync();
      console.log('DuckDB connection closed.');
    }
    console.log('Pinned notes generation script finished.');
  }
}

/**
 * Get all unique tags from the parquet database using DuckDB and save to JSON
 * @returns Promise resolving when complete
 */
async function generateTags(): Promise<void> {
  const outputPath = path.join(process.cwd(), 'public/content/tags.json');
  const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
  const parquetPathForDb = parquetFilePath.replace(/\\/g, '/');
  let connection: DuckDBConnection | null = null;

  console.log(`Generating tags from ${parquetFilePath}...`);

  try {
    if (!fs.existsSync(parquetFilePath)) {
      console.error('Error: Parquet file not found:', parquetFilePath);
      process.exit(1);
    }

    connection = await connectDuckDB();
    console.log('DuckDB connection established.');

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

    // Create the output directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      console.log(`Creating output directory: ${outputDir}`);
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Writing tags to ${outputPath}...`);
    fs.writeFileSync(
      outputPath,
      JSON.stringify(tags, null, 2), // Use 2 spaces for indentation
    );

    console.log(`Tags successfully generated at: ${outputPath}`);
  } catch (error) {
    console.error('Error generating tags:', error);
    process.exit(1); // Exit with error on failure
  } finally {
    // Ensure the database connection is closed
    if (connection) {
      connection.closeSync();
      console.log('DuckDB connection closed.');
    }
    console.log('Tags generation script finished.');
  }
}

async function generateAllStaticData() {
  try {
    // Generate menu index
    await generateMenuIndex();

    // Generate pinned notes
    await generatePinnedNotes();

    // Generate tags
    await generateTags();
  } catch (error) {
    console.error('Error generating static data:', error);
    process.exit(1); // Exit with error on failure
  }
}

// Run the main function
generateAllStaticData();
