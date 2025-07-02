import Link from 'next/link';
import { IMemoItem } from '@/types';
import { formatContentPath } from '@/lib/utils/path-utils';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import Jdenticon from 'react-jdenticon';
import React, { useState, useEffect, useRef } from 'react';
import { uppercaseSpecialWords } from '@/lib/utils';

interface MonthGroup {
  name: string;
  posts: IMemoItem[];
}

interface YearGroup {
  year: string;
  months: MonthGroup[];
}

interface MemoListProps {
  memos: IMemoItem[];
  title?: string;
}

function List({ data }: { data: IMemoItem[] }) {
  return (
    <div className="flex flex-col">
      {data.map(memo => (
        <div
          className="flex flex-row items-start gap-x-2 py-2 not-last:border-b"
          key={`${memo.filePath}_${memo.title}`}
        >
          {memo.date && (
            <span className="text-muted-foreground w-20 flex-shrink-0 pt-0.5 text-sm">
              {new Date(memo.date)
                .toLocaleDateString('en-GB')
                .replaceAll('/', '.')}
            </span>
          )}
          <div className="flex min-w-0 flex-col">
            <Link
              href={formatContentPath(memo.filePath)}
              className="text-foreground line-clamp-2 overflow-hidden text-base font-semibold"
            >
              {memo.title}
            </Link>
            <div className="flex flex-col gap-x-2 sm:flex-row sm:items-center">
              {memo?.authors?.length ? (
                <div className="flex items-center gap-x-1 text-sm">
                  <div className="flex flex-row -space-x-2">
                    {memo.authorAvatars?.map((avatar, index) => (
                      <Avatar
                        key={`${avatar}_${memo.title}`}
                        className="dark:bg-secondary relative flex h-4 w-4 items-center justify-center border bg-[#fff]"
                        style={{
                          zIndex: Math.max(
                            (memo.authorAvatars?.length || 0) - index,
                            0,
                          ),
                        }}
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
                    by{' '}
                    <Link
                      href={`/contributor/${memo.authors?.[0].toLocaleLowerCase()}`}
                    >
                      {memo.authors?.[0]}
                    </Link>
                    {(memo.authors?.length ?? 0) > 1 ? ` and others` : ''}
                  </span>
                </div>
              ) : null}
              <div className="space-x-1">
                {memo.tags?.slice(0, 3).map(tag => (
                  <Link
                    key={tag}
                    href={`/tags/${tag.toLowerCase().replace(/\s+/g, '-')}`}
                    className="dark:bg-border hover:text-primary text-2xs rounded-[2.8px] bg-[#f9fafb] px-1.5 leading-[1.7] font-medium text-neutral-500 hover:underline"
                  >
                    {uppercaseSpecialWords(tag)}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MemoList({ memos, title = 'All memos' }: MemoListProps) {
  const initialDisplayCount = 50;
  const [displayedMemos, setDisplayedMemos] = useState(
    memos.slice(0, initialDisplayCount),
  );
  const [hasMore, setHasMore] = useState(memos.length > initialDisplayCount);
  const loadingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const target = entries[0];
        if (target.isIntersecting && hasMore) {
          loadMoreMemos();
        }
      },
      {
        root: null, // viewport
        rootMargin: '0px',
        threshold: 1.0,
      },
    );

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    return () => {
      if (loadingRef.current) {
        observer.unobserve(loadingRef.current);
      }
    };
  }, [hasMore, memos]); // Add memos to dependencies

  const loadMoreMemos = () => {
    const currentLength = displayedMemos.length;
    const nextFifty = memos.slice(
      currentLength,
      currentLength + initialDisplayCount,
    );
    setDisplayedMemos(prevMemos => [...prevMemos, ...nextFifty]);
    setHasMore(currentLength + nextFifty.length < memos.length);
  };

  // Group displayed memos by year and month for rendering
  const groupedDisplayedMemos: YearGroup[] = [];
  const tempGroupedDisplayedMemos: Record<
    string,
    Record<string, IMemoItem[]>
  > = {};

  displayedMemos.forEach(memo => {
    const date = new Date(memo.date);
    const year = date.getFullYear().toString();
    const month = date.toLocaleString('en-US', { month: 'long' });

    if (!tempGroupedDisplayedMemos[year]) {
      tempGroupedDisplayedMemos[year] = {};
    }
    if (!tempGroupedDisplayedMemos[year][month]) {
      tempGroupedDisplayedMemos[year][month] = [];
    }
    tempGroupedDisplayedMemos[year][month].push(memo);
  });

  const sortedYears = Object.keys(tempGroupedDisplayedMemos).sort(
    (a, b) => parseInt(b) - parseInt(a),
  );

  sortedYears.forEach(year => {
    const yearGroup: YearGroup = { year, months: [] };
    const monthsData = tempGroupedDisplayedMemos[year];

    const sortedMonths = Object.keys(monthsData).sort((a, b) => {
      const dateA = new Date(Date.parse(a + ' 1, 2000'));
      const dateB = new Date(Date.parse(b + ' 1, 2000'));
      return dateB.getMonth() - dateA.getMonth();
    });

    sortedMonths.forEach(month => {
      yearGroup.months.push({
        name: month,
        posts: monthsData[month],
      });
    });
    groupedDisplayedMemos.push(yearGroup);
  });

  return (
    <>
      <h1 className="!mt-0 mb-8 text-4xl font-bold">{title}</h1>
      {groupedDisplayedMemos.map(yearGroup => (
        <div key={yearGroup.year}>
          <h2 className="mt-8 mb-4 !text-2xl font-bold">{yearGroup.year}</h2>
          {yearGroup.months.map(monthGroup => (
            <div key={`${yearGroup.year}_${monthGroup.name}`}>
              <h3 className="!mb-2 !text-lg font-semibold">
                {monthGroup.name}{' '}
                <span className="text-muted-foreground text-sm">
                  ({monthGroup.posts.length} posts)
                </span>
              </h3>
              <List data={monthGroup.posts} />
            </div>
          ))}
        </div>
      ))}
      {hasMore && <div ref={loadingRef} className="flex justify-center py-4" />}
    </>
  );
}
