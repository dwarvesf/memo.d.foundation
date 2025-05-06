import React from 'react';
import { GetStaticProps } from 'next';
import path from 'path';

// Import utility functions
import { getAllMarkdownContents, sortMemos } from '@/lib/content/memo';
import { getRootLayoutPageProps } from '@/lib/content/utils';

import { RootLayoutPageProps } from '@/types';

import { type SerializeResult } from 'next-mdx-remote-client/serialize';
import RemoteMdxRenderer from '@/components/RemoteMdxRenderer';
import { RootLayout } from '@/components';
import { getMdxSource } from '@/lib/mdx';

interface ContentPageProps extends RootLayoutPageProps {
  frontmatter?: Record<string, any>;

  mdxSource?: SerializeResult; // Serialized MDX source
}

export const getStaticProps: GetStaticProps = async () => {
  try {
    const allMemos = await getAllMarkdownContents();
    const layoutProps = await getRootLayoutPageProps();

    const contributors = new Set<string>();
    sortMemos(allMemos).forEach(memo => {
      const { authors } = memo;
      if (authors) {
        authors.forEach(author => {
          if (contributors.has(author)) return;
          contributors.add(author);
        });
      }
    });

    // --- Read Processed MDX Content ---
    const mdxPath = path.join(
      process.cwd(),
      'public/content/contributor',
      `index.mdx`,
    );

    const mdxSource = await getMdxSource({
      mdxPath,
      scope: {
        contributors: Array.from(contributors),
      },
    });

    if (!mdxSource || 'error' in mdxSource) {
      return { notFound: true }; // Handle serialization error
    }
    return {
      props: {
        ...layoutProps,
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
  mdxSource,
}: ContentPageProps) {
  if (!mdxSource || 'error' in mdxSource) {
    // We already handle this in getStaticProps
    return null;
  }
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
}
