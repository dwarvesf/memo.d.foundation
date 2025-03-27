import { ITreeNode } from '@/types';
import { slugToTitle } from '../utils';
import path from 'path';
import matter from 'gray-matter';
import fs from 'fs';

export function buildDirectorTree(paths: string[][]) {
  const root: Record<string, ITreeNode> = {
    '/pinned': { label: 'Pinned Notes', children: {} },
    '/': { label: 'Home', children: {} },
    '/tags': { label: 'Popular Tags', children: {} },
  };
  const contentDir = path.join(process.cwd(), 'public/content');

  const tags = new Set<string>();
  paths.forEach(slugArray => {
    const filePath = path.join(contentDir, ...slugArray) + '.md';
    if (!fs.existsSync(filePath)) {
      return null;
    }
    // Read the markdown file
    const markdownContent = fs.readFileSync(filePath, 'utf-8');
    // Parse frontmatter and content

    // tags
    const { data: frontmatter } = matter(markdownContent);
    if (frontmatter.tags) {
      frontmatter.tags.forEach((tag: string) => tags.add(tag));
    }

    // pinned
    if (frontmatter.pinned) {
      root['/pinned'].children[`/${slugArray.join('/')}`] = {
        label:
          frontmatter.title || slugToTitle(slugArray[slugArray.length - 1]),
        children: {},
      };
    }
    // path
    let currentNode = root['/'].children;

    let currentPath = '';
    slugArray.forEach((part, partIndex) => {
      currentPath += '/' + part;
      if (!currentNode[currentPath]) {
        currentNode[currentPath] = {
          label:
            partIndex === slugArray.length - 1
              ? frontmatter.title || slugToTitle(part)
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
