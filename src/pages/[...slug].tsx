import React, { useEffect, useMemo, useRef } from 'react';
import { GetStaticProps, GetStaticPaths } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import path from 'path';
import fs from 'fs/promises';
import slugify from 'slugify';
import { Octokit, RestEndpointMethodTypes } from '@octokit/rest'; // For GitHub API

// Import utility functions
import { getAllMarkdownFiles } from '../lib/content/paths';
import { getMarkdownContent } from '../lib/content/markdown';
import { getAllMarkdownContents } from '@/lib/content/memo';
import { getRootLayoutPageProps } from '@/lib/content/utils';
import { queryDuckDB } from '@/lib/db/utils'; // Utility for DuckDB queries
import { slugToTitle } from '@/lib/utils';
import { getFirstMemoImage } from '@/components/memo/utils';

// Import components
import { RootLayout, ContentLayout } from '../components';
import SubscriptionSection from '../components/layout/SubscriptionSection';
import UtterancComments from '@/components/layout/UtterancComments';
import MintEntry from '@/components/mint-entry/MintEntry';

// Import contexts and types
import { useThemeContext } from '@/contexts/theme';
import {
  IBackLinkItem,
  IMemoItem,
  IMetadata,
  ITocItem,
  RootLayoutPageProps,
} from '@/types';
import { formatContentPath } from '@/lib/utils/path-utils';

import {
  serialize,
  type SerializeResult,
} from 'next-mdx-remote-client/serialize';
import RemoteMdxRenderer from '@/components/RemoteMdxRenderer';
import { Json } from '@duckdb/node-api';
import recmaMdxEscapeMissingComponents from 'recma-mdx-escape-missing-components';
import remarkGfm from 'remark-gfm';

interface ContentPageProps extends RootLayoutPageProps {
  content: string;
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  frontmatter?: Record<string, any>;
  slug: string[];
  backlinks?: IBackLinkItem[];
  tocItems?: ITocItem[];
  metadata?: IMetadata;
  isListPage?: boolean;
  childMemos?: IMemoItem[];

  // New props for contributor pages
  isContributorPage?: boolean; // Flag to indicate contributor page
  contributorName?: string; // Make optional
  contributorMemos?: IMemoItem[]; // Make optional
  githubData?: RestEndpointMethodTypes['users']['getByUsername']['response']['data'];
  discordData?: null; // Make optional
  cryptoData?: null; // Make optional
  // mdxContent?: string; // Processed MDX content (HTML) - Make optional
  mdxSource?: SerializeResult; // Serialized MDX source
}

/**
 * Gets static paths for all content pages including contributor profiles
 */
export const getStaticPaths: GetStaticPaths = async () => {
  // Existing logic to get paths from public/content (excluding contributor/tags)
  const contentDir = path.join(process.cwd(), 'public/content');
  const aliasesPath = path.join(contentDir, 'aliases.json');
  const redirectsPath = path.join(contentDir, 'redirects.json');

  let aliases: Record<string, string> = {};
  let redirects: Record<string, string> = {};

  try {
    const aliasesContent = await fs.readFile(aliasesPath, 'utf8');
    aliases = JSON.parse(aliasesContent);
  } catch (error) {
    console.error(`Error reading aliases.json in getStaticPaths: ${error}`);
    aliases = {};
  }

  try {
    const redirectsContent = await fs.readFile(redirectsPath, 'utf8');
    redirects = JSON.parse(redirectsContent);
  } catch (error) {
    console.error(`Error reading redirects.json in getStaticPaths: ${error}`);
    redirects = {};
  }

  const markdownPaths = (await getAllMarkdownFiles(contentDir))
    .filter(
      slugArray =>
        !slugArray[0]?.toLowerCase()?.startsWith('contributor') &&
        !slugArray[0]?.toLowerCase()?.startsWith('tags'),
    )
    .map(slugArray => ({
      params: { slug: slugArray },
    }));

  const aliasPaths = Object.keys(aliases).map(alias => ({
    params: { slug: alias.split('/').filter(Boolean) },
  }));

  const nestedAliasPaths: { params: { slug: string[] } }[] = [];
  for (const markdownPathObj of markdownPaths) {
    const markdownSlug = markdownPathObj.params.slug;
    for (const aliasKey in aliases) {
      const aliasValue = aliases[aliasKey];
      const aliasValueSegments = aliasValue.split('/').filter(Boolean);
      const aliasKeySegments = aliasKey.split('/').filter(Boolean);
      if (
        markdownSlug.length >= aliasValueSegments.length &&
        aliasValueSegments.every(
          (segment, index) => markdownSlug[index] === segment,
        )
      ) {
        const remainingSegments = markdownSlug.slice(aliasValueSegments.length);
        const newAliasSlug = [...aliasKeySegments, ...remainingSegments];
        nestedAliasPaths.push({ params: { slug: newAliasSlug } });
        break;
      }
    }
  }

  const redirectPaths = Object.keys(redirects).map(redirect => ({
    params: { slug: redirect.split('/').filter(Boolean) },
  }));

  // --- New logic to get paths for contributor profiles ---
  const authorsResult = await queryDuckDB(`
    SELECT DISTINCT UNNEST(authors) AS author
    FROM vault
    WHERE authors IS NOT NULL;
  `);
  const contributorPaths = authorsResult.map(row => ({
    params: {
      slug: [
        'contributor',
        slugify(row.author as string, { lower: true, strict: true }),
      ],
    }, // Prefix with 'contributor'
  }));

  // Additionally, check for any manually created MDX files in vault/contributor/
  const contributorVaultDir = path.join(
    process.cwd(),
    'public/content/contributor',
  );
  let manualMdxPaths: { params: { slug: string[] } }[] = [];
  try {
    const files = await fs.readdir(contributorVaultDir, {
      withFileTypes: true,
    });
    const mdxFiles = files.filter(
      dirent => dirent.isFile() && dirent.name.endsWith('.mdx'),
    );
    manualMdxPaths = mdxFiles.map(file => ({
      params: { slug: ['contributor', file.name.replace(/\\.mdx$/, '')] }, // Prefix with 'contributor'
    }));
  } catch (error) {
    console.error('Error reading vault/contributor directory:', error);
    // Continue without manual paths if directory doesn't exist or error occurs
  }

  // Combine all paths
  const allPaths = [
    ...markdownPaths,
    ...aliasPaths,
    ...nestedAliasPaths,
    ...redirectPaths,
    ...contributorPaths, // Include contributor paths from DuckDB
    ...manualMdxPaths, // Include manual contributor MDX paths
  ];

  // Deduplicate paths based on slug
  const uniquePaths = Array.from(
    new Map(allPaths.map(item => [item.params.slug.join('/'), item])).values(),
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
    const { slug } = params as { slug: string[] };
    const requestedPathSegments = slug;
    const requestedPath = `/${requestedPathSegments.join('/')}`;

    // Read aliases.json and redirects.json (existing logic)
    const contentDir = path.join(process.cwd(), 'public/content');
    const aliasesPath = path.join(contentDir, 'aliases.json');
    const redirectsPath = path.join(contentDir, 'redirects.json');

    let aliases: Record<string, string> = {};
    let redirects: Record<string, string> = {};

    try {
      const aliasesContent = await fs.readFile(aliasesPath, 'utf8');
      aliases = JSON.parse(aliasesContent);
    } catch {
      aliases = {};
    }

    try {
      const redirectsContent = await fs.readFile(redirectsPath, 'utf8');
      redirects = JSON.parse(redirectsContent);
    } catch {
      redirects = {};
    }

    // Determine the actual content path by checking for redirect or alias (existing logic)
    let contentPathSegments = [...requestedPathSegments];
    let canonicalSlug = contentPathSegments;
    let canonicalPathFound = false;

    if (redirects[requestedPath]) {
      const redirectTarget = redirects[requestedPath];
      contentPathSegments = redirectTarget.split('/').filter(Boolean);
      canonicalSlug = contentPathSegments;
      canonicalPathFound = true;
    } else {
      for (const aliasKey in aliases) {
        if (requestedPath.startsWith(aliasKey)) {
          const aliasValue = aliases[aliasKey];
          const canonicalPath = requestedPath.replace(aliasKey, aliasValue);
          contentPathSegments = canonicalPath.split('/').filter(Boolean);
          canonicalSlug = contentPathSegments;
          canonicalPathFound = true;
          break;
        }
      }
    }

    if (!canonicalPathFound) {
      canonicalSlug = requestedPathSegments;
      contentPathSegments = requestedPathSegments;
    }

    // Pass includeContent: false as we only need metadata for layout props (existing logic)
    const layoutProps = await getRootLayoutPageProps();

    // --- New logic to handle contributor profiles ---
    const isContributorPage =
      canonicalSlug[0]?.toLowerCase() === 'contributor' &&
      canonicalSlug.length > 1;

    if (isContributorPage) {
      const contributorSlug = canonicalSlug[1]; // The contributor name is the second segment

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
              slugify(author, { lower: true, strict: true }) ===
              contributorSlug,
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

      // --- Read Processed MDX Content ---
      // Assuming the build process puts processed MDX in public/content/contributor/
      let processedMdxPath = path.join(
        process.cwd(),
        'public/content/contributor',
        `${contributorSlug}.mdx`,
      ); // Assuming processed to HTML
      let mdxContent = '';

      try {
        const mdxFileExists = await fs
          .stat(processedMdxPath)
          .then(() => true)
          .catch(() => false);

        if (!mdxFileExists) {
          processedMdxPath = path.join(
            process.cwd(),
            'public/content/contributor',
            '[...slug].mdx',
          ); // Fallback to .mdx if HTML not found
        }
        mdxContent = await fs.readFile(processedMdxPath, 'utf-8');
      } catch (error) {
        console.error(
          `Failed to read processed MDX for ${contributorSlug}:`,
          error,
        );
        // Handle error, maybe use a default message
        mdxContent = `<p>Could not load profile content for ${contributorSlug}.</p>`;
      }
      const mdxSource = mdxContent
        ? await serialize({
            source: mdxContent,
            options: {
              scope: {
                contributorName: originalContributorName,
                githubData,
                discordData,
                cryptoData,
                contributorMemos,
              },
              parseFrontmatter: true,
              mdxOptions: {
                recmaPlugins: [recmaMdxEscapeMissingComponents],
                remarkPlugins: [remarkGfm],
              },
            },
          })
        : null;
      return {
        props: {
          ...layoutProps,
          slug, // Pass the original requested slug
          contributorName: originalContributorName,
          githubData,
          mdxSource,
          isContributorPage: true, // Flag to indicate this is a contributor page
        },
      };
    } else {
      // --- Existing logic for standard markdown pages ---
      let filePath =
        path.join(process.cwd(), 'public/content', ...canonicalSlug) + '.md';

      let directPathExists = false;
      try {
        await fs.stat(filePath);
        directPathExists = true;
      } catch {
        // File does not exist
      }

      if (!directPathExists) {
        const indexFilePath = path.join(
          process.cwd(),
          'public/content',
          ...canonicalSlug,
          '_index.md',
        );
        const readmeFilePath = path.join(
          process.cwd(),
          'public/content',
          ...canonicalSlug,
          'readme.md',
        );
        const directoryPath = path.join(
          process.cwd(),
          'public/content',
          ...canonicalSlug,
        );

        let readmeExists = false;
        try {
          await fs.stat(readmeFilePath);
          readmeExists = true;
        } catch {
          // File does not exist
        }

        let indexExists = false;
        try {
          await fs.stat(indexFilePath);
          indexExists = true;
        } catch {
          // File does not exist
        }

        let directoryExists = false;
        try {
          await fs.stat(directoryPath);
          directoryExists = true;
        } catch {
          // Directory does not exist
        }

        if (readmeExists) {
          filePath = readmeFilePath;
        } else if (indexExists) {
          filePath = indexFilePath;
        } else if (directoryExists) {
          const allMemos = await getAllMarkdownContents(
            canonicalSlug.join('/'),
            {
              includeContent: false,
            },
          );
          return {
            props: {
              ...layoutProps,
              slug,
              childMemos: allMemos,
              isListPage: true,
            },
          };
        } else {
          return { notFound: true };
        }
      }

      const {
        content,
        frontmatter,
        tocItems,
        rawContent,
        blockCount,
        summary,
      } = await getMarkdownContent(filePath);

      const backlinksPath = path.join(
        process.cwd(),
        'public/content/backlinks.json',
      );
      let allBacklinks: Record<string, { title: string; path: string }[]> = {};
      try {
        const backlinksContent = await fs.readFile(backlinksPath, 'utf8');
        allBacklinks = JSON.parse(backlinksContent);
      } catch (error) {
        console.error(
          `Error reading backlinks.json in getStaticProps: ${error}`,
        );
        allBacklinks = {};
      }

      const backlinks = allBacklinks[slug.join('/')] || [];

      const metadata = {
        created: frontmatter.date?.toString() || null,
        updated: frontmatter.lastmod?.toString() || null,
        author: frontmatter.authors?.[0] || '',
        coAuthors: frontmatter.authors?.slice(1) || [],
        tags: Array.isArray(frontmatter.tags)
          ? frontmatter.tags.filter(
              tag => tag !== null && tag !== undefined && tag !== '',
            )
          : [],
        folder: canonicalSlug.slice(0, -1).join('/'),
        wordCount: content.split(/\s+/).length ?? 0,
        readingTime: `${Math.ceil(content.split(/\s+/).length / 200)}m`,
        characterCount: content.length ?? 0,
        blocksCount: blockCount ?? 0,
        tokenId: frontmatter.token_id || '',
        permaStorageId: frontmatter.perma_storage_id || '',
        title: frontmatter.title || '',
        authorRole: frontmatter.author_role || '',
        image: frontmatter.img || '',
        firstImage: getFirstMemoImage(
          {
            content: rawContent,
            filePath: path.join(...canonicalSlug) + '.md',
          },
          null,
        ),
        summary,
      };
      return {
        props: {
          ...layoutProps,
          content,
          frontmatter: JSON.parse(JSON.stringify(frontmatter)),
          slug,
          backlinks,
          tocItems,
          metadata,
          isListPage: false,
          isContributorPage: false, // Flag to indicate this is NOT a contributor page
        },
      };
    }
  } catch (error) {
    console.error('Error in getStaticProps:', error);
    return { notFound: true };
  }
};

export default function ContentPage({
  content,
  frontmatter,
  slug,
  backlinks,
  tocItems,
  metadata,
  directoryTree,
  searchIndex,
  isListPage,
  childMemos,
  // New props for contributor pages
  isContributorPage,
  contributorName,
  githubData,
  mdxSource,
}: ContentPageProps) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const { theme, isThemeLoaded } = useThemeContext();

  // Existing useEffect for internal links
  useEffect(() => {
    const handleInternalLinks = (event: MouseEvent) => {
      const targetLink = (event.target as HTMLElement).closest(
        'a.js-nextjs-link',
      );
      if (targetLink && targetLink.getAttribute('href')) {
        const href = targetLink.getAttribute('href')!;
        try {
          const resolvedUrl = new URL(href, window.location.href);
          const targetPath = resolvedUrl.pathname;
          event.preventDefault();
          router.push(targetPath);
        } catch (error) {
          console.error('Error resolving URL or pushing to router:', error);
        }
      }
    };
    const contentElement = contentRef.current;
    if (contentElement) {
      contentElement.addEventListener('click', handleInternalLinks, {
        capture: true,
      });
    }
    return () => {
      if (contentElement) {
        contentElement.removeEventListener('click', handleInternalLinks, {
          capture: true,
        });
      }
    };
  }, [content, router]);

  // Existing useEffect for Mermaid (needs adaptation for MDX)
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      !isListPage &&
      (frontmatter || isContributorPage) && // Run for both markdown and contributor pages
      isThemeLoaded
    ) {
      import('mermaid').then(mermaid => {
        try {
          const mermaidTheme = theme === 'dark' ? 'dark' : 'neutral';
          mermaid.default.initialize({
            startOnLoad: false,
            theme: mermaidTheme,
          });
          // Select elements within the rendered markdown/mdx content
          const elements = contentRef.current?.querySelectorAll<HTMLElement>(
            'code.language-mermaid',
          );
          if (elements && elements.length > 0) {
            const elementsArray = Array.from(elements);
            mermaid.default.run({ nodes: elementsArray });
          }
        } catch (error) {
          console.error('Failed to initialize or run Mermaid:', error);
        }
      });
    }
  }, [
    content,
    isListPage,
    frontmatter,
    theme,
    isThemeLoaded,
    isContributorPage,
  ]); // Add isContributorPage to dependencies

  const contentEl = useMemo(() => {
    return (
      <div
        className="article-content"
        dangerouslySetInnerHTML={{ __html: content }}
        ref={contentRef}
      />
    );
  }, [content]);

  // Conditional rendering based on page type
  if (isListPage) {
    const title = slug.map(slugToTitle).join(' > ');
    return (
      <RootLayout
        title={title}
        searchIndex={searchIndex}
        directoryTree={directoryTree}
      >
        <div className="flex items-center justify-center">
          {childMemos && (
            <div className="flex w-fit flex-col gap-4">
              <h1 className="text-2xl font-bold">{title}</h1>
              <ul className="list-disc pl-5">
                {childMemos.map(memo => (
                  <li key={memo.filePath} className="text-lg">
                    <Link
                      href={formatContentPath(memo.filePath)}
                      className="hover:text-primary hover:decoration-primary dark:hover:text-primary decoration-link-decoration line-clamp-3 text-[1.0625rem] -tracking-[0.0125rem] underline transition-colors duration-200 ease-in-out dark:text-neutral-300"
                    >
                      {memo.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </RootLayout>
    );
  } else if (isContributorPage && mdxSource !== undefined) {
    const frontmatter = mdxSource.frontmatter as Record<string, string>;
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
  } else if (content !== undefined && frontmatter !== undefined) {
    // --- Render Standard Markdown Page (Existing Logic) ---
    const shouldShowSubscription =
      !frontmatter?.hide_subscription &&
      !['home', 'tags', 'contributor'].some(path => slug.includes(path));

    return (
      <RootLayout
        title={frontmatter.title || 'Dwarves Memo'}
        description={frontmatter.description}
        image={metadata?.firstImage}
        tocItems={tocItems}
        metadata={metadata}
        directoryTree={directoryTree}
        searchIndex={searchIndex}
      >
        <div className="content-wrapper">
          <ContentLayout
            title={frontmatter.title}
            description={frontmatter.description}
            backlinks={backlinks}
            hideFrontmatter={frontmatter.hide_frontmatter}
            hideTitle={frontmatter.hide_title}
            metadata={metadata}
          >
            {contentEl}
          </ContentLayout>
          {shouldShowSubscription && <SubscriptionSection />}
          {!!metadata?.tokenId && <MintEntry metadata={metadata} />}
          <UtterancComments />
        </div>
      </RootLayout>
    );
  } else {
    // Handle case where content or frontmatter is undefined (shouldn't happen with fallback: false)
    return (
      <RootLayout
        title="Not Found"
        directoryTree={directoryTree}
        searchIndex={searchIndex}
      >
        <div>Page not found.</div>
      </RootLayout>
    );
  }
}
