import { cn, slugToTitle } from '@/lib/utils'; // Import slugToTitle
import { ITreeNode } from '@/types';
import React from 'react';
import { useRouter } from 'next/router';
import { ChevronDownIcon } from 'lucide-react';
import { useSessionStorage } from 'usehooks-ts';
import Link from 'next/link';

interface DirectoryTreeProps {
  tree?: Record<string, ITreeNode>;
  // pinnedNotes and tags are no longer used directly by DirectoryTree
}

const DirectoryTree = (props: DirectoryTreeProps) => {
  const { tree } = props;
  const router = useRouter();
  const currentPath = router.asPath;
  const [openPaths, setOpenPaths] = useSessionStorage<Record<string, boolean>>(
    'directoryTreeOpenPaths',
    {
      '/pinned': true,
      '/': true,
    },
    {
      initializeWithValue: false,
    },
  );

  const toggleOpenPath = (path: string) => {
    setOpenPaths(prev => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const renderMenuItems = (node: ITreeNode, path = '', depth = 0) => {
    const isOpen = openPaths[path];
    const hasChildren = Object.keys(node.children).length > 0;
    const itemChildren = Object.entries(node.children);
    const withChildrenItems = itemChildren.filter(([, childNode]) => {
      return Object.keys(childNode.children).length > 0;
    });

    const withoutChildrenItems = itemChildren.filter(([, childNode]) => {
      return Object.keys(childNode.children).length === 0;
    });
    const allItems = [...withChildrenItems, ...withoutChildrenItems];
    if (depth === 0 && !hasChildren) {
      return null;
    }

    // Determine if this item should be marked as active
    // Use node.url for comparison as it's the final link path
    const isActive = (() => {
      // Never activate expandable groups
      if (hasChildren) {
        return false;
      }

      // Check if current path is a readme or index of this path
      // This logic might need adjustment based on how README URLs are handled
      // in the new data structure. Assuming node.url for READMEs is the parent path.
      const isCurrentPathSpecial =
        currentPath.endsWith('/readme') || currentPath.endsWith('/_index');
      if (isCurrentPathSpecial) {
        // If the current path is a readme or index, check if the node's URL matches the parent path
        const parentPath = currentPath.substring(
          0,
          currentPath.lastIndexOf('/'),
        );
        return node.url === parentPath;
      }

      // For all other cases, only highlight exact matches with the node's URL
      return currentPath === node.url;
    })();

    return (
      <div
        key={path} // path is the full path here, still useful as a unique key
        className={cn('relative flex flex-col', {
          "before:bg-border pl-3 before:absolute before:top-0 before:left-[7px] before:h-full before:w-[1px] before:content-['']":
            depth > 0,
          "after:bg-border pl-3 after:absolute after:top-1/2 after:left-[7px] after:h-full after:w-[1px] after:origin-center after:-translate-y-1/2 after:scale-y-0 after:transition-transform after:duration-300 after:ease-in-out after:content-['']":
            depth > 0,
          'after:bg-primary after:scale-y-100': isActive && depth > 0,
        })}
      >
        <Link
          href={node.url || path} // Use node.url for the link, fallback to path if url is missing
          onClick={e => {
            if (hasChildren) {
              e.preventDefault();
              toggleOpenPath(path);
              return;
            }
          }}
          className={cn(
            'flex cursor-pointer items-center gap-1 p-1.25 text-left text-xs leading-normal font-medium',
            {
              'text-muted-foreground pl-2': !hasChildren,
              'text-primary': isActive,
            },
          )}
        >
          {hasChildren && (
            <ChevronDownIcon
              size={14}
              className={cn(
                'stroke-muted-foreground transition-all duration-300 ease-in-out',
                {
                  '-rotate-90': !isOpen,
                },
              )}
            />
          )}
          <span>
            {node.ignoreLabelTransform ? node.label : slugToTitle(node.label)}
            {typeof node.count === 'number' ? (
              <span className="opacity-50"> ({node.count})</span>
            ) : (
              ''
            )}
          </span>
        </Link>
        {hasChildren && isOpen && (
          <div className="m-0 w-full pl-1">
            {allItems.map(([childPath, childNode]) => {
              return renderMenuItems(childNode, childPath, depth + 1);
            })}
          </div>
        )}
      </div>
    );
  };

  if (!tree) {
    return null;
  }

  return (
    <div
      id="sidebar"
      className={cn(
        'bg-background-secondary xl:w-directory-width h-[calc(100svh-32px)] w-0 flex-col pt-4 pb-2 text-sm leading-normal xl:pr-3',
        'xl:ml-sidebar',
        'translate-0 transition duration-100 ease-in-out',
        'z-2 overflow-y-auto',
        'reading:opacity-0 reading:translate-x-[-10%] reading:pr-0 reading:w-0 reading:ml-0',
      )}
    >
      <div className="">
        {Object.entries(tree).map(([path, node]) => {
          return renderMenuItems(node, path);
        })}
      </div>
    </div>
  );
};

export default DirectoryTree;
