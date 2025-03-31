import { IMemoItem, RootLayoutPageProps } from '@/types';
import { buildDirectorTree } from './directoryTree';
import { initializeSearchIndex, getSerializableSearchIndex } from './search';

export async function getRootLayoutPageProps(
  allMemos: IMemoItem[],
): Promise<RootLayoutPageProps> {
  await initializeSearchIndex();
  const searchIndex = getSerializableSearchIndex();
  const directoryTree = buildDirectorTree(allMemos);

  return {
    directoryTree,
    searchIndex,
  };
}
