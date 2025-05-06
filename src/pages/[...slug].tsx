import React, { useEffect, useMemo, useRef } from 'react';
import fs from 'fs/promises'; // Use asynchronous promises API
import path from 'path';
import { GetStaticProps, GetStaticPaths } from 'next';
import { useRouter } from 'next/router'; // Import useRouter

// Import utility functions from lib directory
import { getAllMarkdownFiles } from '../lib/content/paths';
import { getMarkdownContent } from '../lib/content/markdown';
// import { getBacklinks } from '../lib/content/backlinks'; // Removed

// Import components
import { RootLayout, ContentLayout } from '../components';
import SubscriptionSection from '../components/layout/SubscriptionSection';
import {
  IBackLinkItem,
  IMemoItem,
  IMetadata,
  ITocItem,
  RootLayoutPageProps,
} from '@/types';
import UtterancComments from '@/components/layout/UtterancComments';
import { getRootLayoutPageProps } from '@/lib/content/utils';
import { getAllMarkdownContents } from '@/lib/content/memo';
import Link from 'next/link';
import { getFirstMemoImage } from '@/components/memo/utils';
import { formatContentPath } from '@/lib/utils/path-utils';
import { slugToTitle } from '@/lib/utils';
import MintEntry from '@/components/mint-entry/MintEntry';
import { useThemeContext } from '@/contexts/theme';

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
}

/**
 * Gets all possible paths for static generation
 * @returns Object with paths and fallback setting
 */
export const getStaticPaths: GetStaticPaths = async () => {
  // This function is called at build time to generate all possible paths
  // When using "output: export" we need to pre-render all paths
  // that will be accessible in the exported static site
  const contentDir = path.join(process.cwd(), 'public/content');
  const aliasesPath = path.join(contentDir, 'aliases.json');
  const redirectsPath = path.join(contentDir, 'redirects.json');

  let aliases: Record<string, string> = {};
  let redirects: Record<string, string> = {}; // To store redirects

  try {
    const aliasesContent = await fs.readFile(aliasesPath, 'utf8'); // Await asynchronous readFile
    aliases = JSON.parse(aliasesContent);
  } catch (error) {
    console.error(`Error reading aliases.json in getStaticPaths: ${error}`);
    aliases = {}; // Initialize as empty object if file not found
  }

  try {
    const redirectsContent = await fs.readFile(redirectsPath, 'utf8'); // Await asynchronous readFile
    redirects = JSON.parse(redirectsContent);
  } catch (error) {
    console.error(`Error reading redirects.json in getStaticPaths: ${error}`);
    redirects = {}; // Initialize as empty object if file not found
  }

  const markdownPaths = (await getAllMarkdownFiles(contentDir)) // Await the asynchronous function
    .filter(
      slugArray =>
        !slugArray[0]?.toLowerCase()?.startsWith('contributor') &&
        !slugArray[0]?.toLowerCase()?.startsWith('tags'),
    )
    .map(slugArray => ({
      params: { slug: slugArray },
    }));

  // Add alias paths (for alias roots) to the generated paths
  const aliasPaths = Object.keys(aliases).map(alias => ({
    params: { slug: alias.split('/').filter(Boolean) }, // Split alias path into slug array
  }));

  // Add paths for content files under aliased directories
  const nestedAliasPaths: { params: { slug: string[] } }[] = [];
  for (const markdownPathObj of markdownPaths) {
    const markdownSlug = markdownPathObj.params.slug;

    for (const aliasKey in aliases) {
      const aliasValue = aliases[aliasKey];
      const aliasValueSegments = aliasValue.split('/').filter(Boolean);
      const aliasKeySegments = aliasKey.split('/').filter(Boolean);

      // Check if the markdown slug starts with the alias value segments
      if (
        markdownSlug.length >= aliasValueSegments.length &&
        aliasValueSegments.every(
          (segment, index) => markdownSlug[index] === segment,
        )
      ) {
        // Extract the remaining segments from the markdown slug
        const remainingSegments = markdownSlug.slice(aliasValueSegments.length);

        // Construct the new alias slug
        const newAliasSlug = [...aliasKeySegments, ...remainingSegments];

        nestedAliasPaths.push({ params: { slug: newAliasSlug } });
        // Break here since a markdown file should only belong to one aliased directory
        break;
      }
    }
  }

  // Add redirect paths to the generated paths
  const redirectPaths = Object.keys(redirects).map(redirect => ({
    params: { slug: redirect.split('/').filter(Boolean) }, // Split redirect path into slug array
  }));

  const paths = [
    ...markdownPaths,
    ...aliasPaths,
    ...nestedAliasPaths, // Include nested alias paths
    ...redirectPaths, // Include redirect paths
  ];

  return {
    paths,
    fallback: false, // Must be 'false' for static export
  };
};

/**
 * Gets static props for the content page
 */
export const getStaticProps: GetStaticProps = async ({ params }) => {
  try {
    const { slug } = params as { slug: string[] };
    const requestedPathSegments = slug; // Use slug array directly
    const requestedPath = `/${requestedPathSegments.join('/')}`;

    // Read aliases.json and redirects.json
    const contentDir = path.join(process.cwd(), 'public/content');
    const aliasesPath = path.join(contentDir, 'aliases.json');
    const redirectsPath = path.join(contentDir, 'redirects.json');

    let aliases: Record<string, string> = {};
    let redirects: Record<string, string> = {};

    try {
      const aliasesContent = await fs.readFile(aliasesPath, 'utf8'); // Await asynchronous readFile
      aliases = JSON.parse(aliasesContent);
    } catch {
      aliases = {}; // Initialize as empty object if file not found
    }

    try {
      const redirectsContent = await fs.readFile(redirectsPath, 'utf8'); // Await asynchronous readFile
      redirects = JSON.parse(redirectsContent);
    } catch {
      redirects = {}; // Initialize as empty object if file not found
    }

    // Determine the actual content path by checking for redirect or alias
    let contentPathSegments = [...requestedPathSegments]; // Start with requested segments
    let canonicalSlug = contentPathSegments; // Initialize canonical slug
    let canonicalPathFound = false;

    // Check for redirect
    if (redirects[requestedPath]) {
      const redirectTarget = redirects[requestedPath];
      contentPathSegments = redirectTarget.split('/').filter(Boolean);
      canonicalSlug = contentPathSegments; // Update canonical slug after redirect
      canonicalPathFound = true;
    } else {
      // Check for alias, including nested aliases
      for (const aliasKey in aliases) {
        if (requestedPath.startsWith(aliasKey)) {
          const aliasValue = aliases[aliasKey];
          // Construct the canonical path by replacing the alias key with the alias value
          const canonicalPath = requestedPath.replace(aliasKey, aliasValue);
          contentPathSegments = canonicalPath.split('/').filter(Boolean);
          canonicalSlug = contentPathSegments; // Update canonical slug after alias
          canonicalPathFound = true;
          break; // Found a matching alias, no need to check further
        }
      }
    }

    // If canonical path was not found via redirect or alias, use the requested path segments
    if (!canonicalPathFound) {
      // This block handles cases where the requested path is already canonical
      // or if the alias is only for the first segment (handled by the old logic,
      // but the new logic above should cover this too).
      // Keep the original requestedPathSegments as canonicalSlug if no alias/redirect matched.
      canonicalSlug = requestedPathSegments;
      contentPathSegments = requestedPathSegments; // Ensure contentPathSegments is also the requested segments
    }

    // Canonical slug is the modified segments array

    // Pass includeContent: false as we only need metadata for layout props
    const layoutProps = await getRootLayoutPageProps();
    // Try multiple file path options to support Hugo's _index.md convention
    let filePath =
      path.join(process.cwd(), 'public/content', ...canonicalSlug) + '.md';

    // If the direct path doesn't exist, check if there's an _index.md or readme.md file in the directory
    let directPathExists = false;
    try {
      await fs.stat(filePath); // Use asynchronous stat to check existence
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
        await fs.stat(readmeFilePath); // Use asynchronous stat
        readmeExists = true;
      } catch {
        // File does not exist
      }

      let indexExists = false;
      try {
        await fs.stat(indexFilePath); // Use asynchronous stat
        indexExists = true;
      } catch {
        // File does not exist
      }

      let directoryExists = false;
      try {
        await fs.stat(directoryPath); // Use asynchronous stat
        directoryExists = true;
      } catch {
        // Directory does not exist
      }

      if (readmeExists) {
        // Prioritize readme.md if it exists
        filePath = readmeFilePath;
      } else if (indexExists) {
        filePath = indexFilePath;
      } else if (directoryExists) {
        // Pass includeContent: false as list page only needs title/path
        // Use canonicalSlug for file system operations
        const allMemos = await getAllMarkdownContents(canonicalSlug.join('/'), {
          includeContent: false,
        });
        return {
          props: {
            ...layoutProps,
            slug, // Pass the original requested slug
            childMemos: allMemos,
            isListPage: true,
          },
        };
      } else {
        return { notFound: true };
      }
    }

    const { content, frontmatter, tocItems, rawContent, blockCount, summary } =
      await getMarkdownContent(filePath);

    // Get backlinks from the pre-calculated file
    const backlinksPath = path.join(
      process.cwd(),
      'public/content/backlinks.json',
    );
    let allBacklinks: Record<string, { title: string; path: string }[]> = {};
    try {
      const backlinksContent = await fs.readFile(backlinksPath, 'utf8'); // Await asynchronous readFile
      allBacklinks = JSON.parse(backlinksContent);
    } catch (error) {
      console.error(`Error reading backlinks.json in getStaticProps: ${error}`);
      allBacklinks = {}; // Initialize as empty object if file not found
    }

    // Use the original requested slug to find backlinks
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
      folder: canonicalSlug.slice(0, -1).join('/'), // Use the canonical slug for folder
      // Calculate reading time based on word count (average reading speed: 200 words per minute)
      wordCount: content.split(/\s+/).length ?? 0,
      readingTime: `${Math.ceil(content.split(/\s+/).length / 200)}m`,
      // Additional character and block counts for metadata
      characterCount: content.length ?? 0,
      blocksCount: blockCount ?? 0,

      // Mint entry metadata
      tokenId: frontmatter.token_id || '',
      permaStorageId: frontmatter.perma_storage_id || '',
      title: frontmatter.title || '',
      authorRole: frontmatter.author_role || '',
      image: frontmatter.img || '',
      firstImage: getFirstMemoImage(
        {
          content: rawContent,
          filePath: path.join(...canonicalSlug) + '.md', // Use the canonical slug for filePath
        },
        null,
      ),
      summary,
    };
    return {
      props: {
        ...layoutProps,
        content,
        frontmatter: JSON.parse(JSON.stringify(frontmatter)), // Ensure serializable
        slug, // Pass the original requested slug
        backlinks,
        tocItems,
        metadata,
        isListPage: false,
      },
    };
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
}: ContentPageProps) {
  const router = useRouter(); // Get the router instance
  const contentRef = useRef<HTMLDivElement>(null); // Create a ref for the content div
  const { theme, isThemeLoaded } = useThemeContext();

  useEffect(() => {
    // Function to handle clicks on internal links
    const handleInternalLinks = (event: MouseEvent) => {
      // Use closest to find the anchor tag, handling clicks on child elements
      const targetLink = (event.target as HTMLElement).closest(
        'a.js-nextjs-link',
      );

      if (targetLink && targetLink.getAttribute('href')) {
        const href = targetLink.getAttribute('href')!;

        try {
          // Resolve the relative URL against the current location to get the full path
          const resolvedUrl = new URL(href, window.location.href);
          const targetPath = resolvedUrl.pathname;

          event.preventDefault(); // Prevent default browser navigation
          router.push(targetPath); // Use Next.js router for navigation with resolved path
        } catch (error) {
          console.error('Error resolving URL or pushing to router:', error);
          // Allow default navigation if an error occurs
        }
      }
    };

    // Add event listener to the content div if found, using the capturing phase
    const contentElement = contentRef.current;
    if (contentElement) {
      contentElement.addEventListener('click', handleInternalLinks, {
        capture: true,
      }); // Added { capture: true }
    }

    // Clean up the event listener
    return () => {
      if (contentElement) {
        // Need to remove with the same options
        contentElement.removeEventListener('click', handleInternalLinks, {
          capture: true,
        }); // Added { capture: true }
      }
    };
  }, [content, router]); // Re-run effect if content or router changes

  useEffect(() => {
    // Only run mermaid initialization on the client side for content pages
    // and after the theme context has loaded
    if (
      typeof window !== 'undefined' &&
      !isListPage &&
      frontmatter &&
      isThemeLoaded
    ) {
      import('mermaid').then(mermaid => {
        try {
          // Determine Mermaid theme based on the application theme
          const mermaidTheme = theme === 'dark' ? 'dark' : 'neutral'; // Use 'neutral' or 'default' for light mode

          mermaid.default.initialize({
            startOnLoad: false, // We manually trigger rendering
            theme: mermaidTheme,
            // You can add more config options here if needed
          });

          // Find all elements that need Mermaid rendering
          const elements = document.querySelectorAll<HTMLElement>(
            'code.language-mermaid',
          );
          if (elements.length > 0) {
            // Convert NodeList to Array of HTMLElement for type compatibility
            const elementsArray = Array.from(elements);
            mermaid.default.run({ nodes: elementsArray });
          }
        } catch (error) {
          console.error('Failed to initialize or run Mermaid:', error);
        }
      });
    }
    // Rerun if content, page type, frontmatter, or theme changes
  }, [content, isListPage, frontmatter, theme, isThemeLoaded]);

  // Format metadata for display

  // Don't show subscription for certain pages
  const shouldShowSubscription =
    !frontmatter?.hide_subscription &&
    !['home', 'tags', 'contributor'].some(path => slug.includes(path));
  const contentEl = useMemo(() => {
    return (
      <div
        className="article-content"
        dangerouslySetInnerHTML={{ __html: content }}
        ref={contentRef} // Assign the ref here
      />
    );
  }, [content]);

  if (isListPage || !frontmatter) {
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
  }
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
          {/* Render the HTML content safely */}
          {contentEl}
        </ContentLayout>

        {/* Only show subscription section on content pages, not special pages */}
        {shouldShowSubscription && <SubscriptionSection />}
        {!!metadata?.tokenId && <MintEntry metadata={metadata} />}
        <UtterancComments />
      </div>
    </RootLayout>
  );
}
