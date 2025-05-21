import fs from 'fs/promises'; // Use asynchronous promises API
import matter from 'gray-matter';
import { getAllMarkdownFiles, getContentPath } from './paths';
import path from 'path';
import { IMemoItem } from '@/types';
import { Json } from '@duckdb/node-api';
import { getFirstMemoImage } from '@/components/memo/utils';

interface GetAllMarkdownContentsOptions {
  includeContent?: boolean;
}

export async function getAllMarkdownContents( // Make the function asynchronous
  basePath = '',
  options: GetAllMarkdownContentsOptions = {},
): Promise<IMemoItem[]> {
  // Update return type to Promise
  const { includeContent = true } = options; // Default to true
  const contentDir = getContentPath(basePath);
  const allPaths = await getAllMarkdownFiles(contentDir); // Await the asynchronous function
  const baseSlugArray = basePath.split('/').filter(Boolean);

  // Create an array of promises for each file operation
  const memoPromises = allPaths.map(async slugArray => {
    const filePath = path.join(contentDir, ...slugArray) + '.md';
    try {
      await fs.stat(filePath);
    } catch {
      return null; // Return null if file doesn't exist
    }

    // Read the markdown file
    const markdownContent = await fs.readFile(filePath, 'utf-8');
    // Parse frontmatter and content
    const result = matter(markdownContent);
    const item: IMemoItem = {
      content: includeContent ? result.content : '',
      title: result.data.title || slugArray[slugArray.length - 1],
      short_title: result.data.short_title || '',
      description: result.data.description || '',
      tags: Array.isArray(result.data.tags)
        ? result.data.tags
            .filter(tag => tag !== null && tag !== undefined && tag !== '')
            .map(tag => tag.toString()) // Convert to string
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
  });

  // Await all promises concurrently
  const memos = await Promise.all(memoPromises);

  return memos.filter(Boolean) as IMemoItem[];
}

interface FilterMemoProps {
  data: IMemoItem[];
  filters?: {
    tags?: string;
    hiring?: boolean;
    authors?: string;
    path?: string;
  };
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
        if (key === 'path') {
          return memo.filePath.startsWith(value as string);
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

export function convertToMemoItem(
  memo: Record<string, Json>,
  keepContent = false,
): IMemoItem {
  const { file_path, md_content, token_id, ...rest } = memo;
  return {
    ...rest,
    title: memo.title as string,
    short_title: memo.short_title as string,
    description: memo.description as string,
    date: memo.date as string,
    content: keepContent ? (md_content as string) : '',
    filePath: file_path as string,
    image: getFirstMemoImage(
      {
        filePath: file_path as string,
        content: md_content as string,
      },
      null,
    ),
    tokenId: token_id ? (token_id as string) : null,
  };
}
export function convertToMemoItems(
  memos: Record<string, Json>[],
  keepContent = false,
): IMemoItem[] {
  return memos.map(memo => convertToMemoItem(memo, keepContent));
}
