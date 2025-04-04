import { cn } from '@/lib/utils';
import { ITreeNode } from '@/types';
import React from 'react';
import { useRouter } from 'next/router';
import { ChevronDownIcon } from 'lucide-react';
import { useSessionStorage } from 'usehooks-ts';
import Link from 'next/link';

interface DirectoryTreeProps {
  tree?: Record<string, ITreeNode>;
  pinnedNotes?: Array<{
    title: string;
    url: string;
    date: string;
  }>;
  tags?: Array<{
    tags?: string[];
    date: string;
  }>;
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
    const withChildrenItems = itemChildren
      .filter(([, childNode]) => {
        return Object.keys(childNode.children).length > 0;
      })
      .sort(([, a], [, b]) => {
        if (a.label < b.label) return -1;
        if (a.label > b.label) return 1;
        return 0;
      });

    const withoutChildrenItems = itemChildren.filter(([, childNode]) => {
      return Object.keys(childNode.children).length === 0;
    });
    const allItems = [...withChildrenItems, ...withoutChildrenItems];
    if (depth === 0 && !hasChildren) {
      return null;
    }

    // Check if this is a readme entry
    const isReadmeEntry = path.endsWith('/readme');
    // Get parent path for readme entries
    const linkPath = isReadmeEntry
      ? path.substring(0, path.lastIndexOf('/'))
      : path;

    // Determine if this item should be marked as active
    const isActive = (() => {
      // Never activate expandable groups
      if (hasChildren) {
        return false;
      }

      // For readme entries, highlight the parent path
      if (isReadmeEntry) {
        return currentPath === linkPath;
      }

      // Check if current path is a readme/index of this path
      const isCurrentPathReadme = currentPath.endsWith('/readme');
      if (isCurrentPathReadme) {
        const parentPath = currentPath.substring(
          0,
          currentPath.lastIndexOf('/'),
        );
        return path === parentPath;
      }

      // For all other cases, only highlight exact matches
      return currentPath === path;
    })();

    return (
      <div
        key={path}
        className={cn('relative flex flex-col', {
          "before:bg-border pl-3 before:absolute before:top-0 before:left-[7px] before:h-full before:w-[1px] before:content-['']":
            depth > 0,
          "after:bg-border pl-3 after:absolute after:top-1/2 after:left-[7px] after:h-full after:w-[1px] after:origin-center after:-translate-y-1/2 after:scale-y-0 after:transition-transform after:duration-300 after:ease-in-out after:content-['']":
            depth > 0,
          'after:bg-primary after:scale-y-100': isActive && depth > 0,
        })}
      >
        <Link
          href={linkPath}
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
          <span>{node.label}</span>
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
        'bg-background-secondary xl:w-directory-width h-[calc(100svh-32px)] w-0 flex-col pt-10 pb-2 text-sm leading-normal xl:pr-3',
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
