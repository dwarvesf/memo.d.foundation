import fs from 'fs';
import path from 'path';
import { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import { slugifyPathComponents } from '../src/lib/utils/slugify.js';

// Define the structure for the backlinks map
interface BacklinksMap {
  [targetSlug: string]: { title: string; path: string }[];
}

// --- DuckDB Connection Helper ---

async function connectDuckDB(): Promise<DuckDBConnection> {
  const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
  if (!fs.existsSync(parquetFilePath)) {
    throw new Error(`Parquet file not found: ${parquetFilePath}`);
  }
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  return connection;
}

// Define structure for rows read from DuckDB
interface ContentDbRow {
  file_path: string | null;
  md_content: string | null;
  title: string | null;
}

async function generateBacklinksIndex(): Promise<void> {
  const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
  const outputPath = path.join(process.cwd(), 'public/content/backlinks.json');
  const contentDir = path.join(process.cwd(), 'public/content');
  let connection: DuckDBConnection | null = null;

  console.log(`Generating backlinks index from ${parquetFilePath}...`);

  try {
    if (!fs.existsSync(parquetFilePath)) {
      console.error('Error: Parquet file not found:', parquetFilePath);
      process.exit(1);
    }

    connection = await connectDuckDB();
    console.log('DuckDB connection established.');

    const parquetPathForDb = parquetFilePath.replace(/\\/g, '/');

    // Select file_path, md_content, and title for processing
    const query = `
      SELECT file_path, md_content, title
      FROM read_parquet('${parquetPathForDb}')
      WHERE md_content IS NOT NULL AND file_path IS NOT NULL AND title IS NOT NULL AND title != '';
    `;

    console.log('Executing DuckDB query for content data...');
    const reader = await connection.runAndReadAll(query);
    const results = reader.getRowObjects() as unknown as ContentDbRow[];
    console.log(
      `Retrieved ${results.length} rows from Parquet file via DuckDB.`,
    );

    const backlinksMap: BacklinksMap = {};

    // Regex to find markdown links: [text](url) or [[link]]
    // This regex attempts to capture both formats and the URL/path
    const linkRegex = /\[.*?\]\((.*?)\)|\[\[(.*?)\]\]/g;

    results.forEach(row => {
      const sourceFilePath = row.file_path || '';
      const mdContent = row.md_content || '';
      const sourceTitle = row.title || '';

      if (!sourceFilePath) return;

      let match;
      while ((match = linkRegex.exec(mdContent)) !== null) {
        // Extract the link URL/path from the regex match
        const linkTarget = match[1] || match[2]; // Group 1 for [text](url), Group 2 for [[link]]

        if (linkTarget) {
          // Clean up the link target and determine the potential file path
          let targetFilePath = linkTarget.replace(/\.md$/, ''); // Remove .md extension

          // Handle relative paths: resolve them against the source file's directory
          if (!/^(https?:\/\/|\/)/i.test(targetFilePath)) {
            const sourceDir = path.dirname(sourceFilePath);
            targetFilePath = path.join(sourceDir, targetFilePath);
          }

          // Remove leading slash if it's an internal path
          targetFilePath = targetFilePath.replace(/^\//, '');

          // Check if the target corresponds to an existing markdown file in the content directory
          const potentialMarkdownPath = path.join(
            contentDir,
            targetFilePath + '.md',
          );
          const potentialIndexMarkdownPath = path.join(
            contentDir,
            targetFilePath,
            '_index.md',
          );
          const potentialReadmeMarkdownPath = path.join(
            contentDir,
            targetFilePath,
            'readme.md',
          );

          let targetSlug = '';
          if (fs.existsSync(potentialMarkdownPath)) {
            targetSlug = targetFilePath;
          } else if (fs.existsSync(potentialIndexMarkdownPath)) {
            targetSlug = path.join(targetFilePath, '_index'); // Use directory path + _index as slug
          } else if (fs.existsSync(potentialReadmeMarkdownPath)) {
            targetSlug = path.join(targetFilePath, 'readme'); // Use directory path + readme as slug
          } else {
            // If it doesn't match a markdown file, check if it's a directory that might have an index/readme
            const potentialDirPath = path.join(contentDir, targetFilePath);
            if (
              fs.existsSync(potentialDirPath) &&
              fs.statSync(potentialDirPath).isDirectory()
            ) {
              // If it's a directory, use the directory path as the target slug
              targetSlug = targetFilePath;
            } else {
              // If it's not an internal markdown file or directory, skip it
              continue;
            }
          }

          // Slugify the target slug components for consistency
          targetSlug = slugifyPathComponents(targetSlug);

          // Ensure the target slug is not empty after processing
          if (!targetSlug) continue;

          // Create the backlink item
          const backlinkItem = {
            title: sourceTitle,
            path:
              '/' +
              slugifyPathComponents(sourceFilePath)
                .replace(/\.md$/, '')
                .replace(/\/readme$/, ''), // Slugify source path and clean up
          };

          // Add the backlink to the map
          if (!backlinksMap[targetSlug]) {
            backlinksMap[targetSlug] = [];
          }
          // Avoid adding duplicate backlinks from the same source file to the same target
          if (
            !backlinksMap[targetSlug].some(
              link => link.path === backlinkItem.path,
            )
          ) {
            backlinksMap[targetSlug].push(backlinkItem);
          }
        }
      }
    });

    // Create the output directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      console.log(`Creating output directory: ${outputDir}`);
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Writing backlinks index to ${outputPath}...`);
    // Write the generated backlinks data to the JSON file
    fs.writeFileSync(
      outputPath,
      JSON.stringify(backlinksMap, null, 2), // Use 2 spaces for indentation
    );

    console.log(`Backlinks index successfully generated at: ${outputPath}`);
  } catch (error) {
    console.error('Error generating backlinks index:', error);
    process.exit(1); // Exit with error on failure
  } finally {
    // Ensure the database connection is closed
    if (connection) {
      connection.closeSync();
      console.log('DuckDB connection closed.');
    }
    console.log('Backlinks index generation script finished.');
  }
}

// Run the main function
generateBacklinksIndex();
