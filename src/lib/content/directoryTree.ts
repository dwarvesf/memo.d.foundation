import { IMemoItem, ITreeNode } from '@/types';
import { slugToTitle, uppercaseSpecialWords } from '../utils';
import { sortMemos } from './memo';

export const ExcludePaths = ['site-index.md', 'contributing.md'];
export function buildDirectorTree(allMemos: IMemoItem[]) {
  const sortedMemos = sortMemos(allMemos);
  const root: Record<string, ITreeNode> = {
    '/pinned': { label: 'Pinned Notes', children: {} },
    '/': { label: 'Home', children: {} },
    '/tags': { label: 'Popular Tags', children: {} },
  };

  sortedMemos.forEach(memo => {
    // Skip excluded paths
    if (ExcludePaths.includes(memo.filePath)) {
      return;
    }
    // tags
    memo.tags?.forEach((tag: string) => {
      const normalizedTag = tag.toLowerCase();
      const currentTag = root['/tags'].children[`/tags/${normalizedTag}`];
      if (!currentTag) {
        root['/tags'].children[`/tags/${normalizedTag}`] = {
          label: `#${uppercaseSpecialWords(normalizedTag)}`,
          children: {},
          count: 1,
        };
      } else {
        root['/tags'].children[`/tags/${normalizedTag}`] = {
          ...currentTag,
          count: (currentTag.count ?? 0) + 1,
        };
      }
    });

    // pinned
    if (memo.pinned && memo.slugArray) {
      root['/pinned'].children[`/${memo.slugArray.join('/')}`] = {
        label:
          uppercaseSpecialWords(memo.short_title || memo.title) ||
          slugToTitle(memo.slugArray[memo.slugArray.length - 1]),
        children: {},
      };
    }
    // path
    let currentNode = root['/'].children;

    let currentPath = '';
    memo.slugArray?.forEach((part, partIndex, arr) => {
      currentPath += '/' + part;
      if (!currentNode[currentPath]) {
        currentNode[currentPath] = {
          label:
            partIndex === arr.length - 1
              ? uppercaseSpecialWords(memo.short_title || memo.title) ||
                slugToTitle(part)
              : slugToTitle(part),
          children: {},
        };
      }
      currentNode = currentNode[currentPath].children;
    });
  });

  // hasChildren first
  return root;
}
