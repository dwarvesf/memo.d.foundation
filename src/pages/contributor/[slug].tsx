import React from 'react';
import { GetStaticProps, GetStaticPaths } from 'next';

// Import utility functions from lib directory

// Import components
import { IMemoItem, RootLayoutPageProps } from '@/types';
import { getRootLayoutPageProps } from '@/lib/content/utils';
import { filterMemo, getAllMarkdownContents } from '@/lib/content/memo';
import { RootLayout } from '@/components';
import Link from 'next/link';
import { formatMemoPath } from '@/components/memo/utils';

interface ContentPageProps extends RootLayoutPageProps {
  data: IMemoItem[];
  contributor: string;
}

/**
 * Gets all possible paths for static generation
 * @returns Object with paths and fallback setting
 */
export const getStaticPaths: GetStaticPaths = async () => {
  // This function is called at build time to generate all possible paths
  // When using "output: export" we need to pre-render all paths
  // that will be accessible in the exported static site
  const allMemos = await getAllMarkdownContents();
  const contributors = new Set<string>();
  allMemos.forEach(memo => {
    if (memo.authors?.length) {
      memo.authors.forEach(contributor => {
        if (contributor) {
          // Store contributor names in lowercase to avoid case sensitivity issues
          contributors.add(contributor.toLowerCase());
        }
      });
    }
  });

  const paths = [...contributors].map(contributor => ({
    params: { slug: contributor },
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
    const { slug } = params as { slug: string };
    const allMemos = await getAllMarkdownContents();
    const layoutProps = await getRootLayoutPageProps(); // Modified line

    const contributor = slug;
    if (!contributor) {
      return { notFound: true };
    }

    // Find the original case of the contributor name
    const originalContributor =
      allMemos
        .find(memo =>
          memo.authors?.some(
            author => author?.toLowerCase() === contributor.toLowerCase(),
          ),
        )
        ?.authors?.find(
          author => author?.toLowerCase() === contributor.toLowerCase(),
        ) || contributor;

    const memos = filterMemo({
      data: allMemos,
      filters: { authors: originalContributor },
      limit: null,
      excludeContent: true,
    });

    return {
      props: {
        ...layoutProps,
        slug,
        contributor: originalContributor, // Use the original case for display
        data: memos,
      },
    };
  } catch (error) {
    console.error('Error in getStaticProps:', error);
    return { notFound: true };
  }
};

export default function ContentPage({
  contributor,
  directoryTree,
  searchIndex,
  data,
}: ContentPageProps) {
  return (
    <RootLayout
      title={contributor}
      directoryTree={directoryTree}
      searchIndex={searchIndex}
    >
      <div className="flex items-center">
        <div className="flex flex-col">
          <h1 className="-track-[0.5px] mb-5 pt-0 text-[35px] leading-[42px] font-semibold">
            {contributor}
          </h1>

          <h3 className="mt-[var(--subheading-margin)] text-[21px] leading-[140%] font-bold">
            Contributions
          </h3>
          <ul className="mt-[var(--list-margin)] flex list-disc flex-col gap-[var(--list-item-spacing)] pl-5">
            {data?.map(memo => (
              <li key={memo.filePath} className="text-lg">
                <Link
                  href={formatMemoPath(memo.filePath)}
                  className="hover:text-primary hover:decoration-primary dark:hover:text-primary line-clamp-3 text-[1.0625rem] -tracking-[0.0125rem] underline decoration-neutral-100 transition-colors duration-200 ease-in-out dark:text-neutral-300"
                >
                  {memo.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </RootLayout>
  );
}
