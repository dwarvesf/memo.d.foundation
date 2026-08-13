import { ITreeNode } from '@/types';
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';

export type DirectoryTree = Record<string, ITreeNode>;

export const DIRECTORY_TREE_PATH = '/content/directory-tree.json';

// The nav tree is a few hundred KB and byte-identical on every page. Shipping it
// through page props inlined a copy into every HTML file and every _next/data
// twin. It is now one static asset the browser fetches and caches once.
let cachedTree: DirectoryTree | undefined;
let inflight: Promise<DirectoryTree> | undefined;

// The asset path is stable across builds, so pin the request to the build id.
// A new deploy busts the cache; a repeat visit on the same build reuses it.
function directoryTreeUrl(): string {
  const nextData = (
    window as unknown as { __NEXT_DATA__?: { buildId?: string } }
  ).__NEXT_DATA__;
  return nextData?.buildId
    ? `${DIRECTORY_TREE_PATH}?v=${nextData.buildId}`
    : DIRECTORY_TREE_PATH;
}

function loadDirectoryTree(): Promise<DirectoryTree> {
  if (!inflight) {
    inflight = fetch(directoryTreeUrl())
      .then(response => {
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        return response.json() as Promise<DirectoryTree>;
      })
      .then(tree => {
        cachedTree = tree;
        return tree;
      })
      .catch(error => {
        console.error('Error fetching directory tree:', error);
        // Drop the settled promise so a later mount can retry.
        inflight = undefined;
        return {} as DirectoryTree;
      });
  }
  return inflight;
}

const DirectoryTreeContext = createContext<DirectoryTree | undefined>(
  undefined,
);

export const DirectoryTreeProvider = ({ children }: PropsWithChildren) => {
  const [tree, setTree] = useState<DirectoryTree | undefined>(cachedTree);

  useEffect(() => {
    if (tree) return;
    let active = true;
    loadDirectoryTree().then(loaded => {
      if (active) setTree(loaded);
    });
    return () => {
      active = false;
    };
  }, [tree]);

  return (
    <DirectoryTreeContext.Provider value={tree}>
      {children}
    </DirectoryTreeContext.Provider>
  );
};

// Undefined until the fetch resolves. Every consumer already handles a missing tree.
export const useDirectoryTree = () => useContext(DirectoryTreeContext);
