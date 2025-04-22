import {
  RootLayoutPageProps,
  ITreeNode,
  GroupedPath,
  MenuFilePath,
} from '@/types';
import { slugifyPathComponents } from '../utils/slugify'; // Import slugifyPathComponents from utils
import path from 'path'; // Import path module
import fs from 'fs/promises'; // Use promises version for async file reading

/**
 * Transforms the nested menu data structure into the ITreeNode structure
 * expected by the DirectoryTree component.
 * @param menuData The nested menu data.
 * @param currentPath The current path during recursion (used internally).
 * @param pinnedNotes Array of pinned notes.
 * @returns A nested object representing the directory tree in ITreeNode format.
 */
function transformMenuDataToDirectoryTree(
  menuData: Record<string, GroupedPath>,
  pinnedNotes: Array<{ title: string; url: string; date: string }>, // Add pinnedNotes parameter
  currentPath = '',
): Record<string, ITreeNode> {
  const treeNode: Record<string, ITreeNode> = {};

  // Add Pinned Notes section at the root
  if (currentPath === '' && pinnedNotes.length > 0) {
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
    treeNode['/pinned'] = pinnedNotesNode; // Add to the root level with key '/pinned'
  }

  // Process directories (keys in menuData)
  Object.entries(menuData).forEach(([dirName, group]) => {
    // Handle the root path case explicitly
    const fullDirPath =
      currentPath === '' ? '/' + dirName : path.join(currentPath, dirName);
    const children: Record<string, ITreeNode> = {};

    // Recursively process subdirectories
    const nestedChildren = transformMenuDataToDirectoryTree(
      group.next_path,
      pinnedNotes, // Pass pinnedNotes in recursive call
      fullDirPath,
    );
    Object.assign(children, nestedChildren); // Add nested directories to children

    // Process files in the current directory
    group.file_paths.forEach((file: MenuFilePath) => {
      // Explicitly type 'file'
      const fullFilePath = '/' + file.file_path; // File paths are already full paths relative to root

      let url: string;
      // Check if it's a README file
      if (file.file_path.toLowerCase().endsWith('/readme.md')) {
        // Get parent directory path and slugify it
        const parentDirPath = path.dirname(file.file_path);
        url = '/' + slugifyPathComponents(parentDirPath);
        // Ensure root directory README links to '/'
        if (url === '/.') {
          url = '/';
        }
      } else {
        // Generate slugified URL for other files, removing .md suffix
        const slugifiedPath = slugifyPathComponents(file.file_path);
        url =
          '/' +
          (slugifiedPath.endsWith('.md')
            ? slugifiedPath.slice(0, -3)
            : slugifiedPath);
      }

      children[fullFilePath] = {
        label: file.title, // Use file title as label
        children: {}, // Files have no children in the tree
        url: url, // Add the generated URL
      };
    });

    // Add the current directory node
    // For directories, the URL is the slugified path without trailing slash (unless root)
    const slugifiedDirPath = slugifyPathComponents(fullDirPath);
    const dirUrl =
      slugifiedDirPath === '/' ? '/' : slugifiedDirPath.replace(/\/$/, '');

    treeNode[fullDirPath] = {
      label: dirName, // Use directory name as label for the directory node
      children: children,
      url: dirUrl, // Add the generated URL for directory
    };
  });

  return treeNode;
}

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

  const directoryTree = transformMenuDataToDirectoryTree(menuData, pinnedNotes);

  return {
    directoryTree,
    pinnedNotes,
    tags,
  };
}
