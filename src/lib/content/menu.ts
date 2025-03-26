import fs from 'fs';
import path from 'path';
import { asyncBufferFromFile, parquetRead } from 'hyparquet';

/**
 * Slugify a string (based on Memo.Common.Slugify.slugify)
 * @param str The string to slugify
 * @returns Slugified string
 */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-+|-+$/g, '');
}

/**
 * Slugify filename (based on Memo.Common.Slugify.slugify_filename)
 * @param filename The filename to slugify
 * @returns Slugified filename with extension preserved
 */
function slugifyFilename(filename: string): string {
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  return slugify(name) + ext;
}

/**
 * Slugify path components (based on Memo.Common.Slugify.slugify_path_components)
 * @param pathStr The path to slugify
 * @returns Path with components slugified
 */
function slugifyPathComponents(pathStr: string): string {
  return pathStr
    .split('/')
    .map(component => {
      if (['.', '..', ''].includes(component)) {
        return component;
      }
      return slugifyFilename(component);
    })
    .join('/');
}

/**
 * Interface for menu file paths
 */
interface FilePath {
  file_path: string;
  title: string;
  date: string;
}

/**
 * Interface for grouped path data
 */
interface GroupedPath {
  grouped_path: string;
  file_paths: FilePath[];
  next_path: Record<string, GroupedPath>;
}

/**
 * Nest paths to create a hierarchical menu structure
 * @param data Array of grouped paths
 * @returns Nested object representing menu hierarchy
 */
function nestPaths(
  data: { grouped_path: string; file_paths: string[] }[],
): Record<string, GroupedPath> {
  const result: Record<string, GroupedPath> = {};

  data.forEach(item => {
    const paths = item.grouped_path.split('/').filter((p: string) => p);
    let currentLevel = result;

    paths.forEach((path: string, index: number) => {
      if (!currentLevel[path]) {
        currentLevel[path] = {
          grouped_path: '/' + paths.slice(0, index + 1).join('/'),
          file_paths: [],
          next_path: {},
        };
      }

      if (index === paths.length - 1) {
        currentLevel[path].file_paths = item.file_paths.map((paths: string) =>
          JSON.parse(paths),
        );
        // Sort file_paths: special characters first, then by date
        currentLevel[path].file_paths.sort((a: FilePath, b: FilePath) => {
          const specialChars = /^[§¶&]/;
          const aHasSpecial = specialChars.test(a.title);
          const bHasSpecial = specialChars.test(b.title);

          if (aHasSpecial && !bHasSpecial) return -1;
          if (!aHasSpecial && bHasSpecial) return 1;
          if (aHasSpecial && bHasSpecial) {
            // If both have special characters, maintain their original order
            return 0;
          }
          // If neither have special characters or both do, sort by date (assuming newer dates should come first)
          const dateA = a.date || '';
          const dateB = b.date || '';
          return (
            new Date(dateB || 0).getTime() - new Date(dateA || 0).getTime()
          );
        });
      }

      currentLevel = currentLevel[path].next_path;
    });
  });

  return sortGroupedPaths(result);
}

/**
 * Sort the grouped paths alphabetically
 * @param obj Object containing grouped paths
 * @returns Sorted object
 */
function sortGroupedPaths(
  obj: Record<string, GroupedPath>,
): Record<string, GroupedPath> {
  const sortedKeys = Object.keys(obj).sort();
  const sortedObj: Record<string, GroupedPath> = {};

  sortedKeys.forEach(key => {
    sortedObj[key] = obj[key];
    if (Object.keys(sortedObj[key].next_path).length > 0) {
      sortedObj[key].next_path = sortGroupedPaths(sortedObj[key].next_path);
    }
  });

  return sortedObj;
}

/**
 * Get menu data from the parquet database
 * @returns Promise resolving to menu structure
 */
export async function getMenu(): Promise<Record<string, GroupedPath>> {
  let menuData: Record<string, GroupedPath> = {};

  try {
    const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
    if (fs.existsSync(parquetFilePath)) {
      let parsedData: { grouped_path: string; file_paths: string[] }[] = [];

      await parquetRead({
        file: await asyncBufferFromFile(parquetFilePath),
        columns: [
          'file_path',
          'short_title',
          'title',
          'date',
          'draft',
          'hiring',
          'status',
          'hide_on_sidebar',
        ],
        onComplete: data => {
          // Create a map to collect file paths by grouped path
          const groupedPathMap = new Map<string, { file_paths: string[] }>();

          data.forEach(row => {
            const filePath = row[0]?.toString() || '';
            const shortTitle = row[1]?.toString() || '';
            const title = row[2]?.toString() || '';
            const date = row[3]?.toString() || '';
            const draft = row[4] === true;
            const hiring = row[5] === false;
            const status = row[6]?.toString() || '';
            const hideOnSidebar = row[7] === true;

            // Skip entries with empty title or those that should be hidden
            if (
              !title ||
              draft ||
              hiring ||
              hideOnSidebar ||
              (status && status !== 'Open')
            ) {
              return;
            }

            // Skip archived files and _radar files
            if (
              filePath.includes('archived/') ||
              filePath.includes('_radar/')
            ) {
              return;
            }

            // Extract grouped path (parent directory)
            let groupedPath = '';
            const lastSlashPos = filePath.lastIndexOf('/');
            if (lastSlashPos > 0) {
              groupedPath = filePath.substring(0, lastSlashPos);
            }

            if (groupedPath) {
              // Create file path object - include date in an unused property for debugging
              const filePathObj = {
                file_path: filePath,
                title: shortTitle || title,
                _meta: { date }, // Use date here to avoid the unused var warning
              };

              // Add to grouped path map
              if (!groupedPathMap.has(groupedPath)) {
                groupedPathMap.set(groupedPath, { file_paths: [] });
              }

              groupedPathMap
                .get(groupedPath)!
                .file_paths.push(JSON.stringify(filePathObj));
            }
          });

          // Convert map to array format expected by nestPaths
          parsedData = Array.from(groupedPathMap.entries()).map(
            ([grouped_path, data]) => ({
              grouped_path,
              file_paths: data.file_paths,
            }),
          );
        },
      });

      // Sort by grouped_path in descending order
      parsedData.sort((a, b) => b.grouped_path.localeCompare(a.grouped_path));

      // Nest the paths to create menu structure
      menuData = nestPaths(parsedData);
    }
  } catch (parquetError) {
    console.error('Error reading parquet file for menu:', parquetError);
  }

  return menuData;
}

/**
 * Get pinned notes from the parquet database
 * @param limit Number of pinned notes to return
 * @returns Promise resolving to array of pinned notes
 */
export async function getPinnedNotes(
  limit: number = 3,
): Promise<{ title: string; url: string; date: string }[]> {
  let pinnedNotes: { title: string; url: string; date: string }[] = [];

  try {
    const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
    if (fs.existsSync(parquetFilePath)) {
      await parquetRead({
        file: await asyncBufferFromFile(parquetFilePath),
        columns: ['file_path', 'title', 'date', 'pinned'],
        onComplete: data => {
          const filteredData = data.filter(row => {
            const pinned = row[3] === true;
            const title = row[1]?.toString() || '';

            return pinned && title;
          });

          pinnedNotes = filteredData.map(row => {
            const filePath = row[0]?.toString() || '';
            const title = row[1]?.toString() || '';
            const date = row[2]?.toString() || '';

            // Slugify the path
            const slugifiedPath = slugifyPathComponents(filePath);

            // Create URL (remove .md extension)
            const url =
              '/' +
              (slugifiedPath.endsWith('.md')
                ? slugifiedPath.slice(0, -3)
                : slugifiedPath);

            return {
              title,
              url,
              date,
            };
          });

          // Sort by date (newer first) and limit
          pinnedNotes.sort(
            (a, b) =>
              new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
          );

          if (limit > 0) {
            pinnedNotes = pinnedNotes.slice(0, limit);
          }
        },
      });
    }
  } catch (parquetError) {
    console.error('Error reading parquet file for pinned notes:', parquetError);
  }

  return pinnedNotes;
}

/**
 * Get all tags from the parquet database
 * @returns Promise resolving to array of tags
 */
export async function getTags(): Promise<string[]> {
  let tags: string[] = [];
  const tagSet = new Set<string>();

  try {
    const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
    if (fs.existsSync(parquetFilePath)) {
      await parquetRead({
        file: await asyncBufferFromFile(parquetFilePath),
        columns: ['tags'],
        onComplete: data => {
          data.forEach(row => {
            const rowTags = row[0];

            if (Array.isArray(rowTags)) {
              rowTags.forEach((tag: string) => {
                if (tag && typeof tag === 'string') {
                  tagSet.add(tag);
                }
              });
            }
          });

          tags = Array.from(tagSet);
        },
      });
    }
  } catch (parquetError) {
    console.error('Error reading parquet file for tags:', parquetError);
  }

  return tags;
}
