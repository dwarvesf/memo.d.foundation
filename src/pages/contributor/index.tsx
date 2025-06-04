import React from 'react';
import { GetStaticProps } from 'next';
import path from 'path';

// Import utility functions
import { getAllMarkdownContents, sortMemos } from '@/lib/content/memo';
import { getRootLayoutPageProps } from '@/lib/content/utils';
import { getContributorStats } from '@/lib/contributor-stats';

import { RootLayoutPageProps } from '@/types';

import {
  serialize,
  type SerializeResult,
} from 'next-mdx-remote-client/serialize';
import RemoteMdxRenderer from '@/components/RemoteMdxRenderer';
import { getMdxSource } from '@/lib/mdx';
import ContributorLayout from '@/components/layout/ContributorLayout';
import { isAfter } from 'date-fns';
import { getContentPath } from '@/lib/content/paths';

interface ContentPageProps extends RootLayoutPageProps {
  frontmatter?: Record<string, any>;
  mdxSource?: SerializeResult; // Serialized MDX source
  contributorStats: Record<string, any>;
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
    console.warn((error as Error).message);
    return contributorSlug;
  }
}

export const getStaticProps: GetStaticProps = async () => {
  try {
    const allMemos = await getAllMarkdownContents();
    const layoutProps = await getRootLayoutPageProps();

    const contributors = new Set<string>();
    const contributionCount: Record<string, number> = {};
    const contributorLatestWork: Record<
      string,
      { date: string; title: string; url: string }
    > = {};
    let topCount = 0;

    sortMemos(allMemos).forEach(memo => {
      const { authors } = memo;
      if (authors) {
        authors.forEach(author => {
          // Initialize contributor data if not exists
          if (!contributors.has(author)) {
            contributors.add(author);
            contributionCount[author] = 0;
            contributorLatestWork[author] = {
              date: memo.date,
              title: memo.title,
              url: getContentPath(memo.filePath),
            };
          }

          // Update contribution count
          contributionCount[author] += 1;
          topCount = Math.max(topCount, contributionCount[author]);

          // Update latest work if newer
          if (isAfter(memo.date, contributorLatestWork[author].date)) {
            contributorLatestWork[author] = {
              date: memo.date,
              title: memo.title,
              url: getContentPath(memo.filePath),
            };
          }
        });
      }
    });

    const enrichedContributors = await Promise.all(
      Array.from(contributors).map(fetchContributorProfile),
    );

    // Fetch contributor stats using the new utility function
    const contributorStats = await getContributorStats();

    // --- Read Processed MDX Content ---
    const mdxPath = path.join(
      process.cwd(),
      'public/content/contributor',
      `index.mdx`,
    );

    const mdxSource = await getMdxSource({
      mdxPath,
      scope: {
        contributors: enrichedContributors,
        contributionCount,
        contributorLatestWork,
        topCount,
        contributorStats,
      },
    });

    if (!mdxSource || 'error' in mdxSource) {
      return { notFound: true }; // Handle serialization error
    }

    const newSource = await serialize({
      source:
        '<ContributorList data={contributors} contributorLatestWork={contributorLatestWork} contributionCount={contributionCount} topCount={topCount} contributorStats={contributorStats} />',
    });

    if (!newSource || 'error' in newSource) {
      return { notFound: true }; // Handle serialization error
    }

    mdxSource.compiledSource = newSource.compiledSource;

    return {
      props: {
        ...layoutProps,
        mdxSource,
        frontmatter: mdxSource.frontmatter,
        contributorStats,
      },
    };
  } catch (error) {
    console.error('Error in getStaticProps:', error);
    return { notFound: true };
  }
};

export default function ContentPage({
  frontmatter,
  directoryTree,
  searchIndex,
  mdxSource,
}: ContentPageProps) {
  if (!mdxSource || 'error' in mdxSource) {
    // We already handle this in getStaticProps
    return null;
  }
  return (
    <ContributorLayout
      title={frontmatter?.title}
      description={frontmatter?.description} // Use GitHub bio as description
      image={frontmatter?.image} // Use GitHub avatar as image
      directoryTree={directoryTree}
      searchIndex={searchIndex}
    >
      <div className="content-wrapper">
        <RemoteMdxRenderer mdxSource={mdxSource} />
      </div>
    </ContributorLayout>
  );
}
