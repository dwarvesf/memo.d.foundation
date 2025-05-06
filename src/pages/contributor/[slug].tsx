import React from 'react';
import { GetStaticProps, GetStaticPaths } from 'next';
import path from 'path';
import fs from 'fs/promises';
import slugify from 'slugify';
import { Octokit, RestEndpointMethodTypes } from '@octokit/rest'; // For GitHub API

// Import utility functions
import { getAllMarkdownContents } from '@/lib/content/memo';
import { getRootLayoutPageProps } from '@/lib/content/utils';
import { queryDuckDB } from '@/lib/db/utils'; // Utility for DuckDB queries
import { getFirstMemoImage } from '@/components/memo/utils';

// Import components

// Import contexts and types
import { IMemoItem, RootLayoutPageProps } from '@/types';

import { type SerializeResult } from 'next-mdx-remote-client/serialize';
import RemoteMdxRenderer from '@/components/RemoteMdxRenderer';
import { Json } from '@duckdb/node-api';
import { RootLayout } from '@/components';
import { getMdxSource } from '@/lib/mdx';

interface ContentPageProps extends RootLayoutPageProps {
  frontmatter?: Record<string, any>;
  slug: string[];

  contributorName?: string; // Make optional
  contributorMemos?: IMemoItem[]; // Make optional
  githubData?: RestEndpointMethodTypes['users']['getByUsername']['response']['data'];
  discordData?: null; // Make optional
  cryptoData?: null; // Make optional
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
    let contributorMemos: Record<string, Json>[];
    try {
      contributorMemos = await queryDuckDB(`
           SELECT short_title, title, file_path, authors, description, date, tags, md_content
           FROM vault
           WHERE ARRAY_CONTAINS(authors, '${originalContributorName}')
           ORDER BY date DESC;
         `);
      contributorMemos = contributorMemos.map(memo => ({
        ...memo,
        filePath: memo.file_path,
        md_content: null, // md_content only used for image extraction
        image: getFirstMemoImage(
          {
            filePath: memo.file_path as string,
            content: memo.md_content as string,
          },
          null,
        ),
      }));
    } catch (error) {
      console.error(
        `Failed to fetch memos for ${originalContributorName}:`,
        error,
      );
      contributorMemos = []; // Handle error
    }
    // --- Fetch External Data (GitHub Example using Octokit) ---
    let githubData = null;
    try {
      // Assuming the contributor slug can be used as a GitHub username
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN }); // Use Octokit
      // Fetch user profile details (username, avatar, bio)
      const { data: githubUser } = await octokit.rest.users.getByUsername({
        username: contributorSlug,
      });
      githubData = githubUser; // Pass the user data
    } catch (error) {
      console.error(
        `Failed to fetch GitHub data for ${contributorSlug}:`,
        error,
      );
      // Handle errors, maybe set githubData to null or an error state
    }

    // --- Fetch Other External Data (Discord, Crypto, etc.) ---
    const discordData = null; // Placeholder
    const cryptoData = null; // Placeholder

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
        githubData,
        discordData,
        cryptoData,
        contributorMemos,
      },
    });

    if (!mdxSource || 'error' in mdxSource) {
      return { notFound: true }; // Handle serialization error
    }

    return {
      props: {
        ...layoutProps,
        slug: contributorSlug, // Pass the original requested slug
        contributorName: originalContributorName,
        githubData,
        mdxSource,
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
  githubData,
  mdxSource,
}: ContentPageProps) {
  if (!mdxSource || 'error' in mdxSource) {
    // We already handle this in getStaticProps
    return null;
  }
  console.log('MDX Source:', mdxSource);
  return (
    <RootLayout
      title={frontmatter?.title || `${contributorName}'s Profile`}
      description={frontmatter?.description || githubData?.bio || ''} // Use GitHub bio as description
      image={frontmatter?.image || githubData?.avatar_url} // Use GitHub avatar as image
      directoryTree={directoryTree}
      searchIndex={searchIndex}
    >
      <div className="content-wrapper">
        <RemoteMdxRenderer mdxSource={mdxSource} />
      </div>
    </RootLayout>
  );
}
