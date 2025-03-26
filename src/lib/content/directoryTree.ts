import { ITreeNode } from '@/types';
import { slugToTitle } from '../utils';

export function buildDirectorTree(paths: string[][]) {
  const root: Record<string, ITreeNode> = {
    '/': { label: 'Home', children: {} },
  };

  paths.forEach(path => {
    let currentNode = root['/'].children;

    let currentPath = '';
    path.forEach(part => {
      currentPath += '/' + part;
      if (!currentNode[currentPath]) {
        currentNode[currentPath] = {
          label: slugToTitle(part),
          children: {},
        };
      }
      currentNode = currentNode[currentPath].children;
    });
  });

  return root;
}
export function getAllTags() {}
