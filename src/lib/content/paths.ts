import fs from 'fs';
import path from 'path';

/**
 * Gets all markdown files recursively from a directory
 * @param dir The directory to search in
 * @param basePath The base path for the current directory
 * @returns Array of slug arrays for each markdown file
 */
export function getAllMarkdownFiles(dir: string, basePath: string[] = []): string[][] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const paths: string[][] = [];

  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      paths.push(...getAllMarkdownFiles(res, [...basePath, entry.name]));
    } else if (entry.name.endsWith('.md')) {
      // Remove .md extension for the slug
      const slugName = entry.name.replace(/\.md$/, '');
      paths.push([...basePath, slugName]);
    }
  }

  return paths;
}