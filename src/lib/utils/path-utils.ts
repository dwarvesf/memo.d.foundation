import path from 'path';
import { slugifyPathComponents } from './slugify';

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
    return url;
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

    return url;
  }
}
