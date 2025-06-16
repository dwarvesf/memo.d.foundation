import fs from 'fs/promises';
import path from 'path';
import { IMemoItem } from '@/types';
import { getAllMarkdownContents } from './memo';
import { memoize } from 'lodash';
import { uppercaseSpecialWords } from '../utils';

interface TagCount {
  name: string;
  count: number;
}

const appendTagsCount = memoize((tags: string[], memos: IMemoItem[]) => {
  const tagCountMap = new Map<string, number>();

  memos.forEach(memo => {
    memo.tags?.forEach(tag => {
      if (tag) {
        const normalizedTag = tag.toString().toLowerCase().replace(/\s+/g, '-');
        tagCountMap.set(
          normalizedTag,
          (tagCountMap.get(normalizedTag) || 0) + 1,
        );
      }
    });
  });

  return Array.from(new Set(tags.map(tag => tag.toLowerCase())))
    .map(tag => ({
      name: uppercaseSpecialWords(tag),
      count: tagCountMap.get(tag.toLowerCase()) || 0,
    }))
    .filter(tag => tag.count > 0)
    .sort((a, b) => b.count - a.count);
});

export async function getTagsWithCounts(): Promise<TagCount[]> {
  let tags: string[] = [];
  let memos: IMemoItem[] = [];

  try {
    const tagsPath = path.join(process.cwd(), 'public/content/tags.json');
    const tagsJson = await fs.readFile(tagsPath, 'utf-8');
    tags = JSON.parse(tagsJson);
  } catch (error) {
    console.error('Error fetching tags:', error);
  }

  try {
    memos = await getAllMarkdownContents();
  } catch (error) {
    console.error('Error fetching memos:', error);
  }

  return appendTagsCount(tags, memos);
}
