import { RootLayoutPageProps, ITreeNode } from '@/types';
import {
  getMenu,
  getPinnedNotes,
  getTags,
  GroupedPath,
  MenuFilePath,
  slugifyPathComponents, // Import slugifyPathComponents
} from './menu';
import path from 'path'; // Import path module

/**
 * Transforms the nested menu data structure from getMenu into the ITreeNode structure
 * expected by the DirectoryTree component.
 * @param menuData The nested menu data from getMenu.
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
  console.log('Fetching layout props using menu.ts functions...');
  const menuData = await getMenu();
  const pinnedNotes = await getPinnedNotes();
  const tags = await getTags();

  const directoryTree = transformMenuDataToDirectoryTree(menuData, pinnedNotes); // Pass pinnedNotes

  return {
    directoryTree,
    pinnedNotes,
    tags,
  };
}
