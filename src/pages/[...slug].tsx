import React, { useEffect, useMemo, useRef } from 'react';
import { GetStaticProps, GetStaticPaths } from 'next';
import { useRouter } from 'next/router';
import path from 'path';
import fs from 'fs/promises';

// Import utility functions
import { getMarkdownContent } from '../lib/content/markdown';
import { getAllMarkdownContents } from '@/lib/content/memo';
import {
  getRootLayoutPageProps,
  getServerSideRedirectPath,
} from '@/lib/content/utils';
import { slugToTitle } from '@/lib/utils';
import { getFirstMemoImage } from '@/components/memo/utils';

// Import components
import { RootLayout, ContentLayout } from '../components';
import SubscriptionSection from '../components/layout/SubscriptionSection';
import GiscusComments from '@/components/layout/GiscusComments';
import MintEntry from '@/components/mint-entry/MintEntry';
import RemoteMdxRenderer from '@/components/RemoteMdxRenderer'; // Add this import
import { SerializeResult } from 'next-mdx-remote-client/serialize'; // Add this import

// Import contexts and types
import { useThemeContext } from '@/contexts/theme';
import {
  IBackLinkItem,
  IMemoItemWithAuthors,
  IMetadata,
  ITocItem,
  RootLayoutPageProps,
} from '@/types';
import { getMdxSource } from '@/lib/mdx';
import { normalizePathWithSlash } from '../../scripts/common';
import { getRedirectsBackLinks, getStaticJSONPaths } from '@/lib/content/paths';
import { MemoList } from '@/components/memo/MemoList';
import { getCompactContributorsFromContentJSON } from '@/lib/contributor';
import { SearchDocument } from '../../scripts/generate-search-index';

interface ContentPageProps extends RootLayoutPageProps {
  content?: string;
  mdxSource?: SerializeResult; // Add this for MDX support
  frontmatter?: Record<string, any>;
  slug: string[];
  backlinks?: IBackLinkItem[];
  tocItems?: ITocItem[];
  metadata?: IMetadata;
  isListPage?: boolean;
  isMdxPage?: boolean; // Flag to indicate MDX content
  childMemos?: IMemoItemWithAuthors[];
}

/**
 * Gets static paths for all content pages including contributor profiles
 */
export const getStaticPaths: GetStaticPaths = async () => {
  // Existing logic to get paths from public/content (excluding contributor/tags)
  const paths = await getStaticJSONPaths();

  const appPaths = Object.keys(paths).map(path => ({
    params: { slug: path.split('/').filter(Boolean) },
  }));

  // Combine all paths
  const excludePaths = ['index'];
  const allPaths = appPaths.filter(path => {
    const slug = path.params.slug.join('/');
    return !excludePaths.some(excludePath => slug.startsWith(excludePath));
  });

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
    const requestedPath = normalizePathWithSlash(
      requestedPathSegments.join('/'),
    );

    const paths = await getStaticJSONPaths();

    const targetPath = paths[requestedPath] ?? requestedPath;

    const canonicalSlug = targetPath.split('/').filter(Boolean);

    // Pass includeContent: false as we only need metadata for layout props
    const layoutProps = await getRootLayoutPageProps();

    // --- Check for MDX files first ---
    // (Variable names must not conflict with those above)
    const mdxFilePath2 =
      path.join(process.cwd(), 'public/content', ...canonicalSlug) + '.mdx';

    let mdxExists = false;
    try {
      await fs.stat(mdxFilePath2);
      mdxExists = true;
    } catch {
      // MDX file does not exist
    }

    // MDX index/readme alternatives
    const mdxIndexFilePath2 = path.join(
      process.cwd(),
      'public/content',
      ...canonicalSlug,
      '_index.mdx',
    );
    const mdxReadmeFilePath2 = path.join(
      process.cwd(),
      'public/content',
      ...canonicalSlug,
      'readme.mdx',
    );

    let mdxIndexExists = false;
    try {
      await fs.stat(mdxIndexFilePath2);
      mdxIndexExists = true;
    } catch {
      // MDX index file does not exist
    }

    let mdxReadmeExists = false;
    try {
      await fs.stat(mdxReadmeFilePath2);
      mdxReadmeExists = true;
    } catch {
      // MDX readme file does not exist
    }

    // If MDX file exists, use that instead of markdown
    if (mdxExists || mdxIndexExists || mdxReadmeExists) {
      const actualMdxPath = mdxExists
        ? mdxFilePath2
        : mdxReadmeExists
          ? mdxReadmeFilePath2
          : mdxIndexFilePath2;

      // Process MDX similar to contributor/index.tsx
      const mdxSource = await getMdxSource({
        mdxPath: actualMdxPath,
        // You can add scope variables here if needed
      });

      if (!mdxSource || 'error' in mdxSource) {
        return { notFound: true }; // Handle serialization error
      }

      // Extract metadata similar to markdown files for consistency
      const frontmatter: Record<string, any> = mdxSource.frontmatter || {};

      return {
        props: {
          ...layoutProps,
          mdxSource,
          frontmatter,
          slug,
          backlinks: [], // Backlinks aren't implemented for MDX yet
          isListPage: false,
          isMdxPage: true,
        },
      };
    }

    // --- Continue with existing markdown file logic if no MDX ---
    let filePath =
      path.join(process.cwd(), 'public/content', ...canonicalSlug) + '.md';

    let directPathExists = false;
    try {
      await fs.stat(filePath);
      directPathExists = true;
    } catch {
      // File does not exist
    }

    let readmeExists = false;
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
        const userProfiles = await getCompactContributorsFromContentJSON();
        const avatarMap = userProfiles.reduce(
          (acc, profile) => {
            if (profile.avatar) {
              acc[profile.username] = profile.avatar;
            }
            return acc;
          },
          {} as Record<string, string>,
        );

        const preMemos = await getAllMarkdownContents(canonicalSlug.join('/'), {
          includeContent: false,
        });

        const allMemos = preMemos.map(memo => {
          const authorAvatars =
            memo.authors && Array.isArray(memo.authors)
              ? memo.authors.map(author => avatarMap[author] ?? null)
              : [];
          return { ...memo, authorAvatars };
        });

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

    const { content, frontmatter, tocItems, rawContent, blockCount, summary } =
      await getMarkdownContent(filePath);

    const backlinksPath = path.join(
      process.cwd(),
      'public/content/backlinks.json',
    );
    let allBacklinks: Record<string, { title: string; path: string }[]> = {};
    try {
      const backlinksContent = await fs.readFile(backlinksPath, 'utf8');
      allBacklinks = JSON.parse(backlinksContent);
    } catch (error) {
      console.error(`Error reading backlinks.json in getStaticProps: ${error}`);
      allBacklinks = {};
    }

    const backlinks = getRedirectsBackLinks(
      slug.join('/'),
      allBacklinks,
      paths,
    );

    const pageViewsPath = path.join(
      process.cwd(),
      'public/content/pageviews.json',
    );

    let pageViews: Record<string, number> = {};
    try {
      const pageViewsContent = await fs.readFile(pageViewsPath, 'utf8');
      pageViews = JSON.parse(pageViewsContent);
    } catch (error) {
      console.error(`Error reading pageviews.json in getStaticProps: ${error}`);
      pageViews = {};
    }
    const pageViewCount = pageViews[requestedPath] || 1;
    const firstImage = getFirstMemoImage(
      {
        content: rawContent,
        filePath: path.join(...canonicalSlug) + (readmeExists ? '' : '.md'),
      },
      null,
    );
    let searchingIndex: SearchDocument[] = [];
    try {
      const searchIndexPath = path.join(
        process.cwd(),
        'public/content/search-index.json',
      );
      const searchIndexContent = await fs.readFile(searchIndexPath, 'utf8');
      const parsedContent = JSON.parse(searchIndexContent);
      if (
        parsedContent?.index?.storedFields &&
        typeof parsedContent?.index?.storedFields === 'object'
      ) {
        searchingIndex = Object.values(parsedContent.index?.storedFields);
      }
    } catch (error) {
      console.error(
        `Error reading search-index.json in getStaticProps: ${error}`,
      );
    }
    const sprContent = searchingIndex.find(
      i => i.file_path === requestedPath || i.web_path === requestedPath,
    );
    const metadata = {
      created: frontmatter.date?.toString() || null,
      updated: frontmatter.lastmod?.toString() || null,
      author: frontmatter.authors?.[0] || '',
      coAuthors: frontmatter.authors?.slice(1) || [],
      tags: Array.isArray(frontmatter.tags)
        ? frontmatter.tags
            .filter(tag => tag !== null && tag !== undefined && tag !== '')
            .map(tag => tag.toString())
        : [],
      folder: getServerSideRedirectPath(
        canonicalSlug.slice(0, -1).join('/'),
        paths,
      ),
      pageViewCount,
      wordCount: content.split(/\s+/).length ?? 0,
      readingTime: `${Math.ceil(content.split(/\s+/).length / 200)}m`,
      characterCount: content.length ?? 0,
      blocksCount: blockCount ?? 0,
      tokenId: frontmatter.token_id || '',
      permaStorageId: frontmatter.perma_storage_id || '',
      title: frontmatter.title || '',
      authorRole: frontmatter.author_role || '',
      image: frontmatter.img || frontmatter.image || firstImage || '',
      firstImage,
      summary,
      sprContent: sprContent?.spr_content || '',
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
        isMdxPage: false,
      },
    };
  } catch (error) {
    console.error('Error in getStaticProps:', error);
    return { notFound: true };
  }
};

export default function ContentPage({
  content,
  mdxSource,
  frontmatter,
  slug,
  backlinks,
  tocItems,
  metadata,
  directoryTree,
  searchIndex,
  isListPage,
  isMdxPage,
  childMemos,
}: ContentPageProps) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const { theme, isThemeLoaded } = useThemeContext();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window._memo_frontmatter = frontmatter || {};
  }, [frontmatter, router.asPath]);

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
      frontmatter && // Run for both markdown and contributor pages
      isThemeLoaded &&
      !isMdxPage // Only run for markdown, not MDX
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
            mermaid.default.run({
              nodes: elementsArray,
              postRenderCallback: (svgId: string) => {
                const svgElement = document.getElementById(
                  svgId,
                ) as SVGElement | null;
                if (svgElement) {
                  const container =
                    svgElement.parentElement as HTMLElement | null;
                  if (container) {
                    // Style the container (the <code> block)
                    container.style.display = 'block'; // Ensure it behaves as a block
                    container.style.maxHeight = '75vh'; // Max height is viewport height
                    container.style.overflow = 'hidden'; // Crucial for containing the SVG
                    container.style.position = 'relative'; // For positioning controls and enabling grab cursor
                    container.style.cursor = 'grab'; // Initial cursor for panning

                    // Style the SVG element
                    svgElement.style.width = '100%';
                    svgElement.style.height = '100%';
                    svgElement.style.maxWidth = '100%'; // Ensure it doesn't overflow container width
                    svgElement.style.maxHeight = '100%';
                    svgElement.style.display = 'block';
                    svgElement.style.transformOrigin = 'top center'; // Zoom and pan relative to center

                    // Initialize or retrieve current transform state
                    const svgRect = svgElement.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();

                    // Calculate scale to fit diagram within container while maintaining aspect ratio
                    const scaleX = containerRect.width / svgRect.width;
                    const scaleY = containerRect.height / svgRect.height;
                    const initialOptimalScale = Math.min(scaleX, scaleY);

                    // Initialize scale, defaulting to the optimal scale if not already set
                    const scale = parseFloat(
                      svgElement.dataset.scale || String(initialOptimalScale),
                    );

                    svgElement.style.transform = `scale(${scale})`;
                  }
                }
              },
            });
          }
        } catch (error) {
          console.error('Failed to initialize or run Mermaid:', error);
        }
      });
    }
  }, [content, isListPage, frontmatter, theme, isThemeLoaded, isMdxPage]);

  const contentEl = useMemo(() => {
    return (
      <div
        className="article-content"
        dangerouslySetInnerHTML={{ __html: content || '' }}
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
        <MemoList title={title} memos={childMemos || []} />
      </RootLayout>
    );
  } else if (isMdxPage && mdxSource) {
    // MDX Page Rendering
    return (
      <RootLayout
        title={frontmatter?.title}
        description={frontmatter?.description} // Use GitHub bio as description
        image={frontmatter?.image} // Use GitHub avatar as image
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

    const shouldRenderTableOfContent = frontmatter?.toc ?? false;

    return (
      <RootLayout
        title={frontmatter.title || 'Dwarves Memo'}
        description={frontmatter.description}
        image={metadata?.image}
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
            tableOfContents={shouldRenderTableOfContent ? tocItems : undefined}
            hideFrontmatter={frontmatter.hide_frontmatter}
            hideTitle={frontmatter.hide_title}
            metadata={metadata}
          >
            {contentEl}
          </ContentLayout>
          {shouldShowSubscription && <SubscriptionSection />}
          {!!metadata?.tokenId && <MintEntry metadata={metadata} />}
          <GiscusComments />
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
