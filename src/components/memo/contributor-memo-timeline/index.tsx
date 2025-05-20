import { Activity, CollectMemo, IMemoItem } from '@/types';
import { TooltipProvider } from '../../ui/tooltip';
import { monthIndex } from './util';
import { PublishMemoActivity } from './publish-memo-activity';
import { CollectMemoActivity } from './collect-memo-activity';

interface ContributorMemoTimelineProps {
  data: Activity[][][];
  memoCollectors: Record<string, Array<{ username: string; avatar?: string }>>;
}

function TimelineHeader({ date }: { date: string }) {
  const [year, month] = date.split('-');
  return (
    <span className="mb-3 flex items-center gap-x-3">
      <span className="text-muted-foreground font-sans text-xs font-semibold whitespace-nowrap">
        <span className="text-foreground">
          {monthIndex[parseInt(month) - 1]}
        </span>{' '}
        {year}
      </span>
      <div className="bg-border h-px w-full" />
    </span>
  );
}

function TimelineActivity({
  data,
  memoCollectors,
}: {
  data: Activity[][];
  memoCollectors: Record<string, Array<{ username: string; avatar?: string }>>;
}) {
  return data.map(month => {
    const firstItem = month[0];
    const isCollectMemo = 'type' in firstItem && firstItem.type === 'collect';

    if (isCollectMemo) {
      return (
        <CollectMemoActivity
          key={`collect-memo-${month[0].date}`}
          data={month as CollectMemo[]}
        />
      );
    }

    return (
      <PublishMemoActivity
        key={`publish-memo-${month[0].date}`}
        data={month as IMemoItem[]}
        memoCollectors={memoCollectors}
      />
    );
  });
}

function ContributorMemoTimeline({
  data,
  memoCollectors,
}: ContributorMemoTimelineProps) {
  return (
    <div className="flex flex-col gap-y-10">
      <TooltipProvider>
        {data.map(year => {
          return (
            <div key={`year-${year[0][0].date}`} className="flex flex-col">
              <TimelineHeader date={year[0][0].date} />
              <TimelineActivity data={year} memoCollectors={memoCollectors} />
            </div>
          );
        })}
      </TooltipProvider>
    </div>
  );
}

export default ContributorMemoTimeline;
