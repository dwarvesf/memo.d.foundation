import fs from 'fs';
import matter from 'gray-matter';
import { getAllMarkdownFiles, getContentPath } from './paths';
import path from 'path';
import { IMemoItem } from '@/types';

interface GetAllMarkdownContentsOptions {
  includeContent?: boolean;
}

export function getAllMarkdownContents(
  basePath = '',
  options: GetAllMarkdownContentsOptions = {},
) {
  const { includeContent = true } = options; // Default to true
  const contentDir = getContentPath(basePath);
  const allPaths = getAllMarkdownFiles(contentDir);
  const baseSlugArray = basePath.split('/').filter(Boolean);
  return allPaths
    .map(slugArray => {
      const filePath = path.join(contentDir, ...slugArray) + '.md';
      if (!fs.existsSync(filePath)) {
        return null;
      }
      // Read the markdown file
      const markdownContent = fs.readFileSync(filePath, 'utf-8');
      // Parse frontmatter and content

      // tags
      const result = matter(markdownContent);
      const item: IMemoItem = {
        content: includeContent ? result.content : '', // Conditionally include content
        title: result.data.title || slugArray[slugArray.length - 1],
        short_title: result.data.short_title || '',
        description: result.data.description || '',
        tags: Array.isArray(result.data.tags)
          ? result.data.tags.filter(
              tag => tag !== null && tag !== undefined && tag !== '',
            )
          : [],
        pinned: result.data.pinned || false,
        draft: result.data.draft || false,
        hiring: result.data.hiring || false,
        authors: result.data.authors || [],
        date: result.data.date?.toString() || null,
        filePath: path.join(basePath, ...slugArray) + '.md',
        slugArray: [...baseSlugArray, ...slugArray],
      };
      return item;
    })
    .filter(Boolean) as IMemoItem[];
}

interface FilterMemoProps {
  data: IMemoItem[];
  filters?: { tags?: string; hiring?: boolean; authors?: string };
  sortBy?: keyof IMemoItem;
  sortOrder?: 'asc' | 'desc';
  limit?: number | null;
  excludeContent?: boolean;
}
export function sortMemos(
  data: IMemoItem[],
  sortBy: keyof IMemoItem = 'date',
  sortOrder: 'asc' | 'desc' = 'desc',
) {
  return data.sort((a, b) => {
    if (sortBy && a[sortBy] && b[sortBy]) {
      return sortOrder === 'desc'
        ? new Date(b[sortBy] as string).getTime() -
            new Date(a[sortBy] as string).getTime()
        : new Date(a[sortBy] as string).getTime() -
            new Date(b[sortBy] as string).getTime();
    }

    return 0;
  });
}

export function filterMemo(props: FilterMemoProps) {
  const { data, filters, limit = 3, excludeContent = false } = props;
  const result: IMemoItem[] = [];
  for (const memo of data) {
    const invalid =
      filters &&
      Object.entries(filters).some(([key, value]) => {
        if (value === undefined) {
          return false;
        }
        if (key === 'tags') {
          return (
            !memo.tags?.length ||
            !memo.tags?.some(tag => tag && tag.includes(value as string))
          );
        }
        if (key === 'authors') {
          return (
            !memo.authors?.length ||
            !memo.authors?.some(
              author => author && author.includes(value as string),
            )
          );
        }

        return memo[key as keyof IMemoItem] !== value;
      });
    if (invalid) {
      continue;
    }
    result.push({
      ...memo,
      content: excludeContent ? '' : memo.content,
    });
    if (limit && result.length >= limit) {
      break;
    }
  }

  return result;
}
