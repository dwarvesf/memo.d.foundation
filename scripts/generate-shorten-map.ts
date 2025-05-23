import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import {
  getRedirects,
  getReversedAliasPaths,
  normalizePathWithSlash,
} from './common.js';

const VAULT_PATH = path.join(process.cwd(), 'vault');
const REDIRECTS_OUTPUT_PATH = path.join(
  process.cwd(),
  'public/content/shorten-redirects.json',
);

interface RedirectsMap {
  [alias: string]: string;
}

/**
 * Recursively find all markdown/mdx files in a directory
 */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  let files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '.git') {
        const subFiles = await findMarkdownFiles(fullPath);
        files = files.concat(subFiles);
      }
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Format a file path to a URL path starting with '/'
 * Remove vault prefix and file extension
 */
function formatFilePathToUrl(filePath: string): string {
  const relativePath = path.relative(VAULT_PATH, filePath);
  const noExt = relativePath.replace(/\.mdx?$/, '');
  // Replace spacing to hyphens and remove special characters
  const sanitizedPath = noExt
    .replace(/ /g, '-')
    .replace(/--+/g, '-')
    .split('/')
    .map(
      segment =>
        segment.replace(/[^a-zA-Z0-9-_\/]/g, '').replace(/^-+|-+$/g, ''), // Remove leading/trailing hyphens
    )
    .join('/');

  // Use forward slashes for URLs
  return ('/' + sanitizedPath.split(path.sep).join('/')).toLowerCase();
}

function getRedirectPaths(
  rawPath: string,
  aliases: Record<string, string>,
  redirects: Record<string, string>,
) {
  if (aliases[rawPath]) {
    return normalizePathWithSlash(aliases[rawPath]);
  }
  if (redirects[rawPath]) {
    return normalizePathWithSlash(redirects[rawPath]);
  }
  // If no match, return itself
  return normalizePathWithSlash(rawPath);
}

function normalizePaths(paths: Record<string, string>) {
  const normalized: Record<string, string> = {};
  for (const key in paths) {
    const value = paths[key];
    normalized[normalizePathWithSlash(key)] = normalizePathWithSlash(value);
  }
  return normalized;
}

/**
 * Main function to generate redirects map from frontmatter
 */
async function generateShortenRedirectsJSON() {
  const redirects: RedirectsMap = {};

  const files = await findMarkdownFiles(VAULT_PATH);
  const reversedAliases = normalizePaths(await getReversedAliasPaths());
  const redirectPaths = normalizePaths(await getRedirects());

  // Map to track used aliases to detect duplicates
  const usedAliases = new Set<string>();

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const { data: frontmatter } = matter(content);

      if (!frontmatter.redirect || !Array.isArray(frontmatter.redirect)) {
        // Skip if no redirect property or not an array
        continue;
      }
      const canonicalPath = getRedirectPaths(
        formatFilePathToUrl(file),
        reversedAliases,
        redirectPaths,
      );

      for (const aliasRaw of frontmatter.redirect) {
        if (typeof aliasRaw === 'string') {
          const alias = aliasRaw.startsWith('/') ? aliasRaw : '/' + aliasRaw;
          if (usedAliases.has(alias)) {
            console.warn(
              `Duplicate alias detected: ${alias} in file ${file}. Skipping.`,
            );
          } else {
            redirects[alias] = canonicalPath;
            usedAliases.add(alias);
          }
        }
      }
    } catch (error) {
      //
    }
  }

  // Write redirects map to JSON file
  await fs.writeFile(REDIRECTS_OUTPUT_PATH, JSON.stringify(redirects, null, 2));
  console.log(`Redirects map written to ${REDIRECTS_OUTPUT_PATH}`);
}

generateShortenRedirectsJSON();
