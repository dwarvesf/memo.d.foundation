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
import { Activity, CollectMemo, IMemoItem, RootLayoutPageProps } from '@/types';

import {
  serialize,
  type SerializeResult,
} from 'next-mdx-remote-client/serialize';
import RemoteMdxRenderer from '@/components/RemoteMdxRenderer';
import { getMdxSource } from '@/lib/mdx';
import { UserProfile, UserProfileJson } from '@/types/user';
import ContributorLayout from '@/components/layout/ContributorLayout';
import { eachDayOfInterval, endOfYear, startOfYear, format } from 'date-fns';

interface ContentPageProps extends RootLayoutPageProps {
  frontmatter?: Record<string, any>;
  slug: string[];

  contributorName?: string; // Make optional
  contributorMemos?: IMemoItem[]; // Make optional
  contributorProfile?: UserProfile | null; // GitHub profile data
  memoCollectors?: Record<string, Array<{ username: string; avatar?: string }>>;
  aggregatedActivities?: Activity[][][]; // Combined activities (memos and collects)

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
 * Fetches the contributor's wallet address from their GitHub username
 */
async function fetchContributorWalletAddress(contributorSlug: string) {
  try {
    const response = await fetch(
      `https://api.mochi-profile.console.so/api/v1/profiles/github/get-by-username/${contributorSlug}`,
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch profile for GitHub user ${contributorSlug}: ${response.statusText}`,
      );
    }

    const profileData = await response.json();

    // Look for EVM accounts in the associated_accounts
    if (
      profileData.associated_accounts &&
      profileData.associated_accounts.length > 0
    ) {
      // Filter only EVM chain accounts
      const evmAccounts = profileData.associated_accounts.filter(
        (account: any) => account.platform === 'evm-chain',
      );

      if (evmAccounts.length > 0) {
        // Sort by updated_at in descending order (latest first)
        // If updated_at is not available, those accounts will be ordered last
        const sortedAccounts = evmAccounts.sort((a: any, b: any) => {
          if (!a.updated_at) return 1;
          if (!b.updated_at) return -1;
          return (
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
        });

        // Return the most recently updated EVM account
        return sortedAccounts[0].platform_identifier;
      }
    }

    return null; // No wallet address found
  } catch (error) {
    console.error(
      `Error fetching wallet address for ${contributorSlug}:`,
      error,
    );
    return null;
  }
}

/**
 * Fetches memos collected by the contributor (with basic info)
 */
async function fetchCollectedMemos(
  walletAddress: string,
): Promise<CollectMemo[]> {
  try {
    if (!walletAddress) {
      return [];
    }

    const response = await fetch('https://memo-nft-api-prod.fly.dev/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query {
            memoMintedEvents(where: {to: "${walletAddress}"}) {
              items {
                tokenId
                timestamp
              }
            }
          }
        `,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch collected memos: ${response.statusText}`,
      );
    }

    const data = await response.json();
    const tokenIdsWithTimestamps = data.data.memoMintedEvents.items.map(
      (item: any) => ({
        tokenId: item.tokenId,
        timestamp: item.timestamp,
      }),
    );

    if (tokenIdsWithTimestamps.length === 0) {
      return [];
    }

    // Query DuckDB for basic info about these memos
    const tokenIdsStr = tokenIdsWithTimestamps
      .map((item: { tokenId: string }) => `'${item.tokenId}'`)
      .join(',');
    const collectedMemos = await queryDuckDB(`
      SELECT token_id, title, file_path
      FROM vault
      WHERE token_id IN (${tokenIdsStr})
      ORDER BY date DESC;
    `);

    // Create a map of tokenId to memo details
    const memoDetailsMap: Record<string, { title: string; filePath: string }> =
      {};
    collectedMemos.forEach((memo: any) => {
      memoDetailsMap[memo.token_id] = {
        title: memo.title,
        filePath: memo.file_path,
      };
    });

    // Map to the expected format with formatted dates from timestamps
    return tokenIdsWithTimestamps
      .filter((item: { tokenId: string }) => memoDetailsMap[item.tokenId]) // Only include memos we found in DuckDB
      .map((item: { tokenId: string; timestamp: number }) => {
        // Convert timestamp (in seconds) to date format YYYY-MM-DD
        const date = format(new Date(item.timestamp * 1000), 'yyyy-MM-dd');

        return {
          tokenId: item.tokenId,
          title: memoDetailsMap[item.tokenId].title,
          filePath: memoDetailsMap[item.tokenId].filePath,
          date,
          type: 'collect' as const,
        };
      });
  } catch (error) {
    console.error(`Error fetching collected memos:`, error);
    return [];
  }
}

/**
 * Aggregates activities (memos and collects) by month and day
 */
function aggregateActivities(
  contributorMemos: IMemoItem[],
  memosCollected: CollectMemo[],
): Activity[][][] {
  // Combine all activities
  const allActivities: Activity[] = [...contributorMemos, ...memosCollected];

  if (allActivities.length === 0) {
    return [];
  }

  // Group activities by year-month
  const activitiesByMonth: Record<string, Record<string, Activity[]>> = {};

  allActivities.forEach(activity => {
    if (!activity.date) return;

    // Convert date string to year-month key and day key
    const date = new Date(activity.date);
    const yearMonthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const dayKey = String(date.getDate()).padStart(2, '0');

    if (!activitiesByMonth[yearMonthKey]) {
      activitiesByMonth[yearMonthKey] = {};
    }

    if (!activitiesByMonth[yearMonthKey][dayKey]) {
      activitiesByMonth[yearMonthKey][dayKey] = [];
    }

    activitiesByMonth[yearMonthKey][dayKey].push(activity);
  });

  // Sort months in descending order (newest first)
  const sortedMonths = Object.keys(activitiesByMonth).sort().reverse();

  // For each month, get days and sort them in descending order
  const aggregatedActivities: Activity[][][] = [];

  sortedMonths.forEach(monthKey => {
    const monthData = activitiesByMonth[monthKey];
    const sortedDays = Object.keys(monthData).sort(
      (a, b) => parseInt(b) - parseInt(a),
    );

    const monthActivities: Activity[][] = [];

    // Add each day's activities as a separate array
    sortedDays.forEach(dayKey => {
      // Sort activities for the day - authored memos first, then collected memos
      const sortedDayActivities = monthData[dayKey].sort((a, b) => {
        // If one is a collect and the other is not, put the authored memo first
        if ('type' in a && !('type' in b)) return 1;
        if (!('type' in a) && 'type' in b) return -1;
        return 0;
      });

      monthActivities.push(sortedDayActivities);
    });

    aggregatedActivities.push(monthActivities);
  });

  return aggregatedActivities;
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

    // Fetch contributor's wallet address
    const contributorWalletAddress =
      await fetchContributorWalletAddress(contributorSlug);

    // Fetch memos collected by the contributor (with basic info)
    let memosCollected: CollectMemo[] = [];
    if (contributorWalletAddress) {
      memosCollected = await fetchCollectedMemos(contributorWalletAddress);
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

    // Aggregate all activities (memos and collects)
    const aggregatedActivities = aggregateActivities(
      contributorMemos,
      memosCollected,
    );

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

    // Get array of years sorted in descending order (newest first)
    const sortedYears = Array.from(years).sort((a, b) => b.localeCompare(a));
    const latestYear =
      sortedYears.length > 0
        ? sortedYears[0]
        : new Date().getFullYear().toString();
    const currentYear = new Date().getFullYear().toString();

    // Check if the latest year of activity is the current year
    const isLatestYearCurrent = latestYear === currentYear;

    // Generate activity data for each year
    sortedYears.forEach(year => {
      // For the latest year, if it's the current year, we need to include activity from previous year to today
      if (year === latestYear && isLatestYearCurrent) {
        // Get the date from one year ago
        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(today.getFullYear() - 1);

        // Create interval from one year ago to today
        const days = eachDayOfInterval({
          start: oneYearAgo,
          end: today,
        });

        contributorActivity[year] = [];

        // Generate array of every day from one year ago to today with counts and levels
        for (let i = 0; i < days.length; i++) {
          const dateStr = days[i].toISOString().split('T')[0];
          const count = dateCountMap[dateStr] || 0;

          contributorActivity[year].push({
            date: dateStr,
            count,
            level: getLevel(count),
          });
        }
      } else {
        // For other years or if latest year is not current year, generate full year data
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
            date: dateStr,
            count,
            level: getLevel(count),
          });
        }
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
        aggregatedActivities,
        contributorActivity,
        memoCollectors, // Include collectors data in scope
        walletAddress: contributorWalletAddress, // Include wallet address in scope
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

<ContributorContentBody 
    data={contributorMemos} 
    aggregatedActivities={aggregatedActivities} 
    memoCollectors={memoCollectors} 
/>
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
        aggregatedActivities, // Include aggregated activities in props
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
}: ContentPageProps) {
  if (!mdxSource || 'error' in mdxSource) {
    // We already handle this in getStaticProps
    return null;
  }
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
