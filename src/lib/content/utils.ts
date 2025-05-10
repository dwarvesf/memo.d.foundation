import {
  RootLayoutPageProps,
  ITreeNode,
  GroupedPath,
  MenuFilePath,
  IMemoItem,
} from '@/types';
import { slugifyPathComponents } from '../utils/slugify'; // Import slugifyPathComponents from utils
import { formatContentPath } from '../utils/path-utils'; // Import formatContentPath from path-utils
import path from 'path'; // Import path module
import fs from 'fs/promises'; // Use promises version for async file reading
import { uppercaseSpecialWords } from '../utils';
import { getAllMarkdownContents } from './memo';
import { memoize } from 'lodash';

/**
 * Helper function to read and apply sort order
 */
function applySortOrder<T>(
  items: T[],
  getItemName: (item: T) => string | number,
  order: 'asc' | 'desc' = 'asc',
): T[] {
  return [...items].sort((a, b) => {
    const multiplier = order === 'asc' ? 1 : -1;
    const aa = getItemName(a);
    const bb = getItemName(b);
    const isNumber = typeof aa === 'number' && typeof bb === 'number';
    if (isNumber) {
      return (aa - bb) * multiplier;
    }
    return String(aa).localeCompare(String(bb)) * multiplier;
  });
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

      const sortedPinnedNotes = applySortOrder(
        pinnedNotes,
        note => note.title, // Sort by title
      );

      sortedPinnedNotes.forEach(note => {
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

  // Sort and process directories
  const dirEntries = Object.entries(menuData);
  const sortedDirectories = applySortOrder(dirEntries, ([dirName]) => dirName);

  // Process directories
  for (const [dirName, group] of sortedDirectories) {
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

    // Sort and process files in the current directory
    const sortedFiles = applySortOrder<MenuFilePath>(
      group.file_paths,
      file => file.title,
    );

    // Process sorted files
    for (const file of sortedFiles) {
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
    targetChildrenNode[fullDirPath] = {
      label: dirName, // Use directory name as label for the directory node
      children: children,
      url: dirUrl, // Add the generated URL for directory
    };
  }

  // Add sorted Tags as children under '/tags' only at the root level
  if (currentPath === '' && tags.length > 0) {
    // Sort tags by count in descending order
    const sortedTags = applySortOrder(tags, tag => tag.count, 'desc');
    sortedTags.slice(0, 41).forEach(({ name: tag, count }) => {
      const slugifiedTag = slugifyPathComponents(tag.toLowerCase());
      const tagUrl = `/tags/${slugifiedTag}`;
      treeNode['/tags'].children[tagUrl] = {
        label: `#${uppercaseSpecialWords(slugifiedTag, '-')}`, // Display tag with # prefix and count
        children: {},
        url: tagUrl,
        ignoreLabelTransform: true,
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
        const normalizedTag = tag.toLowerCase().replace(/\s+/g, '-');
        tagCountMap.set(
          normalizedTag,
          (tagCountMap.get(normalizedTag) || 0) + 1,
        );
      }
    });
  });

  // Append count to each tag
  return tags.map(tag => ({
    name: tag,
    count: tagCountMap.get(tag.toLowerCase()) || 0,
  }));
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

  // Pass tags array to the transformation function
  const directoryTree = transformMenuDataToDirectoryTree(
    menuData,
    pinnedNotes,
    appendTagsCount(tags, memos),
  );
  // console.log({ directoryTree, pinnedNotes, tags }); // Keep or remove logging as needed

  return {
    directoryTree,
  };
}
