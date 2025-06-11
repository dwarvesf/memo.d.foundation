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
import { slugifyPathComponents } from '@/lib/utils/slugify';
import { fetchContributorProfiles } from '@/lib/contributor-profile';

interface ContentPageProps extends RootLayoutPageProps {
  frontmatter?: Record<string, any>;
  mdxSource?: SerializeResult; // Serialized MDX source
  contributorStats: Record<string, any>;
}

/**
 * Formats a file path from the vault into a URL-friendly path.
 * Removes '.md' extension, slugifies path components using the project's logic,
 * and ensures a leading slash.
 * Example: 'Folder Name/File Name.md' -> '/folder-name/file-name'
 */
function formatPathForUrl(filePath: string | null | undefined): string | null {
  if (!filePath) {
    return null;
  }
  // Remove .md extension if present
  const pathWithoutExt = filePath.endsWith('.md')
    ? filePath.slice(0, -3)
    : filePath;

  // Slugify using the project's function
  const slugifiedPath = slugifyPathComponents(pathWithoutExt);

  // Ensure leading slash
  return slugifiedPath.startsWith('/') ? slugifiedPath : `/${slugifiedPath}`;
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
              url: formatPathForUrl(memo.filePath) ?? '',
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
              url: formatPathForUrl(memo.filePath) ?? '',
            };
          }
        });
      }
    });

    const contributorsArray = Array.from(contributors);
    const enrichedContributors = (
      await fetchContributorProfiles(contributorsArray)
    ).map((profile, index) => profile ?? contributorsArray[index]);

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
