import fs from 'fs/promises';
import path from 'path';

/**
 * Gets all markdown and MDX files recursively from a directory
 * @param dir The directory to search in
 * @param basePath The base path for the current directory
 * @returns Array of slug arrays for each markdown/MDX file
 */
export async function getAllMarkdownFiles(
  dir: string,
  basePath: string[] = [],
): Promise<string[][]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    console.error(`Error reading directory ${dir}: ${error}`);
    return [];
  }

  const paths: string[][] = [];

  // Check for readme files (markdown and MDX)
  const readmeFilePath = path.join(dir, 'readme.md');
  const readmeMdxFilePath = path.join(dir, 'readme.mdx');
  const indexFilePath = path.join(dir, '_index.md');
  const indexMdxFilePath = path.join(dir, '_index.mdx');

  let readmeExists = false;
  try {
    // Check for readme.md first
    await fs.stat(readmeFilePath);
    readmeExists = true;
  } catch {
    // If readme.md doesn't exist, try readme.mdx
    try {
      await fs.stat(readmeMdxFilePath);
      readmeExists = true;
    } catch {
      // Neither exists
    }
  }

  let indexExists = false;
  try {
    // Check for _index.md first
    await fs.stat(indexFilePath);
    indexExists = true;
  } catch {
    // If _index.md doesn't exist, try _index.mdx
    try {
      await fs.stat(indexMdxFilePath);
      indexExists = true;
    } catch {
      // Neither exists
    }
  }

  // Prioritize readme over _index
  if (readmeExists && basePath.length > 0) {
    paths.push([...basePath]);
    paths.push([...basePath, 'readme']);
  } else if (indexExists && basePath.length > 0) {
    paths.push([...basePath]);
  } else if (entries.length > 0 && basePath.length > 0) {
    paths.push([...basePath]);
  }

  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      paths.push(
        ...(await getAllMarkdownFiles(res, [...basePath, entry.name])),
      );
    } else if (
      // Include both .md and .mdx files
      (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) &&
      entry.name !== '_index.md' &&
      entry.name !== '_index.mdx' &&
      entry.name !== 'readme.md' &&
      entry.name !== 'readme.mdx'
    ) {
      // Remove file extension (.md or .mdx) for the slug
      const slugName = entry.name.replace(/\.(md|mdx)$/, '');
      paths.push([...basePath, slugName]);
    }
  }

  return paths;
}

export function getContentPath(slug: string) {
  const contentDir = path.join(process.cwd(), 'public/content');
  return path.join(contentDir, slug);
}
