import { cn, slugToTitle } from '@/lib/utils';
import { ITreeNode } from '@/types';
import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { ChevronDownIcon } from 'lucide-react';
import { useSessionStorage } from 'usehooks-ts';
import Link from 'next/link';

interface DirectoryTreeProps {
  tree?: Record<string, ITreeNode>;
}

const DirectoryTree = (props: DirectoryTreeProps) => {
  const { tree } = props;
  const router = useRouter();
  const isInitializedRef = useRef(false);
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

  // Auto-expand paths for the current route
  useEffect(() => {
    if (!tree) return;

    // Normalize the current path
    const currentPath = router.asPath.endsWith('/')
      ? router.asPath.slice(0, -1)
      : router.asPath;

    // Function to find the path in the tree
    const findPathInTree = (
      nodes: Record<string, ITreeNode>,
      targetPath: string,
      parentPaths: string[] = [],
    ): string[] | null => {
      for (const [nodePath, node] of Object.entries(nodes)) {
        // Check if this is our target
        if (node.url === targetPath) {
          return [...parentPaths, nodePath];
        }

        // Check children if they exist
        if (Object.keys(node.children).length > 0) {
          const result = findPathInTree(node.children, targetPath, [
            ...parentPaths,
            nodePath,
          ]);
          if (result) return result;
        }
      }

      return null;
    };

    // Find the path segments that lead to the current page
    const pathSegments = findPathInTree(tree, currentPath);
    if (pathSegments) {
      // Update the open paths
      setOpenPaths(prev => {
        const newOpenPaths = { ...prev };
        pathSegments.forEach(path => {
          // Ignore leaf nodes that are markdown files
          if (path.endsWith('.md')) {
            return;
          }
          newOpenPaths[path] = true;
        });
        return newOpenPaths;
      });
      const leafPath = pathSegments[pathSegments.length - 1];
      setTimeout(() => {
        const element = document.querySelector(`[data-path="${leafPath}"]`);
        if (element) {
          element.scrollIntoView({
            // Block scrolling to the center on first load, then to nearest
            // to avoid flickering
            block: isInitializedRef.current ? 'nearest' : 'center',
            inline: 'start',
          });
        }
        isInitializedRef.current = true;
      }, 500);
    }
  }, [router.asPath, tree, setOpenPaths]);

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
    const isActive = (() => {
      const currentPath = router.asPath.endsWith('/')
        ? router.asPath.slice(0, -1)
        : router.asPath;

      // Check if current path is a readme or index of this path
      const isCurrentPathSpecial =
        currentPath.endsWith('/readme') || currentPath.endsWith('/_index');
      if (isCurrentPathSpecial) {
        // If the current path is a readme or index, check if the node's URL matches the parent path
        const parentPath = currentPath.substring(
          0,
          currentPath.lastIndexOf('/'),
        );
        // Normalize both paths by removing any trailing slashes
        const normalizedParentPath = parentPath.endsWith('/')
          ? parentPath.slice(0, -1)
          : parentPath;
        const normalizedNodeUrl = node.url?.endsWith('/')
          ? node.url.slice(0, -1)
          : node.url;
        return normalizedNodeUrl === normalizedParentPath;
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
          'after:bg-primary after:scale-y-100':
            isActive && depth > 0 && !hasChildren,
        })}
        data-path={path}
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
