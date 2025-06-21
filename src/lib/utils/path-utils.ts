import path from 'path';
import { slugifyPathComponents } from './slugify';

function removingTrailingSlash(path: string): string {
  return path.replace(/\/$/, '');
}

function removingRedundantSymbols(path: string): string {
  return path.replace(/\"|"/, '');
}

function normalizePathWithSlash(path: string): string {
  if (path.startsWith('/')) {
    return removingTrailingSlash(removingRedundantSymbols(path));
  }
  return removingTrailingSlash(removingRedundantSymbols(`/${path}`));
}

/**
 * Get the client-side redirect path for a given URL.
 * @param url The original URL.
 * @returns The resolved URL, which may be redirected.
 */
export function getClientSideRedirectPath(url: string): string {
  if (!url || url === '/') {
    return url;
  }
  let unifiedRedirects: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    unifiedRedirects = (globalThis as any)._app_unified_redirects || {};
  }
  const normalizedUrl = normalizePathWithSlash(url);
  return removingTrailingSlash(unifiedRedirects[normalizedUrl] || url);
}

/**
 * Formats a content file path into a URL path, handling special cases like /readme and /_index.
 * @param filePath The original file path (e.g., 'vault/some/directory/README.md').
 * @returns The formatted URL path (e.g., '/some/directory').
 */
export function formatContentPath(filePath: string): string {
  const lowerCasePath = filePath.toLowerCase();

  // Check if it's a README or _index file
  if (
    lowerCasePath.endsWith('/readme.md') ||
    lowerCasePath.endsWith('/_index.md')
  ) {
    // Get parent directory path and slugify it
    const parentDirPath = path.dirname(filePath);
    const slugifiedParentPath = slugifyPathComponents(parentDirPath);

    // Ensure root directory README/index links to '/'
    if (slugifiedParentPath === '.' || slugifiedParentPath === '/') {
      return '/';
    }
    // Prepend slash and remove trailing slash if present
    let url = '/' + slugifiedParentPath;
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    return getClientSideRedirectPath(url);
  } else {
    // Generate slugified URL for other files, removing .md suffix
    const slugifiedPath = slugifyPathComponents(filePath);
    let url =
      '/' +
      (slugifiedPath.endsWith('.md')
        ? slugifiedPath.slice(0, -3)
        : slugifiedPath);

    // Remove trailing slash if present (except for root)
    if (url.length > 1 && url.endsWith('/')) {
      url = url.slice(0, -1);
    }

    return getClientSideRedirectPath(url);
  }
}
