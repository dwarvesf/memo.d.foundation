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

/**
 * Fetches the contributor's wallet address from their GitHub username
 */
async function fetchContributorProfile(contributorSlug: string) {
  try {
    const response = await fetch(
      `https://api.mochi-profile.console.so/api/v1/profiles/github/get-by-username/${contributorSlug}`,
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch profile for GitHub user ${contributorSlug}: ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.warn(error);
    return contributorSlug;
  }
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

    // Query for top 10 latest memos overall
    let latestMemos: IMemoItem[] = [];
    try {
      latestMemos = await queryDuckDB(`
        ${querySelect}
        FROM vault
        ORDER BY date DESC
        LIMIT 10
        `).then(convertToMemoItems);

      // Enrich authors with their profiles
      latestMemos = await Promise.all(
        latestMemos.map(async memo => {
          if (!memo.authors || !Array.isArray(memo.authors)) {
            return memo;
          }

          const authorAvatars = await Promise.all(
            memo.authors.map(async author => {
              const profile = await fetchContributorProfile(author);
              return profile.avatar ?? null;
            }),
          );

          return {
            ...memo,
            authorAvatars,
          };
        }),
      );
    } catch (error) {
      console.error('Error fetching latest memos:', error);
    }

    // Query for top 10 latest web3 memos
    let latestWeb3Memos: IMemoItem[] = [];
    try {
      latestWeb3Memos = await queryDuckDB(`
        ${querySelect}
        FROM vault
        WHERE tags IS NOT NULL
        AND ARRAY_CONTAINS(tags, 'web3')
        ORDER BY date DESC
        LIMIT 10
        `).then(convertToMemoItems);

      // Enrich authors with their avatars
      latestWeb3Memos = await Promise.all(
        latestWeb3Memos.map(async memo => {
          if (!memo.authors || !Array.isArray(memo.authors)) {
            return memo;
          }

          const authorAvatars = await Promise.all(
            memo.authors.map(async author => {
              const profile = await fetchContributorProfile(author);
              return profile.avatar ?? null;
            }),
          );

          return {
            ...memo,
            authorAvatars,
          };
        }),
      );
    } catch (error) {
      console.error('Error fetching web3 memos:', error);
    }

    // Query for top 10 latest design memos
    let latestDesignMemos: IMemoItem[] = [];
    try {
      latestDesignMemos = await queryDuckDB(`
        ${querySelect}
        FROM vault
        WHERE tags IS NOT NULL
        AND ARRAY_CONTAINS(tags, 'design')
        ORDER BY date DESC
        LIMIT 10
        `).then(convertToMemoItems);

      // Enrich authors with their avatars
      latestDesignMemos = await Promise.all(
        latestDesignMemos.map(async memo => {
          if (!memo.authors || !Array.isArray(memo.authors)) {
            return memo;
          }

          const authorAvatars = await Promise.all(
            memo.authors.map(async author => {
              const profile = await fetchContributorProfile(author);
              return profile.avatar ?? null;
            }),
          );

          return {
            ...memo,
            authorAvatars,
          };
        }),
      );
    } catch (error) {
      console.error('Error fetching design memos:', error);
    }

    // Query for top 10 latest culture memos
    let latestCultureMemos: IMemoItem[] = [];
    try {
      latestCultureMemos = await queryDuckDB(`
        ${querySelect}
        FROM vault
        WHERE tags IS NOT NULL
        AND ARRAY_CONTAINS(tags, 'culture')
        ORDER BY date DESC
        LIMIT 10
        `).then(convertToMemoItems);

      // Enrich authors with their avatars
      latestCultureMemos = await Promise.all(
        latestCultureMemos.map(async memo => {
          if (!memo.authors || !Array.isArray(memo.authors)) {
            return memo;
          }

          const authorAvatars = await Promise.all(
            memo.authors.map(async author => {
              const profile = await fetchContributorProfile(author);
              return profile.avatar ?? null;
            }),
          );

          return {
            ...memo,
            authorAvatars,
          };
        }),
      );
    } catch (error) {
      console.error('Error fetching culture memos:', error);
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
            title: 'Engineering',
            subtitle: 'Craftsmen knowledge',
            tag: 'engineering',
            memos: block1Memos,
          },
          block2: {
            title: 'Blockchain',
            subtitle: 'Decentralized future',
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
            title: 'Artificial Intelligence',
            subtitle: 'Pushing human limits',
            tag: 'AI',
            memos: block4Memos,
          },
        },
        latestMemos,
        filters: {
          web3: latestWeb3Memos,
          design: latestDesignMemos,
          culture: latestCultureMemos,
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
