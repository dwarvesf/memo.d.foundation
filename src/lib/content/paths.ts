import fs from 'fs/promises'; // Use asynchronous promises API
import path from 'path';

/**
 * Gets all markdown files recursively from a directory
 * @param dir The directory to search in
 * @param basePath The base path for the current directory
 * @returns Array of slug arrays for each markdown file
 */
export async function getAllMarkdownFiles( // Make the function asynchronous
  dir: string,
  basePath: string[] = [],
): Promise<string[][]> {
  // Update return type to Promise
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true }); // Use asynchronous readdir
  } catch (error) {
    // If directory doesn't exist or other error, return empty array
    console.error(`Error reading directory ${dir}: ${error}`);
    return [];
  }

  const paths: string[][] = [];

  // Check for readme.md first, then _index.md in the current directory
  const readmeFilePath = path.join(dir, 'readme.md');
  const indexFilePath = path.join(dir, '_index.md');

  let readmeExists = false;
  try {
    await fs.stat(readmeFilePath); // Use asynchronous stat
    readmeExists = true;
  } catch {
    // File does not exist
  }

  let indexExists = false;
  try {
    await fs.stat(indexFilePath); // Use asynchronous stat
    indexExists = true;
  } catch {
    // File does not exist
  }

  // Prioritize readme.md over _index.md
  if (readmeExists && basePath.length > 0) {
    // If readme.md exists, add the current directory as a path
    paths.push([...basePath]);

    // Also add readme.md as a separate entry
    paths.push([...basePath, 'readme']);
  } else if (indexExists && basePath.length > 0) {
    // If _index.md exists but readme.md doesn't, add the current directory as a path
    paths.push([...basePath]);
  } else if (entries.length > 0 && basePath.length > 0) {
    // If neither readme.md nor _index.md exists, add the current directory as a path
    paths.push([...basePath]);
  }

  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      paths.push(
        ...(await getAllMarkdownFiles(res, [...basePath, entry.name])),
      ); // Await recursive call
    } else if (
      entry.name.endsWith('.md') &&
      entry.name !== '_index.md' &&
      entry.name !== 'readme.md'
    ) {
      // Skip _index.md and readme.md as they're already handled above
      // Remove .md extension for the slug
      const slugName = entry.name.replace(/\.md$/, '');
      paths.push([...basePath, slugName]);
    }
  }

  return paths;
}

export function getContentPath(slug: string) {
  const contentDir = path.join(process.cwd(), 'public/content');

  return path.join(contentDir, slug);
}
