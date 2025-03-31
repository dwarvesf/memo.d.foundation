import React from 'react';
import fs from 'fs';
import path from 'path';
import { GetStaticProps, GetStaticPaths } from 'next';

// Import utility functions from lib directory
import { getAllMarkdownFiles } from '../lib/content/paths';
import { getMarkdownContent } from '../lib/content/markdown';
import { getBacklinks } from '../lib/content/backlinks';

// Import components
import { RootLayout, ContentLayout } from '../components';
import SubscriptionSection from '../components/layout/SubscriptionSection';
import {
  IBackLinkItem,
  IMetadata,
  ITocItem,
  RootLayoutPageProps,
} from '@/types';
import UtterancComments from '@/components/layout/UtterancComments';
import { getRootLayoutPageProps } from '@/lib/content/utils';

interface ContentPageProps extends RootLayoutPageProps {
  content: string;
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  frontmatter: Record<string, any>;
  slug: string[];
  backlinks: IBackLinkItem[];
  tocItems?: ITocItem[];
  metadata?: IMetadata;
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

  const paths = getAllMarkdownFiles(contentDir).map(slugArray => ({
    params: { slug: slugArray },
  }));

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
    const layoutProps = await getRootLayoutPageProps();

    // Try multiple file path options to support Hugo's _index.md convention
    let filePath = path.join(process.cwd(), 'public/content', ...slug) + '.md';

    // If the direct path doesn't exist, check if there's an _index.md or readme.md file in the directory
    if (!fs.existsSync(filePath)) {
      const indexFilePath = path.join(
        process.cwd(),
        'public/content',
        ...slug,
        '_index.md',
      );
      const readmeFilePath = path.join(
        process.cwd(),
        'public/content',
        ...slug,
        'readme.md',
      );

      if (fs.existsSync(readmeFilePath)) {
        // Prioritize readme.md if it exists
        filePath = readmeFilePath;
      } else if (fs.existsSync(indexFilePath)) {
        filePath = indexFilePath;
      } else {
        return { notFound: true };
      }
    }

    // Get markdown content and frontmatter
    const { content, frontmatter, tocItems } =
      await getMarkdownContent(filePath);

    // Get backlinks
    const backlinks = await getBacklinks(slug);
    const metadata = {
      created: frontmatter.date?.toString() || null,
      updated: frontmatter.lastmod?.toString() || null,
      author: frontmatter.authors?.[0] || '',
      coAuthors: frontmatter.authors?.slice(1) || [],
      tags: frontmatter.tags || [],
      folder: slug.slice(0, -1).join('/'),
      // Calculate reading time based on word count (average reading speed: 200 words per minute)
      wordCount: content.split(/\s+/).length ?? 0,
      readingTime: `${Math.ceil(content.split(/\s+/).length / 200)}m`,
      // Additional character and block counts for metadata
      characterCount: content.length ?? 0,
      blocksCount: content.split(/\n\s*\n/).length ?? 0,
    };
    return {
      props: {
        ...layoutProps,
        content,
        frontmatter: JSON.parse(JSON.stringify(frontmatter)), // Ensure serializable
        slug,
        backlinks,
        tocItems,
        metadata,
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
}: ContentPageProps) {
  // Format metadata for display

  // Don't show subscription for certain pages
  const shouldShowSubscription =
    !frontmatter.hide_subscription &&
    !['home', 'tags', 'contributor'].some(path => slug.includes(path));

  return (
    <RootLayout
      title={frontmatter.title || 'Dwarves Memo'}
      description={frontmatter.description}
      image={frontmatter.image}
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
        >
          {/* Render the HTML content safely */}
          <div
            className="article-content"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </ContentLayout>

        {/* Only show subscription section on content pages, not special pages */}
        {shouldShowSubscription && <SubscriptionSection />}
        <UtterancComments />
      </div>
    </RootLayout>
  );
}
