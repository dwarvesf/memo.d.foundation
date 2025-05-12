import { GetStaticProps } from 'next';

import { RootLayout } from '../components';
import { RootLayoutPageProps } from '@/types';

import { getRootLayoutPageProps } from '@/lib/content/utils';
import { convertToMemoItems } from '@/lib/content/memo';
import { getMdxSource } from '@/lib/mdx';
import path from 'path';
import RemoteMdxRenderer from '@/components/RemoteMdxRenderer';
import { SerializeResult } from 'next-mdx-remote-client';
import { queryDuckDB } from '@/lib/db/utils';

interface HomePageProps extends RootLayoutPageProps {
  mdxSource?: SerializeResult;
}

export const getStaticProps: GetStaticProps = async () => {
  try {
    const layoutProps = await getRootLayoutPageProps(); // Await the asynchronous function
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
    let ogifMemos = [];
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

    let newMemos = [];
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

    let teamMemos = [];
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

    let changelogMemos = [];
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

    let hiringMemos = [];
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
      },
    });
    if (!mdxSource || 'error' in mdxSource) {
      return { notFound: true }; // Handle serialization error
    }
    return {
      props: {
        ...layoutProps,
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

export default function Home({
  directoryTree,
  searchIndex,
  mdxSource,
}: HomePageProps) {
  if (!mdxSource || 'error' in mdxSource) {
    // We already handle this in getStaticProps
    return null;
  }
  return (
    <RootLayout
      title="Dwarves Memo - Home"
      description="Knowledge sharing platform for Dwarves Foundation"
      directoryTree={directoryTree}
      searchIndex={searchIndex}
    >
      <RemoteMdxRenderer mdxSource={mdxSource} />
    </RootLayout>
  );
}
