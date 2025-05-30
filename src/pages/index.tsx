import { GetStaticProps } from 'next';

import { RootLayout } from '../components';
import { IMemoItem, RootLayoutPageProps } from '@/types';

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

    // Add queries for WorthReading blocks
    let block1Memos: IMemoItem[] = [];
    try {
      block1Memos = await queryDuckDB(`
        ${querySelect}
        FROM vault
        WHERE tags IS NOT NULL
        AND ARRAY_CONTAINS(tags, 'engineering')
        ORDER BY date DESC
        LIMIT 5
        `).then(convertToMemoItems);
    } catch (error) {
      console.error('Error fetching block1 memos:', error);
    }

    let block2Memos: IMemoItem[] = [];
    try {
      block2Memos = await queryDuckDB(`
        ${querySelect}
        FROM vault
        WHERE tags IS NOT NULL
        AND ARRAY_CONTAINS(tags, 'blockchain')
        ORDER BY date DESC
        LIMIT 5
        `).then(convertToMemoItems);
    } catch (error) {
      console.error('Error fetching block2 memos:', error);
    }

    let block3Memos: IMemoItem[] = [];
    try {
      block3Memos = await queryDuckDB(`
        ${querySelect}
        FROM vault
        WHERE tags IS NOT NULL
        AND ARRAY_CONTAINS(tags, 'market-report')
        ORDER BY date DESC
        LIMIT 5
        `).then(convertToMemoItems);
    } catch (error) {
      console.error('Error fetching block3 memos:', error);
    }

    let block4Memos: IMemoItem[] = [];
    try {
      block4Memos = await queryDuckDB(`
        ${querySelect}
        FROM vault
        WHERE tags IS NOT NULL
        AND ARRAY_CONTAINS(tags, 'AI')
        ORDER BY date DESC
        LIMIT 5
        `).then(convertToMemoItems);
    } catch (error) {
      console.error('Error fetching block4 memos:', error);
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
        worthReadingBlocks: {
          block1: {
            title: 'Engineering Excellence',
            subtitle: 'Latest insights from our engineering team',
            tag: 'engineering',
            memos: block1Memos,
          },
          block2: {
            title: 'Blockchain',
            subtitle: 'Deep dives into blockchain',
            tag: 'blockchain',
            memos: block2Memos,
          },
          block3: {
            title: 'Wealth',
            subtitle: 'Growth and prosperity',
            tag: 'market-report',
            memos: block3Memos,
          },
          block4: {
            title: 'AI',
            subtitle: 'Exploring the frontiers of artificial intelligence',
            tag: 'AI',
            memos: block4Memos,
          },
        },
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
