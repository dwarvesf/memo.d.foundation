import React from 'react';
import { GetStaticProps, GetStaticPaths } from 'next';
import path from 'path';
import fs from 'fs/promises';
import slugify from 'slugify';

// Import utility functions
import { convertToMemoItems, getAllMarkdownContents } from '@/lib/content/memo';
import { getRootLayoutPageProps } from '@/lib/content/utils';
import { queryDuckDB } from '@/lib/db/utils'; // Utility for DuckDB queries

// Import components

// Import contexts and types
import { IMemoItem, RootLayoutPageProps } from '@/types';

import {
  serialize,
  type SerializeResult,
} from 'next-mdx-remote-client/serialize';
import RemoteMdxRenderer from '@/components/RemoteMdxRenderer';
import { getMdxSource } from '@/lib/mdx';
import { UserProfile, UserProfileJson } from '@/types/user';
import ContributorLayout from '@/components/layout/ContributorLayout';
import { eachDayOfInterval, formatISO, endOfYear, startOfYear } from 'date-fns';

interface ContentPageProps extends RootLayoutPageProps {
  frontmatter?: Record<string, any>;
  slug: string[];

  contributorName?: string; // Make optional
  contributorMemos?: IMemoItem[]; // Make optional
  contributorProfile?: UserProfile | null; // GitHub profile data
  memoCollectors?: Record<string, Array<{ username: string; avatar?: string }>>;

  mdxSource?: SerializeResult; // Serialized MDX source
}

/**
 * Gets static paths for all content pages including contributor profiles
 */
export const getStaticPaths: GetStaticPaths = async () => {
  // --- New logic to get paths for contributor profiles ---
  const authorsResult = await queryDuckDB(`
    SELECT DISTINCT UNNEST(authors) AS author
    FROM vault
    WHERE authors IS NOT NULL;
  `);
  const contributorPaths = authorsResult.map(row => ({
    params: {
      slug: slugify(row.author as string, { lower: true, strict: true }),
    },
  }));

  // Additionally, check for any manually created MDX files in vault/contributor/
  const contributorVaultDir = path.join(
    process.cwd(),
    'public/content/contributor',
  );
  let manualMdxPaths: { params: { slug: string } }[] = [];
  try {
    const files = await fs.readdir(contributorVaultDir, {
      withFileTypes: true,
    });
    const mdxFiles = files.filter(
      dirent => dirent.isFile() && dirent.name.endsWith('.mdx'),
    );
    manualMdxPaths = mdxFiles.map(file => ({
      params: { slug: file.name.replace(/\\.mdx$/, '') }, // Prefix with 'contributor'
    }));
  } catch (error) {
    console.error('Error reading vault/contributor directory:', error);
    // Continue without manual paths if directory doesn't exist or error occurs
  }

  // Combine all paths
  const allPaths = [
    ...contributorPaths, // Include contributor paths from DuckDB
    ...manualMdxPaths, // Include manual contributor MDX paths
  ];

  // Deduplicate paths based on slug
  const uniquePaths = Array.from(
    new Map(allPaths.map(item => [item.params.slug, item])).values(),
  );

  return {
    paths: uniquePaths,
    fallback: false, // Essential for static export
  };
};

/**
 * Fetches collectors data for a memo with tokenId
 */
async function fetchCollectorsData(tokenId: string) {
  try {
    // Fetch collectors addresses
    const mintersResponse = await fetch(
      `https://memo-nft-api-prod.fly.dev/minters/${tokenId}`,
    );

    if (!mintersResponse.ok) {
      throw new Error(
        `Failed to fetch minters for token ${tokenId}: ${mintersResponse.statusText}`,
      );
    }

    const mintersData = await mintersResponse.json();
    const collectors = [];

    // Process each minter address
    for (const { minter } of mintersData.data) {
      try {
        const profileResponse = await fetch(
          `https://api.mochi-profile.console.so/api/v1/profiles/get-by-evm/${minter}?no_fetch_amount=false`,
        );

        if (!profileResponse.ok) {
          continue; // Skip if profile fetch fails
        }

        const profileData = await profileResponse.json();

        // Default to using the EVM address
        let username = minter;
        const avatar = profileData.avatar || undefined;

        // Try to find a preferred account in the fallback order
        if (
          profileData.associated_accounts &&
          profileData.associated_accounts.length > 0
        ) {
          // Sort accounts in preferred order (github > discord > twitter > evm_chain)
          const platformPriority: Record<string, number> = {
            github: 1,
            discord: 2,
            twitter: 3,
            evm_chain: 4,
          };

          const sortedAccounts = [...profileData.associated_accounts].sort(
            (a, b) => {
              const priorityA = platformPriority[a.platform as string] || 999;
              const priorityB = platformPriority[b.platform as string] || 999;
              return priorityA - priorityB;
            },
          );

          // Get the first account in the sorted list
          const preferredAccount = sortedAccounts[0];

          // Use the username if available, otherwise platform_identifier
          username =
            preferredAccount.platform_metadata?.username ||
            preferredAccount.platform_identifier ||
            minter;
        }

        // Add the collector to the results
        collectors.push({
          username,
          ...(avatar ? { avatar } : {}),
        });
      } catch (error) {
        console.error(`Error processing minter ${minter}:`, error);
        // Continue with next minter
      }
    }

    return collectors;
  } catch (error) {
    console.error(`Error fetching collectors for token ${tokenId}:`, error);
    return [];
  }
}

/**
 * Gets static props for the content page
 */
export const getStaticProps: GetStaticProps = async ({ params }) => {
  try {
    const { slug: contributorSlug } = params as { slug: string };

    const layoutProps = await getRootLayoutPageProps();

    // --- Fetch Contributor Name Casing (from Memos or infer from slug) ---
    const allMemos = await getAllMarkdownContents(); // Fetch all memos to find original name casing
    const originalContributorName =
      allMemos
        .find(memo =>
          memo.authors?.some(
            author =>
              slugify(author, { lower: true, strict: true }) ===
              contributorSlug,
          ),
        )
        ?.authors?.find(
          author =>
            slugify(author, { lower: true, strict: true }) === contributorSlug,
        ) || contributorSlug; // Fallback to slug if not found

    // --- Fetch Internal Data (Memos from DuckDB) ---
    let contributorMemos: IMemoItem[];
    try {
      contributorMemos = await queryDuckDB(`
           SELECT short_title, title, file_path, authors, description, date, tags, md_content, token_id
           FROM vault
           WHERE ARRAY_CONTAINS(authors, '${originalContributorName}')
           ORDER BY date DESC;
         `).then(convertToMemoItems);
    } catch (error) {
      console.error(
        `Failed to fetch memos for ${originalContributorName}:`,
        error,
      );
      contributorMemos = []; // Handle error
    }

    // Enrich memos with collectors data (if any)
    const memoCollectors: Record<
      string,
      Array<{ username: string; avatar?: string }>
    > = {};

    // Process each memo that has a tokenId
    for (const memo of contributorMemos) {
      if (memo.tokenId) {
        try {
          const collectors = await fetchCollectorsData(memo.tokenId);
          if (collectors.length > 0) {
            memoCollectors[memo.tokenId] = collectors;
          }
        } catch (error) {
          console.error(
            `Error enriching memo ${memo.tokenId} with collectors:`,
            error,
          );
        }
      }
    }

    // Group memos by month and sort within each month
    const aggregatedMemos: IMemoItem[][][] = [];

    if (contributorMemos.length > 0) {
      // Group memos by year-month
      const memosByMonth: Record<string, Record<string, IMemoItem[]>> = {};

      contributorMemos.forEach(memo => {
        if (!memo.date) return;

        // Convert date string to year-month key and day key
        const date = new Date(memo.date);
        const yearMonthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const dayKey = String(date.getDate()).padStart(2, '0');

        if (!memosByMonth[yearMonthKey]) {
          memosByMonth[yearMonthKey] = {};
        }

        if (!memosByMonth[yearMonthKey][dayKey]) {
          memosByMonth[yearMonthKey][dayKey] = [];
        }

        memosByMonth[yearMonthKey][dayKey].push(memo);
      });

      // Sort months in descending order (newest first)
      const sortedMonths = Object.keys(memosByMonth).sort().reverse();

      // For each month, get days and sort them in descending order
      sortedMonths.forEach(monthKey => {
        const monthData = memosByMonth[monthKey];
        const sortedDays = Object.keys(monthData).sort(
          (a, b) => parseInt(b) - parseInt(a),
        );

        const monthMemos: IMemoItem[][] = [];

        // Add each day's memos as a separate array
        sortedDays.forEach(dayKey => {
          monthMemos.push(monthData[dayKey]);
        });

        aggregatedMemos.push(monthMemos);
      });
    }

    // Generate activity array for contribution heatmap
    const contributorActivity: Record<
      string,
      Array<{
        date: string;
        count: number;
        level: number;
      }>
    > = {};

    // Create map of dates to counts from memos
    const dateCountMap: Record<string, number> = {};

    // Find unique years in the contributor's memos
    const years = new Set<string>();

    contributorMemos.forEach(memo => {
      if (!memo.date) return;

      const memoDate = memo.date.split('T')[0]; // Ensure format YYYY-MM-DD
      const year = memoDate.substring(0, 4);
      years.add(year);

      dateCountMap[memoDate] = (dateCountMap[memoDate] || 0) + 1;
    });

    // Function to get level based on count
    const getLevel = (count: number): number => {
      if (count === 0) return 0;
      if (count < 3) return 1;
      if (count < 5) return 2;
      if (count < 10) return 3;
      return 4;
    };

    // Generate activity data for each year
    years.forEach(year => {
      const yearStart = startOfYear(new Date(`${year}-01-01`));
      const yearEnd = endOfYear(new Date(`${year}-12-31`));

      const days = eachDayOfInterval({
        start: yearStart,
        end: yearEnd,
      });

      contributorActivity[year] = [];

      // Generate array of every day for this year with counts and levels
      for (let i = 0; i < days.length; i++) {
        const dateStr = days[i].toISOString().split('T')[0];
        const count = dateCountMap[dateStr] || 0;

        contributorActivity[year].push({
          date: formatISO(days[i], { representation: 'date' }),
          count,
          level: getLevel(count),
        });
      }
    });

    // --- Fetch External Data (GitHub Example using Octokit) ---
    let contributorProfile: UserProfile | null = null;
    try {
      // Check if there's a userProfiles.json file with GitHub usernames
      const userProfilesPath = path.join(
        process.cwd(),
        'public/content/userProfiles.json',
      );

      try {
        const userProfilesJson = JSON.parse(
          await fs.readFile(userProfilesPath, 'utf8'),
        ) as UserProfileJson;
        const userProfiles = userProfilesJson?.data || {};
        contributorProfile =
          userProfiles?.[contributorSlug.toLowerCase()] || null;
        if (!contributorProfile) {
          console.error(
            `No profile found for ${contributorSlug} in userProfiles.json`,
          );
        }
      } catch (readError) {
        console.error('Error reading userProfiles.json:', readError);
        // Continue with null githubData
      }
    } catch (error) {
      console.error(
        `Failed to fetch GitHub data for ${contributorSlug}:`,
        error,
      );
      // Handle errors, maybe set githubData to null or an error state
    }

    const mdxSource = await getMdxSource({
      mdxPath: path.join(
        process.cwd(),
        'public/content/contributor',
        `${contributorSlug}.mdx`,
      ),
      fallbackPath: path.join(
        process.cwd(),
        'public/content/contributor',
        '[slug].mdx',
      ),
      scope: {
        contributorName: originalContributorName,
        contributorProfile,
        contributorMemos,
        aggregatedMemos,
        contributorActivity,
        memoCollectors, // Include collectors data in scope
      },
    });

    if (!mdxSource || 'error' in mdxSource) {
      return { notFound: true }; // Handle serialization error
    }

    // temp

    const newSource = await serialize({
      source: `
<ContributorHead
    name={contributorProfile?.name || ''}
    githubId={contributorProfile?.github_username || ''}
    githubLink={contributorProfile?.github_url || ''}
    websiteLink={contributorProfile?.websiteLink || ''}
    bio={contributorProfile?.bio || ''}
    twitterUserName={contributorProfile?.twitter_username || ''}
    contributorMemos={contributorMemos}
    avatarUrl={contributorProfile?.avatar || ''}
/>

<ContributionActivityCalendar data={contributorActivity} />

<ContributorPinnedMemos data={contributorMemos.slice(0, 3)} />

<ContributorContentBody data={contributorMemos} aggregatedMemos={aggregatedMemos} memoCollectors={memoCollectors} />
      `,
    });

    if (!newSource || 'error' in newSource) {
      return { notFound: true }; // Handle serialization error
    }

    mdxSource.compiledSource = newSource.compiledSource;

    return {
      props: {
        ...layoutProps,
        slug: contributorSlug, // Pass the original requested slug
        contributorName: originalContributorName,
        contributorProfile,
        mdxSource,
        contributorMemos,
        memoCollectors, // Include in props
        frontmatter: mdxSource.frontmatter,
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
  contributorName,
  mdxSource,
  contributorProfile,
  memoCollectors,
}: ContentPageProps) {
  if (!mdxSource || 'error' in mdxSource) {
    // We already handle this in getStaticProps
    return null;
  }
  console.log(memoCollectors);
  return (
    <ContributorLayout
      title={frontmatter?.title || `${contributorName}'s Profile`}
      description={frontmatter?.description || contributorProfile?.bio || ''} // Use GitHub bio as description
      image={frontmatter?.image || contributorProfile?.avatar} // Use GitHub avatar as image
      directoryTree={directoryTree}
      searchIndex={searchIndex}
    >
      <div className="content-wrapper">
        <RemoteMdxRenderer mdxSource={mdxSource} />
      </div>
    </ContributorLayout>
  );
}
