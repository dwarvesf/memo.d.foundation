import { IMemoItem, RootLayoutPageProps } from '@/types';
import { buildDirectorTree } from './directoryTree';

export async function getRootLayoutPageProps(
  allMemos: IMemoItem[],
): Promise<RootLayoutPageProps> {
  const directoryTree = buildDirectorTree(allMemos);

  return {
    directoryTree,
  };
}
