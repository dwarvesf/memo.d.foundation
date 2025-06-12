import { IMemoItem } from '@/types';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { formatContentPath } from '@/lib/utils/path-utils';
import { Avatar, AvatarImage } from '../ui/avatar';
import Jdenticon from 'react-jdenticon';

interface MemoFilterListProps {
  title: string;
  all: (IMemoItem & { authorAvatars: string[] })[];
  filters?: string[];
}

function List({ data }: { data: (IMemoItem & { authorAvatars: string[] })[] }) {
  return (
    <div className="flex flex-col">
      {data.map(memo => (
        <div
          className="flex flex-row gap-x-2 py-3 not-last:border-b"
          key={memo.filePath}
        >
          <div className="flex flex-col">
            <Link
              href={formatContentPath(memo.filePath)}
              className="text-foreground text-base font-semibold"
            >
              {memo.title}
            </Link>
            <div className="flex items-center gap-x-1 text-sm">
              <div className="flex flex-row -space-x-2">
                {memo.authorAvatars?.map((avatar, index) => (
                  <Avatar
                    key={`${avatar}_${memo.title}`}
                    className="dark:bg-secondary flex h-4 w-4 items-center justify-center border bg-[#fff]"
                  >
                    {avatar ? (
                      <AvatarImage src={avatar} className="no-zoom !m-0" />
                    ) : (
                      <Jdenticon
                        value={memo.authors?.[index] ?? ''}
                        size={16}
                      />
                    )}
                  </Avatar>
                ))}
              </div>
              <span className="text-muted-foreground">
                authored by{' '}
                <Link href={`/contributor/${memo.authors?.[0]}`}>
                  {memo.authors?.[0]}
                </Link>
                {(memo.authors?.length ?? 0) > 1 ? ` and others` : ''}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MemoFilterList({ title, all, filters }: MemoFilterListProps) {
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  return (
    <div className="mt-4 flex flex-col">
      <div className="flex flex-row items-baseline justify-between">
        <h2>{title}</h2>
        <div className="flex flex-row gap-1">
          <button
            onClick={() => setSelectedFilter(null)}
            className={cn('cursor-pointer transition', {
              'text-muted-foreground/50 hover:text-foreground':
                !!selectedFilter,
              'text-foreground': !selectedFilter,
            })}
          >
            all
          </button>
          <span className="text-muted-foreground/50 mx-0.5">/</span>
          {filters?.map((filter, index) => (
            <React.Fragment key={filter}>
              <button
                onClick={() => setSelectedFilter(filter)}
                className={cn('cursor-pointer transition', {
                  'text-muted-foreground/50 hover:text-foreground':
                    selectedFilter !== filter,
                  'text-foreground': selectedFilter === filter,
                })}
                key={filter}
              >
                {filter}
              </button>
              {index < Object.keys(filters).length - 1 && (
                <span className="text-muted-foreground/50 mx-0.5">/</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
      <List
        data={
          selectedFilter
            ? all
                .filter(memo => memo.tags?.includes(selectedFilter))
                .slice(0, 10)
            : all.slice(0, 10)
        }
      />
    </div>
  );
}

export default MemoFilterList;
