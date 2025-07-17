import React from 'react';
import { GetStaticProps } from 'next';

// Import utility functions
import { getAllMarkdownContents, sortMemos } from '@/lib/content/memo';
import { getRootLayoutPageProps } from '@/lib/content/utils';
import { getCompactContributorsFromContentJSON } from '@/lib/contributor';

import { RootLayoutPageProps } from '@/types';

import ContributorLayout from '@/components/layout/ContributorLayout';
import { isAfter } from 'date-fns';
import { slugifyPathComponents } from '@/lib/utils/slugify';
import ContributorList from '@/components/memo/contributor-view';
import { CompactContributorProfile } from '@/types/user';

interface ContentPageProps extends RootLayoutPageProps {
  frontmatter?: Record<string, any>;
  contributorStats: Record<string, any>;
  contributorLatestWork: Record<
    string,
    { date: string; title: string; url: string }
  >;
  contributors: (CompactContributorProfile | string)[];
  contributionCount: Record<string, number>;
  topCount: number;
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

    // Fetch contributor stats using the new utility function
    const contributorProfiles = await getCompactContributorsFromContentJSON();
    contributorProfiles.forEach(profile => {
      contributors.add(profile.username);
    });
    const contributorsArray = Array.from(contributors);

    const enrichedContributors = contributorsArray.map(username => {
      if (contributorProfiles.some(profile => profile.username === username)) {
        const foundProfile = contributorProfiles.find(
          profile => profile.username === username,
        );
        if (foundProfile) {
          Object.keys(foundProfile).forEach(key => {
            if (
              typeof foundProfile[key as keyof CompactContributorProfile] ===
              'undefined'
            ) {
              delete foundProfile[key as keyof CompactContributorProfile];
            }
          });
        }

        return foundProfile;
      }
      return username; // Fallback if no profile found
    });

    return {
      props: {
        ...layoutProps,
        contributors: enrichedContributors,
        contributorLatestWork,
        contributionCount,
        topCount,
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
  contributorLatestWork,
  contributors,
  contributionCount,
  topCount,
}: ContentPageProps) {
  return (
    <ContributorLayout
      title={frontmatter?.title}
      description={frontmatter?.description} // Use GitHub bio as description
      image={frontmatter?.image} // Use GitHub avatar as image
      directoryTree={directoryTree}
      searchIndex={searchIndex}
    >
      <div className="content-wrapper">
        <ContributorList
          data={contributors}
          contributorLatestWork={contributorLatestWork}
          contributionCount={contributionCount}
          topCount={topCount}
        />
      </div>
    </ContributorLayout>
  );
}
