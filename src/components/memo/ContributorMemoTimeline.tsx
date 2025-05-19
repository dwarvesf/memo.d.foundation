import { IMemoItem } from '@/types';
import HotIcon from '../icons/HotIcon';
import BookOpenIcon from '../icons/BookOpenIcon';
import { formatContentPath } from '@/lib/utils/path-utils';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import Jdenticon from 'react-jdenticon';
import { Avatar } from '../ui/avatar';

interface ContributorMemoTimelineProps {
  data: IMemoItem[][][];
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

function TimelineActivity({ data }: { data: IMemoItem[][] }) {
  return data.map(month => {
    const [, m, date] = month[0].date.split('-');

    if (month.length === 1) {
      const random = Math.floor(Math.random() * 5) + 1;
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
              <span className="flex flex-shrink-1 flex-wrap items-center gap-x-1.5 text-lg">
                +{random} Collector{random === 1 ? '' : 's'}
                <div className="flex -space-x-2">
                  {new Array(random).fill(0).map(() => {
                    const random = Math.random();
                    return (
                      <Avatar
                        key={random}
                        className="dark:bg-secondary flex h-6.5 w-6.5 items-center justify-center border-2 bg-[#fff]"
                      >
                        <Jdenticon value={random.toString()} size={24} />
                      </Avatar>
                    );
                  })}
                </div>
                interested in{' '}
                <Link href={formatContentPath(month[0].filePath)}>
                  {month[0].title}
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
              const shouldShowCollector = Math.random() > 0.8;
              return (
                <div className="flex items-center" key={d.filePath}>
                  <Link
                    href={formatContentPath(d.filePath)}
                    className="!text-muted-foreground hover:!text-primary flex items-center gap-x-2"
                  >
                    <BookOpenIcon className="h-4 w-4" />
                    <span>{d.title}</span>
                  </Link>
                  {shouldShowCollector ? (
                    <div className="!text-muted-foreground ml-auto flex items-center gap-x-1">
                      <div className="flex -space-x-2">
                        {new Array(Math.floor(Math.random() * 5))
                          .fill(0)
                          .map(() => {
                            const random = Math.random();
                            return (
                              <Avatar
                                key={random}
                                className="dark:bg-secondary flex h-6.5 w-6.5 items-center justify-center border-2 bg-[#fff]"
                              >
                                <Jdenticon
                                  value={random.toString()}
                                  size={24}
                                />
                              </Avatar>
                            );
                          })}
                      </div>
                      <span className="text-sm hover:!no-underline">
                        collected
                      </span>
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

function ContributorMemoTimeline({ data }: ContributorMemoTimelineProps) {
  return (
    <div className="flex flex-col gap-y-10">
      {data.map(year => {
        return (
          <div key={`year-${year[0][0].date}`} className="flex flex-col">
            <TimelineHeader date={year[0][0].date} />
            <TimelineActivity data={year} />
          </div>
        );
      })}
    </div>
  );
}

export default ContributorMemoTimeline;
