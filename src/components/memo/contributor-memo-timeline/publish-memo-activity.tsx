import { TooltipContent } from '@/components/ui/tooltip';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { TooltipTrigger } from '@/components/ui/tooltip';
import { Tooltip } from '@/components/ui/tooltip';
import { IMemoItem } from '@/types';
import { BookOpenIcon, Plus } from 'lucide-react';
import Jdenticon from 'react-jdenticon';
import Link from 'next/link';
import { formatContentPath } from '@/lib/utils/path-utils';
import { monthIndex } from './util';
import HotIcon from '@/components/icons/HotIcon';

interface PublishMemoActivityProps {
  data: IMemoItem[];
  memoCollectors: Record<string, Array<{ username: string; avatar?: string }>>;
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

export function PublishMemoActivity({
  data,
  memoCollectors,
}: PublishMemoActivityProps) {
  const isSingleMemo = data.length === 1;
  const [, m, date] = data[0].date.split('-');
  const collectors = memoCollectors[data[0].tokenId ?? ''] ?? [];

  if (isSingleMemo) {
    return (
      <div className="flex">
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
                <Link href={formatContentPath(data[0].filePath)}>
                  {data[0].title}
                </Link>
              </span>
            ) : (
              <span className="text-lg">Published {data[0].title}</span>
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
    <div className="flex">
      <div className="relative mr-3">
        <div className="bg-border absolute top-0 bottom-0 left-1/2 w-[1.5px] -translate-x-1/2 rounded-full" />
        <div className="border-background bg-border relative mt-4 flex items-center justify-center rounded-full border-4 p-1.5">
          <HotIcon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-5 flex w-full flex-col gap-y-2">
        <div className="flex justify-between">
          <span className="text-lg">Published {data.length} memos</span>
          <span className="text-muted-foreground text-xs">
            {monthIndex[parseInt(m) - 1]} {date}
          </span>
        </div>
        <div className="flex flex-col">
          {data.map(d => {
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
}
