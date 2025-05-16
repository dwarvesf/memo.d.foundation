import {
  GroupedPath,
  IMemoItem,
  ITreeNode,
  MenuFilePath,
  NestedMenuPathTree,
  RootLayoutPageProps,
} from '@/types';
import fs from 'fs/promises'; // Use promises version for async file reading
import { memoize } from 'lodash';
import path from 'path'; // Import path module
import { slugToTitle, uppercaseSpecialWords } from '../utils';
import { formatContentPath } from '../utils/path-utils'; // Import formatContentPath from path-utils
import { slugifyPathComponents } from '../utils/slugify'; // Import slugifyPathComponents from utils
import { getAllMarkdownContents } from './memo';
import { getContentPath } from './paths';

export async function getMenuPathSorted() {
  try {
    const jsonContent = await fs.readFile(
      getContentPath('menu-sorted.json'),
      'utf-8',
    );
    const parsedContent = JSON.parse(jsonContent);
    return parsedContent as NestedMenuPathTree;
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return {};
  }
}

/**
 * Sorts file paths according to configuration in sortedMenuPaths
 * @param menuData - Array of file path objects to be sorted
 * @param sortedMenuPaths - Configuration object defining custom sort order
 * @returns Sorted array of file path objects
 */
function applyRecursiveMenuSortedFiles(
  menuData: GroupedPath['file_paths'],
  sortedMenuPaths: NestedMenuPathTree | null,
): GroupedPath['file_paths'] {
  if (!sortedMenuPaths) {
    return menuData;
  }

  // Extract sorted paths from the menu sorted paths object
  const sortedKeys = Object.entries(sortedMenuPaths)
    .filter(([, value]) => {
      return (
        typeof value === 'string' &&
        menuData.some(file => file.file_path === value)
      );
    })
    .map(([, value]) => value as string);

  // Get unsorted files (files not present in sortedKeys)
  const unsortedFiles = menuData
    .filter(file => !sortedKeys.includes(file.file_path))
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(file => file.file_path);

  // Combine sorted keys with alphabetically sorted unsorted files
  const combinedSortedPaths = [...sortedKeys, ...unsortedFiles];

  // Map paths back to their original file objects
  return combinedSortedPaths
    .map(path => menuData.find(file => file.file_path === path))
    .filter((file): file is MenuFilePath => file !== undefined);
}

/**
 * Recursively applies custom sorting to a menu data structure
 * @param menuData - Menu structure containing file paths and nested directories
 * @param sortedMenuPaths - Configuration object defining custom sort order
 * @returns Sorted menu data structure
 */
function applyRecursiveMenuSortedField(
  menuData: Record<string, GroupedPath> | GroupedPath['next_path'],
  sortedMenuPaths: NestedMenuPathTree | null,
): Record<string, GroupedPath> {
  // Sort paths alphabetically as a fallback
  const alphabeticallySortedPaths = Object.keys(menuData).sort((a, b) =>
    a.localeCompare(b),
  );

  // Get ordered paths from sortedMenuPaths if available
  const sortedConfigPaths = Object.keys(sortedMenuPaths ?? {});

  // Combine paths: first the ones specified in sortedMenuPaths (if they exist in menuData),
  // then alphabetically sorted remaining paths
  const orderedPaths = [
    // First include paths from sortedMenuPaths that are objects (not strings) and exist in menuData
    ...sortedConfigPaths.filter(path => {
      const menuSortedValue = sortedMenuPaths?.[path];
      return (
        menuSortedValue instanceof Object &&
        menuSortedValue !== null &&
        alphabeticallySortedPaths.includes(path)
      );
    }),
    // Then include remaining paths not already included
    ...alphabeticallySortedPaths.filter(
      path => !sortedConfigPaths.includes(path),
    ),
  ];

  // Process each path to create entries for the final object
  const entries = orderedPaths.map(path => {
    const value = menuData[path];
    const pathConfig = sortedMenuPaths?.[path] ?? null;

    // If the config for this path is a string, it's a file reference - no need for recursion
    if (typeof pathConfig === 'string') {
      return [path, value];
    }

    // Otherwise, recursively apply sorting to nested structures
    const processedValue = {
      ...value, // Fix: spread value instead of menuData
      file_paths: applyRecursiveMenuSortedFiles(value.file_paths, pathConfig),
      next_path: applyRecursiveMenuSortedField(value.next_path, pathConfig),
    };

    return [path, processedValue];
  }) as [string, GroupedPath][];

  return Object.fromEntries<GroupedPath>(entries);
}

/**
 * Transforms the nested menu data structure into the ITreeNode structure
 * expected by the DirectoryTree component.
 * @param menuData The nested menu data.
 * @param currentPath The current path during recursion (used internally).
 * @param pinnedNotes Array of pinned notes.
 * @param tags Array of tags with name and count.
 * @returns A nested object representing the directory tree in ITreeNode format.
 */
function transformMenuDataToDirectoryTree(
  menuData: Record<string, GroupedPath>,
  pinnedNotes: Array<{ title: string; url: string; date: string }>,
  tags: {
    name: string;
    count: number;
  }[], // Add tags parameter
  currentPath = '',
): Record<string, ITreeNode> {
  const treeNode: Record<string, ITreeNode> = {};

  // Initialize root nodes only at the top level (currentPath === '')
  // Ensure specific order: /pinned, /, /tags
  if (currentPath === '') {
    // Add Pinned Notes section first if it exists
    if (pinnedNotes.length > 0) {
      const pinnedNotesNode: ITreeNode = {
        label: 'Pinned', // Label for the pinned notes section
        children: {},
      };

      pinnedNotes.forEach(note => {
        // Use note.url as the key and url, note.title as label
        pinnedNotesNode.children[note.url] = {
          label: note.title,
          children: {},
          url: note.url,
        };
      });
      treeNode['/pinned'] = pinnedNotesNode; // Add Pinned node first
    }

    // Add Home and Tags nodes after Pinned
    treeNode['/'] = { label: 'Home', children: {}, url: '/' };
    treeNode['/tags'] = {
      label: 'Popular Tags',
      children: {},
      url: '/tags',
    };
  }

  // Determine the target node for adding children (root or nested)
  const targetChildrenNode =
    currentPath === '' ? treeNode['/'].children : treeNode; // Children go under '/' if at root

  // Process directories
  for (const [dirName, group] of Object.entries(menuData)) {
    // Handle the root path case explicitly for constructing the path
    const fullDirPath =
      currentPath === '' ? '/' + dirName : path.join(currentPath, dirName); // Keep this for path construction

    const children: Record<string, ITreeNode> = {};

    // Recursively process subdirectories, passing tags along
    const nestedChildren = transformMenuDataToDirectoryTree(
      group.next_path,
      pinnedNotes,
      tags, // Pass tags in recursive call
      fullDirPath,
    );
    Object.assign(children, nestedChildren); // Add nested directories to children

    // Process sorted files
    for (const file of group.file_paths) {
      if (!file.title) {
        console.log(`File ${file.file_path} has no title. Skipping...`);
        continue; // Skip files without a title
      }
      // Explicitly type 'file'
      const fullFilePath = '/' + file.file_path; // File paths are already full paths relative to root

      const url = formatContentPath(file.file_path);

      children[fullFilePath] = {
        label: file.title, // Use file title as label
        children: {}, // Files have no children in the tree
        url: url, // Add the generated URL
      };
    }

    // Add the current directory node
    // For directories, the URL is the slugified path without trailing slash (unless root)
    const slugifiedDirPath = slugifyPathComponents(fullDirPath);
    const dirUrl =
      slugifiedDirPath === '/' ? '/' : slugifiedDirPath.replace(/\/$/, '');

    // Add the current directory node to the target children node
    const hasChildren = Object.keys(children).length > 0;
    if (hasChildren) {
      targetChildrenNode[fullDirPath] = {
        label: slugToTitle(dirName), // Use directory name as label for the directory node
        children: children,
        url: dirUrl, // Add the generated URL for directory
      };
    }
  }

  // Add Tags as children under '/tags' only at the root level
  if (currentPath === '' && tags.length > 0) {
    tags.slice(0, 41).forEach(({ name: tag, count }) => {
      const slugifiedTag = slugifyPathComponents(tag.toLowerCase());
      const tagUrl = `/tags/${slugifiedTag}`;
      treeNode['/tags'].children[tagUrl] = {
        label: `#${uppercaseSpecialWords(slugifiedTag, '-')}`, // Display tag with # prefix and count
        children: {},
        url: tagUrl,
        count, // Include count in the node
      };
    });
  }

  return treeNode;
}

const appendTagsCount = memoize((tags: string[], memos: IMemoItem[]) => {
  const tagCountMap = new Map<string, number>();

  // Count occurrences of each tag in the memos
  memos.forEach(memo => {
    memo.tags?.forEach(tag => {
      if (tag) {
        const normalizedTag = tag.toString().toLowerCase().replace(/\s+/g, '-');
        tagCountMap.set(
          normalizedTag,
          (tagCountMap.get(normalizedTag) || 0) + 1,
        );
      }
    });
  });

  // Append count to each tag
  return tags
    .map(tag => ({
      name: tag,
      count: tagCountMap.get(tag.toLowerCase()) || 0,
    }))
    .sort((a, b) => b.count - a.count); // Sort by count in descending order
});

export async function getRootLayoutPageProps(): Promise<RootLayoutPageProps> {
  let menuData: Record<string, GroupedPath> = {};
  let pinnedNotes: Array<{ title: string; url: string; date: string }> = [];
  let tags: string[] = [];

  try {
    // Attempt to fetch menu data from the static JSON file
    const menuDataPath = path.join(process.cwd(), 'public/content/menu.json');
    const menuDataJson = await fs.readFile(menuDataPath, 'utf-8');
    menuData = JSON.parse(menuDataJson);
  } catch (error) {
    console.error('Error fetching menu data:', error);
    // Continue with empty menuData if file not found or error occurs
  }

  try {
    // Attempt to fetch pinned notes from the static JSON file
    const pinnedNotesPath = path.join(
      process.cwd(),
      'public/content/pinned-notes.json',
    );
    const pinnedNotesJson = await fs.readFile(pinnedNotesPath, 'utf-8');
    pinnedNotes = JSON.parse(pinnedNotesJson);
  } catch (error) {
    console.error('Error fetching pinned notes:', error);
    // Continue with empty pinnedNotes if file not found or error occurs
  }

  try {
    // Attempt to fetch tags from the static JSON file
    const tagsPath = path.join(process.cwd(), 'public/content/tags.json');
    const tagsJson = await fs.readFile(tagsPath, 'utf-8');
    tags = JSON.parse(tagsJson);
  } catch (error) {
    console.error('Error fetching tags:', error);
    // Continue with empty tags if file not found or error occurs
  }

  const memos = await getAllMarkdownContents();
  const menuSortedPaths = await getMenuPathSorted();
  // Sort the menu data using the sorted paths
  const sortedMenuData = applyRecursiveMenuSortedField(
    menuData,
    menuSortedPaths,
  );

  // Pass tags array to the transformation function
  const directoryTree = transformMenuDataToDirectoryTree(
    sortedMenuData,
    pinnedNotes,
    appendTagsCount(tags, memos),
  );
  // console.log({ directoryTree, pinnedNotes, tags }); // Keep or remove logging as needed

  return {
    directoryTree,
  };
}
