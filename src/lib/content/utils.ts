import { IMemoItem, RootLayoutPageProps } from '@/types';
import { buildDirectorTree } from './directoryTree';
import { initializeSearchIndex } from './search';

export async function getRootLayoutPageProps(
  allMemos: IMemoItem[],
): Promise<RootLayoutPageProps> {
  await initializeSearchIndex();
  const directoryTree = buildDirectorTree(allMemos);

  return {
    directoryTree,
  };
}
