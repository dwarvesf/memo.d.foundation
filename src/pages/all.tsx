import { GetStaticProps } from 'next';
import { RootLayout } from '../components';
import { IMemoItem, RootLayoutPageProps } from '@/types';
import { getRootLayoutPageProps } from '@/lib/content/utils';
import { convertToMemoItems } from '@/lib/content/memo';
import { queryDuckDB } from '@/lib/db/utils';
import Link from 'next/link';
import { fetchContributorProfiles } from '@/lib/contributor-profile';
import { formatContentPath } from '@/lib/utils/path-utils';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import Jdenticon from 'react-jdenticon';
import React from 'react'; // List component uses React.Fragment

interface MonthGroup {
  name: string;
  posts: (IMemoItem & { authorAvatars: string[] })[];
}

interface YearGroup {
  year: string;
  months: MonthGroup[];
}

interface AllPageProps extends RootLayoutPageProps {
  groupedMemos: YearGroup[];
}

export const getStaticProps: GetStaticProps = async () => {
  try {
    const layoutProps = await getRootLayoutPageProps();
    const queryFields = [
      'short_title',
      'title',
      'file_path',
      'authors',
      'description',
      'date',
      'tags',
    ];
    const querySelect = `SELECT ${queryFields.join(', ')}`;

    let allMemos: (IMemoItem & { authorAvatars: string[] })[] = [];
    try {
      allMemos = await queryDuckDB(`
        ${querySelect}
        FROM vault
        WHERE date IS NOT NULL
        ORDER BY date DESC
      `).then(async results => {
        const convertedMemos = await convertToMemoItems(results);
        const memosWithAvatars = await Promise.all(
          convertedMemos.map(async memo => {
            const authorAvatars =
              memo.authors && Array.isArray(memo.authors)
                ? (
                    await fetchContributorProfiles(
                      memo.authors.filter(
                        (author): author is string =>
                          typeof author === 'string',
                      ),
                    )
                  ).map(profile => profile?.avatar ?? null)
                : [];
            return {
              ...memo,
              authorAvatars: authorAvatars.filter(
                (avatar): avatar is string => avatar !== null,
              ),
            };
          }),
        );
        return memosWithAvatars;
      });
    } catch (error) {
      console.error('Error fetching all memos:', error);
    }

    const tempGroupedMemos: Record<
      string,
      Record<string, (IMemoItem & { authorAvatars: string[] })[]>
    > = {};

    allMemos.forEach(memo => {
      const date = new Date(memo.date);
      const year = date.getFullYear().toString();
      const month = date.toLocaleString('en-US', { month: 'long' });

      if (!tempGroupedMemos[year]) {
        tempGroupedMemos[year] = {};
      }
      if (!tempGroupedMemos[year][month]) {
        tempGroupedMemos[year][month] = [];
      }
      tempGroupedMemos[year][month].push(memo);
    });

    const finalGroupedMemos: YearGroup[] = [];

    // Sort years in descending order
    const sortedYears = Object.keys(tempGroupedMemos).sort(
      (a, b) => parseInt(b) - parseInt(a),
    );

    sortedYears.forEach(year => {
      const yearGroup: YearGroup = { year, months: [] };
      const monthsData = tempGroupedMemos[year];

      // Sort months within each year (e.g., May, April, March)
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
      finalGroupedMemos.push(yearGroup);
    });

    return {
      props: {
        ...layoutProps,
        groupedMemos: finalGroupedMemos,
      },
    };
  } catch (error) {
    console.error('Error in getStaticProps for all.tsx:', error);
    return {
      props: {
        groupedMemos: [],
      },
    };
  }
};

function List({ data }: { data: (IMemoItem & { authorAvatars: string[] })[] }) {
  return (
    <div className="flex flex-col">
      {data.map(memo => (
        <div
          className="flex flex-row items-start gap-x-2 py-2 not-last:border-b"
          key={memo.filePath}
        >
          {memo.date && (
            <span className="text-muted-foreground w-20 flex-shrink-0 pt-0.5 text-sm">
              {new Date(memo.date)
                .toLocaleDateString('en-GB')
                .replaceAll('/', '.')}
            </span>
          )}
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

export default function All({
  directoryTree,
  searchIndex,
  groupedMemos,
}: AllPageProps) {
  return (
    <RootLayout
      title="Dwarves Memo - All Posts"
      description="All posts grouped by year and month"
      directoryTree={directoryTree}
      searchIndex={searchIndex}
    >
      <div className="memo-content">
        <div className="prose dark:prose-invert article-content">
          <h1 className="!mt-0 mb-8 text-4xl font-bold">All memos</h1>
          {groupedMemos.map(yearGroup => (
            <div key={yearGroup.year}>
              <h2 className="mt-8 mb-4 !text-2xl font-bold">
                {yearGroup.year}
              </h2>
              {yearGroup.months.map(monthGroup => (
                <div key={monthGroup.name}>
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
        </div>
      </div>
    </RootLayout>
  );
}
