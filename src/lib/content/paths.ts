import { memoize } from 'lodash';
import path from 'path';
import {
  getAllMarkdownFiles,
  getRedirectsNotToAliases,
  getReversedAliasPaths,
  normalizePathWithSlash,
} from '../../../scripts/common';

export { getAllMarkdownFiles };

export function getContentPath(slug: string) {
  const contentDir = path.join(process.cwd(), 'public/content');
  return path.join(contentDir, slug);
}

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
export const getStaticJSONPaths = memoize(
  async (): Promise<Record<string, string>> => {
    const contentDir = path.join(process.cwd(), 'public/content');
    const redirectsPaths = await getRedirectsNotToAliases();
    const aliasesPaths = await getReversedAliasPaths();
    const markdownPaths = (await getAllMarkdownFiles(contentDir))
      .filter(
        slugArray =>
          !slugArray[0]?.toLowerCase()?.startsWith('contributor') &&
          !slugArray[0]?.toLowerCase()?.startsWith('tags'),
      )
      .map(slugArray => slugArray.join('/'));

    // Aliases paths as primary paths
    const aliasesEntries = Object.entries(aliasesPaths);

    // Only getting redirects paths that are unique and not already in aliases
    const redirectsPathsToAliases = Object.entries(redirectsPaths);

    // Removing all markdown paths that are already in redirects and aliases
    const filteredMarkdownPaths = markdownPaths
      .filter(mdPath => {
        const normalizedPath = normalizePathWithSlash(mdPath);
        const isMatchedRedirects = redirectsPathsToAliases.some(
          ([redirectKey]) => {
            const normalizedRedirectKey = normalizePathWithSlash(redirectKey);
            return normalizedPath === normalizedRedirectKey;
          },
        );
        if (isMatchedRedirects) {
          return false;
        }

        const isMatchedAliases = aliasesEntries.some(([aliasKey]) => {
          const normalizedAliasKey = normalizePathWithSlash(aliasKey);
          return normalizedPath === normalizedAliasKey;
        });
        return !isMatchedAliases;
      })
      .map(mdPath => [mdPath, mdPath]);
    const aliasesEntriesPaths = aliasesEntries.map(([key, value]) => {
      return [value, key];
    });

    const paths: Record<string, string> = {
      ...Object.fromEntries(filteredMarkdownPaths),
      ...redirectsPaths,
      ...Object.fromEntries(aliasesEntriesPaths),
    };

    return Object.fromEntries(
      Object.entries(paths).map(([key, value]) => [
        normalizePathWithSlash(key),
        normalizePathWithSlash(value),
      ]),
    );
  },
);
