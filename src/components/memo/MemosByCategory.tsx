import { IMemoItem } from '@/types';
import { useMemo } from 'react';
import MemoTimelineList from './MemoTimelineList';

interface Props {
  data: IMemoItem[];
}

const MemosByCategory = (props: Props) => {
  const { data = [] } = props;
  const groupedData = useMemo(() => {
    return data.reduce(
      (acc, memo) => {
        const folderParts = memo.filePath.split('/').slice(0, -1);
        const lastFolder = folderParts[folderParts.length - 1];

        if (!lastFolder) {
          return acc;
        }
        if (!acc[lastFolder]) {
          acc[lastFolder] = [];
        }
        acc[lastFolder].push(memo);
        return acc;
      },
      {} as Record<string, IMemoItem[]>,
    );
  }, [data]);

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(groupedData).map(([tag, memos]) => (
        <MemoTimelineList key={tag} title={tag} data={memos} />
      ))}
    </div>
  );
};

export default MemosByCategory;
