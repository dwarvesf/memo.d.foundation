import { RootLayoutPageProps } from '@/types';
import path from 'path';
import { buildDirectorTree } from './directoryTree';
import { getAllMarkdownFiles } from './paths';
import { initializeSearchIndex, getSerializableSearchIndex } from './search';

export function getContentPath(slug: string) {
  const contentDir = path.join(process.cwd(), 'public/content');

  return path.join(contentDir, slug);
}

export async function getRootLayoutPageProps(): Promise<RootLayoutPageProps> {
  const contentDir = getContentPath('');
  await initializeSearchIndex();
  const searchIndex = getSerializableSearchIndex();
  // Get all markdown files
  const allPaths = getAllMarkdownFiles(contentDir);
  const directoryTree = buildDirectorTree(allPaths);
  return {
    directoryTree,
    searchIndex,
  };
}
