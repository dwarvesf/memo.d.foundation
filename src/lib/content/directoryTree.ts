import { IMemoItem, ITreeNode } from '@/types';
import { slugToTitle } from '../utils';

export function buildDirectorTree(allMemos: IMemoItem[]) {
  const root: Record<string, ITreeNode> = {
    '/pinned': { label: 'Pinned Notes', children: {} },
    '/': { label: 'Home', children: {} },
    '/tags': { label: 'Popular Tags', children: {} },
  };

  allMemos.forEach(memo => {
    // tags
    memo.tags?.forEach((tag: string) => {
      const currentTag = root['/tags'].children[`/tags/${tag}`];
      if (!currentTag) {
        root['/tags'].children[`/tags/${tag}`] = {
          label: `#${tag}`,
          children: {},
          count: 1,
        };
      } else {
        root['/tags'].children[`/tags/${tag}`] = {
          ...currentTag,
          count: (currentTag.count ?? 0) + 1,
        };
      }
    });

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

  return root;
}
export function getAllTags() {}
