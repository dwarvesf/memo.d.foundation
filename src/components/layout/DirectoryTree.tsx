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
    const isActive = currentPath === path;
    const sortedChildren = Object.entries(node.children).sort(
      ([, a], [, b]) => {
        // First sort by whether it has children (directories first)
        const aHasChildren = Object.keys(a.children).length > 0;
        const bHasChildren = Object.keys(b.children).length > 0;

        if (aHasChildren && !bHasChildren) return -1;
        if (!aHasChildren && bHasChildren) return 1;

        // Then sort alphabetically
        if (a.label < b.label) return -1;
        if (a.label > b.label) return 1;
        return 0;
      },
    );
    if (depth === 0 && !hasChildren) {
      return null;
    }
    return (
      <div
        key={path}
        className={cn('relative flex flex-col', {
          "before:bg-border pl-2.5 before:absolute before:top-0 before:left-[7px] before:h-full before:w-[1px] before:content-['']":
            depth > 0,
          'before:bg-primary': isActive,
        })}
      >
        <Link
          href={path}
          onClick={e => {
            if (hasChildren) {
              e.preventDefault();
              toggleOpenPath(path);
              return;
            }
          }}
          className={cn(
            'flex cursor-pointer items-center gap-1 p-1 text-left text-xs font-medium',
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
                  '-rotate-90': isOpen,
                },
              )}
            />
          )}
          <span>{node.label}</span>
        </Link>
        {hasChildren && isOpen && (
          <div className="m-0 w-full pl-1">
            {sortedChildren.map(([childPath, childNode]) => {
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
        'bg-background-secondary h-[calc(100svh-32px)] w-0 flex-col pt-10 pb-2 pl-0 text-sm leading-normal xl:w-[calc(72px+200px+28px)] xl:pr-3 xl:pl-18 2xl:w-[360px]',
        'translate-0 transition duration-100 ease-in-out',
        'z-2 overflow-y-auto',
        'reading:opacity-0 reading:translate-x-[-10%] xl:reading:w-[72px] reading:pr-0',
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
