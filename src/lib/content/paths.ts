import fs from 'fs';
import path from 'path';

/**
 * Gets all markdown files recursively from a directory
 * @param dir The directory to search in
 * @param basePath The base path for the current directory
 * @returns Array of slug arrays for each markdown file
 */
export function getAllMarkdownFiles(
  dir: string,
  basePath: string[] = [],
): string[][] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const paths: string[][] = [];

  // Check for readme.md first, then _index.md in the current directory
  const readmeFilePath = path.join(dir, 'readme.md');
  const indexFilePath = path.join(dir, '_index.md');

  // Prioritize readme.md over _index.md
  if (fs.existsSync(readmeFilePath) && basePath.length > 0) {
    // If readme.md exists, add the current directory as a path
    paths.push([...basePath]);
  } else if (fs.existsSync(indexFilePath) && basePath.length > 0) {
    // If _index.md exists but readme.md doesn't, add the current directory as a path
    paths.push([...basePath]);
  }

  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      paths.push(...getAllMarkdownFiles(res, [...basePath, entry.name]));
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
