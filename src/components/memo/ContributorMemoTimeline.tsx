import { IMemoItem } from '@/types';
import HotIcon from '../icons/HotIcon';
import BookOpenIcon from '../icons/BookOpenIcon';
import { formatContentPath } from '@/lib/utils/path-utils';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import Jdenticon from 'react-jdenticon';
import { Avatar, AvatarImage } from '../ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

interface ContributorMemoTimelineProps {
  data: IMemoItem[][][];
  memoCollectors: Record<string, Array<{ username: string; avatar?: string }>>;
}

const monthIndex = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

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

function Collectors({
  collectors,
}: {
  collectors: Array<{ username: string; avatar?: string }>;
}) {
  return collectors.map(collector => {
    return (
      <Tooltip key={collector.username}>
        <TooltipTrigger asChild>
          <Link href={`/contributor/${collector.username}`}>
            <Avatar className="dark:bg-secondary flex h-6.5 w-6.5 items-center justify-center border-2 bg-[#fff]">
              {collector.avatar ? (
                <AvatarImage src={collector.avatar} className="no-zoom !m-0" />
              ) : (
                <Jdenticon value={collector.username} size={24} />
              )}
            </Avatar>
          </Link>
        </TooltipTrigger>
        <TooltipContent
          arrowClassName="!bg-muted-foreground !fill-muted-foreground"
          className="!bg-muted-foreground !text-muted-foreground-foreground rounded-lg p-2 text-center text-xs font-medium shadow-md"
          sideOffset={-5}
        >
          <span>{collector.username}</span>
        </TooltipContent>
      </Tooltip>
    );
  });
}

function TimelineActivity({
  data,
  memoCollectors,
}: {
  data: IMemoItem[][];
  memoCollectors: Record<string, Array<{ username: string; avatar?: string }>>;
}) {
  return data.map(month => {
    const [, m, date] = month[0].date.split('-');

    if (month.length === 1) {
      const collectors = memoCollectors[month[0].tokenId ?? ''] ?? [];
      return (
        <div key={month[0].date} className="flex">
          <div className="relative mr-3">
            <div className="bg-border absolute top-0 bottom-0 left-1/2 w-[1.5px] -translate-x-1/2 rounded-full" />
            <div className="border-background bg-border relative mt-4 flex items-center justify-center rounded-full border-4 p-1.5">
              <Plus className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-5 flex w-full flex-col gap-y-2">
            <div className="flex justify-between">
              {collectors.length ? (
                <span className="flex flex-shrink-1 flex-wrap items-center gap-x-1.5 text-lg">
                  +{collectors.length} Collector
                  {collectors.length === 1 ? '' : 's'}
                  <div className="flex -space-x-2">
                    <Collectors collectors={collectors} />
                  </div>
                  interested in{' '}
                  <Link href={formatContentPath(month[0].filePath)}>
                    {month[0].title}
                  </Link>
                </span>
              ) : (
                <span className="text-lg">Published {month[0].title}</span>
              )}
              <span className="text-muted-foreground text-xs whitespace-nowrap">
                {monthIndex[parseInt(m) - 1]} {date}
              </span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={month[0].date} className="flex">
        <div className="relative mr-3">
          <div className="bg-border absolute top-0 bottom-0 left-1/2 w-[1.5px] -translate-x-1/2 rounded-full" />
          <div className="border-background bg-border relative mt-4 flex items-center justify-center rounded-full border-4 p-1.5">
            <HotIcon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-5 flex w-full flex-col gap-y-2">
          <div className="flex justify-between">
            <span className="text-lg">Published {month.length} memos</span>
            <span className="text-muted-foreground text-xs">
              {monthIndex[parseInt(m) - 1]} {date}
            </span>
          </div>
          <div className="flex flex-col">
            {month.map(d => {
              const collectors = memoCollectors[d.tokenId ?? ''] ?? [];
              return (
                <div className="flex items-center" key={d.filePath}>
                  <Link
                    href={formatContentPath(d.filePath)}
                    className="!text-muted-foreground hover:!text-primary flex items-center gap-x-2"
                  >
                    <BookOpenIcon className="h-4 w-4" />
                    <span>{d.title}</span>
                  </Link>
                  {collectors.length ? (
                    <div className="!text-muted-foreground ml-auto flex items-center gap-x-1">
                      <Collectors collectors={collectors} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
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
