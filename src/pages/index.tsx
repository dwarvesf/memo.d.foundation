import { GetStaticProps } from 'next';

import { RootLayout } from '../components';
import { IMemoItem, RootLayoutPageProps } from '@/types';

import { convertToMemoItems } from '@/lib/content/memo';
import { getMdxSource } from '@/lib/mdx';
import path from 'path';
import RemoteMdxRenderer from '@/components/RemoteMdxRenderer';
import { SerializeResult } from 'next-mdx-remote-client';
import { queryDuckDB } from '@/lib/db/utils';
import { MemosWithTagsProvider } from '@/contexts/memos-with-tags';

interface HomePageProps extends RootLayoutPageProps {
  mdxSource?: SerializeResult;
}

export const getStaticProps: GetStaticProps = async () => {
  try {
    const queryFields = [
      'short_title',
      'title',
      'file_path',
      'authors',
      'description',
      'date',
      'tags',
      'md_content',
    ];
    const querySelect = `SELECT ${queryFields.join(', ')}`;

    // Add default empty arrays and error handling for each query
    let ogifMemos: IMemoItem[] = [];
    try {
      ogifMemos = await queryDuckDB(`
        ${querySelect}
        FROM vault
        WHERE ARRAY_CONTAINS(tags, 'ogif')
        ORDER BY date DESC
        LIMIT 5
        `).then(convertToMemoItems);
    } catch (error) {
      console.error('Error fetching ogif memos:', error);
    }

    let newMemos: IMemoItem[] = [];
    try {
      newMemos = await queryDuckDB(`
        ${querySelect}
        FROM vault
        ORDER BY date DESC
        LIMIT 3
        `).then(convertToMemoItems);
    } catch (error) {
      console.error('Error fetching new memos:', error);
    }

    let teamMemos: IMemoItem[] = [];
    try {
      teamMemos = await queryDuckDB(`
        ${querySelect}
        FROM vault
        WHERE tags IS NOT NULL
        AND ARRAY_CONTAINS(tags, 'team')
        ORDER BY date DESC
        LIMIT 3
        `).then(convertToMemoItems);
    } catch (error) {
      console.error('Error fetching team memos:', error);
    }

    let changelogMemos: IMemoItem[] = [];
    try {
      changelogMemos = await queryDuckDB(`
        ${querySelect}
        FROM vault
        WHERE file_path LIKE 'updates/changelog%'
        ORDER BY date DESC
        LIMIT 3
        `).then(convertToMemoItems);
    } catch (error) {
      console.error('Error fetching changelog memos:', error);
    }

    let hiringMemos: IMemoItem[] = [];
    try {
      hiringMemos = await queryDuckDB(`
        ${querySelect}
        FROM vault
        WHERE tags IS NOT NULL
        AND ARRAY_CONTAINS(tags, 'hiring') AND hiring = true
        ORDER BY date DESC
        LIMIT 3
        `).then(convertToMemoItems);
    } catch (error) {
      console.error('Error fetching hiring memos:', error);
    }

    const mdxPath = path.join(process.cwd(), 'public/content/', `index.mdx`);
    const mdxSource = await getMdxSource({
      mdxPath,
      scope: {
        ogifMemos,
        newMemos,
        teamMemos,
        changelogMemos,
        hiringMemos,
        // The vault's index.mdx still references these identifiers when it
        // renders <TagsMarquee />, <WorthReading /> and <MemoFilterList />,
        // which now read the tree / memo list from context instead.
        directoryTree: {},
        memosWithTags: [],
      },
    });

    if (!mdxSource || 'error' in mdxSource) {
      return { notFound: true }; // Handle serialization error
    }

    return {
      props: {
        mdxSource,
      },
    };
  } catch (error) {
    console.error('Error in getStaticProps:', error);
    return {
      props: {
        featuredPosts: [],
      },
    };
  }
};

export default function Home({ searchIndex, mdxSource }: HomePageProps) {
  if (!mdxSource || 'error' in mdxSource) {
    // We already handle this in getStaticProps
    return null;
  }
  return (
    <RootLayout
      title="Dwarves Memo - Home"
      description="Knowledge sharing platform for Dwarves Foundation"
      searchIndex={searchIndex}
    >
      <MemosWithTagsProvider>
        <RemoteMdxRenderer mdxSource={mdxSource} />
      </MemosWithTagsProvider>
    </RootLayout>
  );
}
