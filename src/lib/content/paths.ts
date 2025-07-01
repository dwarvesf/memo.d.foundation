import { memoize } from 'lodash';
import path from 'path';
import {
  getAllMarkdownFiles,
  normalizePathWithSlash,
} from '../../../scripts/common';
import { readFileSync } from 'fs';
import { memoryCache } from '@/lib/memory-cache';

export { getAllMarkdownFiles };

export function getContentPath(slug: string) {
  const contentDir = path.join(process.cwd(), 'public/content');
  return path.join(contentDir, slug);
}

const CACHED_JSON_PATHS_KEY = 'staticJsonPaths';

/**
 * Generates a map of static JSON paths for the application.
 *
 * This function collects and processes paths from:
 * 1. Markdown files in the content directory
 * 2. Redirects mapping
 * 3. Reversed alias paths
 *
 * The function filters out paths that start with 'contributor' or 'tags',
 * and ensures there are no duplicate paths between markdown files, redirects,
 * and aliases. The final returned object maps normalized paths to their
 * target destinations.
 *
 * @returns A promise that resolves to a Record mapping browser path strings to their target Markdown path strings,
 *          where all paths are normalized with slashes.
 */
export const getStaticJSONPaths = async (): Promise<Record<string, string>> => {
  const CACHED_JSON_PATHS = memoryCache.get<Record<string, string>>(
    CACHED_JSON_PATHS_KEY,
  );
  if (CACHED_JSON_PATHS) {
    return CACHED_JSON_PATHS;
  }
  const staticJsonPath = path.join(
    process.cwd(),
    'public/content/static-paths.json',
  );

  try {
    const jsonData = readFileSync(staticJsonPath, 'utf-8');
    const paths = JSON.parse(jsonData) as Record<string, string>;
    memoryCache.set(CACHED_JSON_PATHS_KEY, paths);
    return paths;
  } catch (error) {
    console.error('Error reading static paths JSON:', error);
    return {};
  }
};

export const getRedirectsBackLinks = memoize(
  (
    link: string,
    appBackLinks: Record<string, { title: string; path: string }[]>,
    staticRedirectsPaths: Record<string, string>,
  ) => {
    const targetBackLinks = appBackLinks[link] || [];
    if (!targetBackLinks.length) {
      return [];
    }
    const mdFilesToAliases = Object.fromEntries(
      Object.entries(staticRedirectsPaths).map(([key, value]) => [value, key]),
    );
    return targetBackLinks.map(backLink => {
      const normalizedPath = normalizePathWithSlash(backLink.path);
      const redirectTarget = mdFilesToAliases[normalizedPath];
      if (redirectTarget) {
        return {
          title: backLink.title,
          path: redirectTarget,
        };
      }
      return backLink;
    });
  },
);
