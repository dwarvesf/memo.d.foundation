import { IMemoItem, ITreeNode } from '@/types';
import { slugToTitle } from '../utils';

export function buildDirectorTree(allMemos: IMemoItem[]) {
  const root: Record<string, ITreeNode> = {
    '/pinned': { label: 'Pinned Notes', children: {} },
    '/': { label: 'Home', children: {} },
    '/tags': { label: 'Popular Tags', children: {} },
  };

  const tags = new Set<string>();
  allMemos.forEach(memo => {
    // tags
    memo.tags?.forEach((tag: string) => tags.add(tag));

    // pinned
    if (memo.pinned) {
      root['/pinned'].children[`/${memo.slugArray.join('/')}`] = {
        label:
          memo.title || slugToTitle(memo.slugArray[memo.slugArray.length - 1]),
        children: {},
      };
    }
    // path
    let currentNode = root['/'].children;

    let currentPath = '';
    memo.slugArray.forEach((part, partIndex) => {
      currentPath += '/' + part;
      if (!currentNode[currentPath]) {
        currentNode[currentPath] = {
          label:
            partIndex === memo.slugArray.length - 1
              ? memo.title || slugToTitle(part)
              : slugToTitle(part),
          children: {},
        };
      }
      currentNode = currentNode[currentPath].children;
    });
  });
  tags.forEach(tag => {
    root['/tags'].children[`/tags/${tag}`] = {
      label: `#${tag}`,
      children: {},
    };
  });

  return root;
}
export function getAllTags() {}
