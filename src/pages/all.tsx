import { GetStaticProps } from 'next';
import { RootLayout } from '../components';
import { IMemoItemWithAuthors, RootLayoutPageProps } from '@/types';
import { getRootLayoutPageProps } from '@/lib/content/utils';
import { convertToMemoItems } from '@/lib/content/memo';
import { queryDuckDB } from '@/lib/db/utils';
import { getCompactContributorsFromContentJSON } from '@/lib/contributor';
import { MemoList } from '@/components/memo/MemoList';

interface AllPageProps extends RootLayoutPageProps {
  allMemos: IMemoItemWithAuthors[];
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

    let allMemos: IMemoItemWithAuthors[] = [];
    try {
      const userProfiles = await getCompactContributorsFromContentJSON();
      const avatarMap = userProfiles.reduce(
        (acc, profile) => {
          if (profile.avatar) {
            acc[profile.username] = profile.avatar;
          }
          return acc;
        },
        {} as Record<string, string>,
      );

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
                ? memo.authors.map(author => avatarMap[author] ?? null)
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

    return {
      props: {
        ...layoutProps,
        allMemos,
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

export default function All({
  directoryTree,
  searchIndex,
  allMemos,
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
          <MemoList memos={allMemos} />
        </div>
      </div>
    </RootLayout>
  );
}
