## RFC: Implementing Dynamic Contributor Profiles within the Existing Page Handler

**Status:** Proposed

## **Context:**

The current contributor page implementation at `src/pages/contributor/[slug].tsx` is functional but rigid. It primarily lists a contributor's memos fetched from our DuckDB `vault`. The vision is far grander: a rich, dynamic profile page bundling information from disparate sources like GitHub, Discord, and crypto wallets, serving as a lasting commemoration of contributions. Our editors, while not Next.js gurus, are comfortable with Markdown. This necessitates a shift towards a more flexible content format (MDX) that allows for easier authoring and integration of external data, all while adhering to our static export (`output: 'export'`) constraint. The goal is to integrate this functionality into the existing dynamic page handler, `src/pages/[...slug].tsx`, treating contributor profiles as another type of content page.

## **Decision:**

We will implement dynamic contributor profiles by extending the functionality of the existing dynamic route file, `src/pages/[...slug].tsx`. Source MDX content for contributor profiles will reside in `vault/contributor/` and be processed by the build pipeline into `public/content/contributor/`. The `src/pages/[...slug].tsx` file will handle the build-time data fetching (`getStaticPaths` and `getStaticProps`) for both external data (using standard libraries like Octokit for GitHub) and internal data from the DuckDB `vault`. It will also read the processed MDX content. The fetched data and processed content will be passed as props to the `ContentPage` component within `src/pages/[...slug].tsx`, which will be modified to render the contributor profile layout and data.

## **Detailed Plan and Implementation:**

This isn't just slapping some Markdown together; this is building a data-driven content engine for our most valuable asset: our contributors! The core idea is to leverage Next.js's static generation capabilities to pull all necessary data _before_ the site is deployed, burning it into static HTML pages. No client-side shenanigans for core data display, keeping things fast and reliable.

1.  **File Structure:**
    The source MDX content files for contributor profiles will reside within the `vault` at `vault/contributor/`. The existing dynamic route handler file, `src/pages/[...slug].tsx`, will be modified to handle contributor profile paths and data. There is no separate page file specifically for contributors in `src/pages/`.

2.  **`next.config.ts` Modifications:**
    We need to tell Next.js to recognize `.mdx` files and ensure they are processed by the build pipeline (likely alongside your existing markdown processing). This requires adding `'mdx'` to the `pageExtensions` array and integrating a Next.js MDX plugin, such as `@next/mdx`. The build process will need to be configured to process `.mdx` files from `vault/` to `public/content/`, similar to how `.md` files are handled.

    ```typescript
    import type { NextConfig } from 'next';
    import withMDX from '@next/mdx'; // Assuming @next/mdx is installed

    const nextConfig: NextConfig = {
      output: 'export',
      trailingSlash: true,
      pageExtensions: ['js', 'jsx', 'md', 'ts', 'tsx', 'mdx'], // Add 'mdx'
      images: {
        unoptimized: true,
      },
      reactStrictMode: true,
      experimental: {
        largePageDataBytes: 1024 * 1024,
      },
    };

    // Merge MDX config with Next.js config
    const withMdxConfig = withMDX({
      // MDX options go here if needed
      extension: /\.mdx?$/,
    })(nextConfig);

    export default withMdxConfig;
    ```

    _Note: You'll need to install `@next/mdx` and potentially other related MDX packages._ This just wires up the compiler; the real magic happens in the data fetching and content processing pipeline. The existing build script that processes markdown from `vault/` to `public/content/` will need to be updated to include `.mdx` files.

3.  **`getStaticPaths` Implementation (within `src/pages/[...slug].tsx`):**
    The existing `getStaticPaths` function in `src/pages/[...slug].tsx` will be modified to include paths for contributor profiles. It will query the DuckDB `vault` to get the list of authors and also check for any manually created MDX files in `vault/contributor/`. These paths will be added to the existing paths generated from other markdown files.

    ```typescript
    import { GetStaticPaths } from 'next';
    // Assume you have a DuckDB utility function to run queries
    import { queryDuckDB } from '@/lib/db/utils'; // Placeholder utility
    import slugify from 'slugify';
    import path from 'path';
    import fs from 'fs/promises';
    import { getAllMarkdownFiles } from '../lib/content/paths'; // Existing utility

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
        console.error(
          `Error reading redirects.json in getStaticPaths: ${error}`,
        );
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
            const remainingSegments = markdownSlug.slice(
              aliasValueSegments.length,
            );
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

      const contributorPaths = authorsResult.map((row: { author: string }) => ({
        params: {
          slug: [
            'contributor',
            slugify(row.author, { lower: true, strict: true }),
          ],
        }, // Prefix with 'contributor'
      }));

      // Additionally, check for any manually created MDX files in vault/contributor/
      const contributorVaultDir = path.join(process.cwd(), 'vault/contributor');
      let manualMdxPaths: { params: { slug: string[] } }[] = [];
      try {
        const files = await fs.readdir(contributorVaultDir, {
          withFileTypes: true,
        });
        const mdxFiles = files.filter(
          dirent => dirent.isFile() && dirent.name.endsWith('.mdx'),
        );
        manualMdxPaths = mdxFiles.map(file => ({
          params: { slug: ['contributor', file.name.replace(/\.mdx$/, '')] }, // Prefix with 'contributor'
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
        new Map(
          allPaths.map(item => [item.params.slug.join('/'), item]),
        ).values(),
      );

      return {
        paths: uniquePaths,
        fallback: false, // Essential for static export
      };
    };
    ```

    _This function now generates paths for both standard markdown pages and dynamic contributor profiles based on authors in the vault and manual MDX files._

4.  **`getStaticProps` Implementation (within `src/pages/[...slug].tsx`):**
    The existing `getStaticProps` function in `src/pages/[...slug].tsx` will be modified to detect if the requested slug corresponds to a contributor profile. If it does, it will fetch the necessary external data (GitHub profile) and internal data (memos from DuckDB) and read the processed MDX content from `public/content/contributor/`. If it's a standard markdown page, it will continue with the existing logic. All fetched data and content will be passed as props to the `ContentPage` component.

    ```typescript
    import { GetStaticProps } from 'next';
    // Assume utilities for fetching memo data and external data
    import { getAllMarkdownContents } from '@/lib/content/memo'; // Existing memo utilities
    import { Octokit } from '@octokit/rest'; // Assuming octokit is installed
    import { getRootLayoutPageProps } from '@/lib/content/utils'; // Utility for layout props
    import path from 'path';
    import fs from 'fs/promises';
    import { queryDuckDB } from '@/lib/db/utils'; // Utility for DuckDB queries
    import { getMarkdownContent } from '../lib/content/markdown'; // Existing markdown processing utility

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
          let contributorMemos = null;
          try {
            contributorMemos = await queryDuckDB(`
               SELECT short_title, title, file_path
               FROM vault
               WHERE ARRAY_CONTAINS(authors, '${originalContributorName}')
               ORDER BY date DESC;
             `);
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
            const { data: githubUser } = await octokit.rest.users.getByUsername(
              {
                username: contributorSlug,
              },
            );
            githubData = githubUser; // Pass the user data
          } catch (error) {
            console.error(
              `Failed to fetch GitHub data for ${contributorSlug}:`,
              error,
            );
            // Handle errors, maybe set githubData to null or an error state
          }

          // --- Fetch Other External Data (Discord, Crypto, etc.) ---
          let discordData = null; // Placeholder
          let cryptoData = null; // Placeholder

          // --- Read Processed MDX Content ---
          // Assuming the build process puts processed MDX in public/content/contributor/
          const processedMdxPath = path.join(
            process.cwd(),
            'public/content/contributor',
            `${contributorSlug}.html`,
          ); // Assuming processed to HTML
          let mdxContent = '';
          try {
            mdxContent = await fs.readFile(processedMdxPath, 'utf-8');
          } catch (error) {
            console.error(
              `Failed to read processed MDX for ${contributorSlug}:`,
              error,
            );
            // Handle error, maybe use a default message
            mdxContent = `<p>Could not load profile content for ${contributorSlug}.</p>`;
          }

          return {
            props: {
              ...layoutProps,
              slug, // Pass the original requested slug
              contributorName: originalContributorName,
              contributorMemos,
              githubData,
              discordData,
              cryptoData,
              mdxContent,
              isContributorPage: true, // Flag to indicate this is a contributor page
            },
          };
        } else {
          // --- Existing logic for standard markdown pages ---
          let filePath =
            path.join(process.cwd(), 'public/content', ...canonicalSlug) +
            '.md';

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
          let allBacklinks: Record<string, { title: string; path: string }[]> =
            {};
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
    ```

    _This function now intelligently handles both standard markdown pages and contributor profiles, fetching the appropriate data based on the requested slug._

5.  **MDX Source Content (`vault/contributor/[...slug].mdx`):**
    This file contains the source MDX content written by editors. It uses Markdown for static text and JSX components to render dynamic data. Data fetched in `getStaticProps` in the `.tsx` file will be passed down as props to the component that renders this processed MDX content. The embedded `dsql-list` blocks for fetching memos can still be used here, assuming the build pipeline is configured to execute them during MDX processing and inject the results into the processed HTML.

    ````mdx
    import { ContributorHeader } from '@/components/ContributorHeader';
    import { GitHubActivity } from '@/components/GitHubActivity';
    import { MemoList } from '@/components/MemoList';
    // Import other components for Discord, Crypto, etc.

    {/* No component export or return needed in the MDX content file itself */}
    {/* This file is processed by the build pipeline */}

    {/* Components will receive data as props, either directly or via context */}
    {/* The exact mechanism depends on how the .tsx page renders the processed MDX */}

    <ContributorHeader name={props.contributorName} />
    {/* Access data via props */}

    ## About {props.contributorName}

    {/* Static bio content can go here, or maybe fetched from a new field in vault/authors? */}
    This is the profile page for {props.contributorName}, a valued contributor to the Dwarves Brainery.

    ## Contributions

    ### Memos

    {/* DuckDB query embedded directly in MDX to list memos by this author */}
    {/* The build process needs to be configured to execute these blocks */}

    \```dsql-list
    SELECT markdown_link(COALESCE(short_title, title), file_path)
    FROM vault
    WHERE ARRAY_CONTAINS(authors, '${props.contributorName}') -- Assuming authors is an array and contributorName is the exact name
    ORDER BY date DESC;
    \```

    ### GitHub Activity

    {props.githubData ? (

    <GitHubActivity data={props.githubData} />) : (
    <p>Could not load GitHub activity for {props.contributorName}.</p>
    )}

    {/_ Add sections for Discord, Crypto, etc. using similar conditional rendering _/}

    {/_ More static MDX content or components _/}
    ````

    _This is where the editors write the content. Markdown for prose, components for data. Simple, powerful._

    The components (`ContributorHeader`, `GitHubActivity`, `MemoList`) will need to be created or adapted to accept and display the specific data structures passed to them. Data passed from `getStaticProps` in the `.tsx` file will be available to components rendered within the processed MDX content, typically via a `props` object or context.

6.  **Page Component (`src/pages/[...slug].tsx` default export):**
    The default export `ContentPage` component in `src/pages/[...slug].tsx` will be modified to conditionally render either the standard markdown page content or the contributor profile layout and data based on the `isContributorPage` prop.

    ```typescript
    import React, { useEffect, useMemo, useRef } from 'react';
    import { useRouter } from 'next/router';
    import Link from 'next/link';
    import {
      IBackLinkItem,
      IMemoItem,
      IMetadata,
      ITocItem,
      RootLayoutPageProps,
    } from '@/types';
    import { RootLayout, ContentLayout } from '../components';
    import SubscriptionSection from '../components/layout/SubscriptionSection';
    import UtterancComments from '@/components/layout/UtterancComments';
    import MintEntry from '@/components/mint-entry/MintEntry';
    import { useThemeContext } from '@/contexts/theme';
    import { formatMemoPath, getFirstMemoImage } from '@/components/memo/utils';
    import { slugToTitle } from '@/lib/utils';
    // Assume a component exists to render processed markdown/mdx HTML
    import RenderMarkdown from '@/components/RenderMarkdown'; // Assuming this component exists

    // Import components used in MDX
    import { ContributorHeader } from '@/components/ContributorHeader';
    import { GitHubActivity } from '@/components/GitHubActivity';
    import { MemoList } from '@/components/MemoList';
    // Import other components for Discord, Crypto, etc.


    interface ContentPageProps extends RootLayoutPageProps {
      // Existing props for standard markdown pages
      content?: string; // Make optional
      frontmatter?: Record<string, any>; // Make optional
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
      githubData?: any; // Make optional
      discordData?: any; // Make optional
      cryptoData?: any; // Make optional
      mdxContent?: string; // Processed MDX content (HTML) - Make optional
    }

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
      contributorMemos,
      githubData,
      discordData,
      cryptoData,
      mdxContent,
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
      }, [content, isListPage, frontmatter, theme, isThemeLoaded, isContributorPage]); // Add isContributorPage to dependencies

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
                          href={formatMemoPath(memo.filePath)}
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
      } else if (isContributorPage && mdxContent !== undefined) {
         // --- Render Contributor Page ---
         // Pass fetched data as props to components used within the MDX
         const components = {
            ContributorHeader: (mdxProps: any) => <ContributorHeader {...mdxProps} name={contributorName} />,
            GitHubActivity: (mdxProps: any) => <GitHubActivity {...mdxProps} data={githubData} />,
            MemoList: (mdxProps: any) => <MemoList {...mdxProps} memos={contributorMemos} />,
            // Add other components used in MDX here
         };

         return (
           <RootLayout
             title={`${contributorName}'s Profile`}
             description={githubData?.bio || ''} // Use GitHub bio as description
             image={githubData?.avatar_url} // Use GitHub avatar as image
             // tocItems={...} // TOC might be generated from MDX processing
             // metadata={...} // Metadata might be generated from MDX processing
             directoryTree={directoryTree}
             searchIndex={searchIndex}
           >
             <div className="content-wrapper">
               {/* Render the processed MDX content (HTML) */}
               <RenderMarkdown content={mdxContent} components={components} contentRef={contentRef} />

               {/* Subscription, MintEntry, Comments sections can be included if desired */}
               {/* {shouldShowSubscription && <SubscriptionSection />} */}
               {/* {!!metadata?.tokenId && <MintEntry metadata={metadata} />} */}
               {/* <UtterancComments /> */}
             </div>
           </RootLayout>
         );

      } else if (content !== undefined && frontmatter !== undefined) {
        // --- Render Standard Markdown Page (Existing Logic) ---
        const shouldShowSubscription =
          !frontmatter?.hide_subscription &&
          !['home', 'tags', 'contributor'].some(path => slug.includes(path));
        const contentEl = useMemo(() => {
          return (
            <div
              className="article-content"
              dangerouslySetInnerHTML={{ __html: content }}
              ref={contentRef}
            />
          );
        }, [content]);

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
         return <RootLayout title="Not Found" directoryTree={directoryTree} searchIndex={searchIndex}><div>Page not found.</div></RootLayout>;
      }
    }
    ```

    _The `ContentPage` component is now a conditional renderer, displaying either a standard markdown page or a contributor profile based on the `isContributorPage` prop._ It uses the `RenderMarkdown` component to display the processed MDX content and passes the fetched data to the components used within the MDX.

**Integration with Current Setup:**

This new system deeply integrates contributor profile handling into the existing `src/pages/[...slug].tsx` file. The `getStaticPaths` and `getStaticProps` functions are modified to include and handle contributor paths and data alongside existing logic. The `ContentPage` component becomes a central renderer for both types of pages. This aligns with treating contributor profiles as a standard content type within the site. The build pipeline will need to be updated to process `.mdx` files from `vault/` to `public/content/`, similar to `.md` files, and potentially handle embedded `dsql-list` blocks during this processing.

**Alternatives Considered:**

We briefly considered creating a separate MDX file _manually_ for each contributor. This is clearly suboptimal. Generating pages dynamically from the DuckDB author list is the only sane way to scale this. Manual files would be a maintenance nightmare, requiring updates every time a new contributor publishes a memo. Using a separate page file (`src/pages/contributor/[...slug].tsx` or `[...slug].mdx`) was considered in previous iterations, but integrating into the existing handler centralizes dynamic page logic.

**Consequences:**

- **Benefits:**
  - **Centralized Dynamic Page Logic:** All `getStaticPaths` and `getStaticProps` for dynamic pages are in one file (`src/pages/[...slug].tsx`).
  - **Consistent Content Sourcing:** Aligns with the existing pattern of sourcing content files (now including MDX) from the `vault/` directory.
  - **Flexibility:** The editors can easily update contributor bios and page layouts using familiar Markdown syntax, embedding rich components where needed. This is a massive win for content velocity!
  - **Richer Profiles:** We can finally integrate external data, making these profiles actual hubs of contributor activity, not just memo lists. GitHub profile info, Discord stats, maybe even NFT galleries – the possibilities are vast!
- **Drawbacks:**
  - **Increased Complexity of `[...slug].tsx`:** This file becomes more complex as it handles logic for multiple page types.
  - **Build Time:** Fetching data from external APIs and querying DuckDB at build time will increase build duration. This is the cost of static richness. We'll need to monitor this and potentially implement caching strategies if it becomes excessive.
  - **Dependency on External APIs:** The build process now relies on the availability and responsiveness of external services. Failures here will break the build. Robust error handling in `getStaticProps` is essential.
  - **Build Pipeline Adaptation:** Adapting the build pipeline to process `.mdx` files from `vault/` (including potentially executing embedded `dsql-list` blocks) and ensuring the `.tsx` page correctly renders the processed MDX content with injected components and data requires careful implementation.

This revised plan integrates dynamic contributor profiles into the existing page handling mechanism, leveraging MDX content from the vault and fetching external data at build time. It's a significant upgrade that respects your existing workflow and empowers content creators, while centralizing dynamic page logic. Let's build this thing!
