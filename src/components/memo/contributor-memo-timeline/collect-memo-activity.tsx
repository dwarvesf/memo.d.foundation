import { CollectMemo } from '@/types';
import { monthIndex } from './util';
import { CheckCheck, ListCheck } from 'lucide-react';
import { formatContentPath } from '@/lib/utils/path-utils';
import Link from 'next/link';
import BookOpenIcon from '@/components/icons/BookOpenIcon';

interface CollectMemoActivityProps {
  data: CollectMemo[];
}

export function CollectMemoActivity({ data }: CollectMemoActivityProps) {
  const [, m, date] = data[0].date.split('-');
  const isSingle = data.length === 1;

  if (isSingle) {
    return (
      <div className="flex">
        <div className="relative mr-3">
          <div className="bg-border absolute top-0 bottom-0 left-1/2 w-[1.5px] -translate-x-1/2 rounded-full" />
          <div className="border-background bg-border relative mt-3.5 flex items-center justify-center rounded-full border-4 p-1.5">
            <CheckCheck className="h-3.5 w-3.5" />
          </div>
        </div>
        <div className="mt-5 flex w-full flex-col gap-y-2">
          <div className="flex justify-between">
            <span className="flex flex-shrink-1 flex-wrap items-center gap-x-1.5 text-base">
              Showed appreciation by collecting
              <Link href={formatContentPath(data[0].filePath)}>
                {data[0].title}
              </Link>
            </span>
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
        <div className="border-background bg-border relative mt-3.5 flex items-center justify-center rounded-full border-4 p-1.5">
          <ListCheck className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="mt-5 flex w-full flex-col gap-y-2">
        <div className="flex justify-between">
          <span className="text-base">Collected {data.length} memos</span>
          <span className="text-muted-foreground text-xs">
            {monthIndex[parseInt(m) - 1]} {date}
          </span>
        </div>
        <div className="flex flex-col">
          {data.map(d => {
            return (
              <div className="flex flex-wrap items-center" key={d.filePath}>
                <Link
                  href={formatContentPath(d.filePath)}
                  className="!text-muted-foreground hover:!text-primary flex items-center gap-x-2"
                >
                  <BookOpenIcon className="h-4 w-4 shrink-0" />
                  <span>{d.title}</span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
