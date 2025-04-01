import React, { useMemo } from 'react';
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
  tag: string;
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
  const tags = new Set<string>();
  allMemos.forEach(memo => {
    if (memo.tags?.length) {
      memo.tags.forEach(tag => {
        if (tag) {
          tags.add(tag);
        }
      });
    }
  });

  const paths = [...tags].map(tag => ({
    params: { slug: tag },
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
    const layoutProps = await getRootLayoutPageProps(allMemos);

    const tag = slug;
    if (!tag) {
      return { notFound: true };
    }
    const memos = filterMemo({
      data: allMemos,
      filters: { tags: tag },
      limit: null,
    });
    return {
      props: {
        ...layoutProps,
        slug,
        tag,
        data: memos,
      },
    };
  } catch (error) {
    console.error('Error in getStaticProps:', error);
    return { notFound: true };
  }
};

export default function TagDetailPage({
  tag,
  directoryTree,
  searchIndex,
  data,
}: ContentPageProps) {
  const groupedMemos = useMemo(() => {
    const grouped: Record<string, IMemoItem[]> = {};
    data.forEach(memo => {
      const firstLetter = memo.title[0]?.toUpperCase();
      if (!grouped[firstLetter]) {
        grouped[firstLetter] = [];
      }
      grouped[firstLetter].push(memo);
    });
    return grouped;
  }, [data]);
  return (
    <RootLayout
      title={tag}
      directoryTree={directoryTree}
      searchIndex={searchIndex}
    >
      <div className="flex items-center justify-center">
        <div className="flex w-fit flex-col">
          <h1 className="-track-[0.5px] mb-5 pt-0 text-[35px] leading-[42px] font-semibold">
            #{tag}
          </h1>
          {Object.entries(groupedMemos).map(([letter, memos]) => (
            <div key={letter} className="mt-[var(--element-margin)]">
              <h2 className="text-[26px] leading-[140%] font-semibold -tracking-[0.0125rem]">
                {letter}
              </h2>
              <ul className="mt-[var(--list-margin)] flex flex-col gap-[0.875rem]">
                {memos.map(memo => (
                  <li
                    key={memo.filePath}
                    className="flex flex-col flex-wrap items-baseline gap-x-2"
                  >
                    <Link
                      href={formatMemoPath(memo.filePath)}
                      className="shink-0 hover:text-primary truncate transition-all duration-150 hover:underline"
                    >
                      {memo.title}
                    </Link>
                    <div className="space-x-1">
                      {memo.tags?.slice(0, 3).map(tag => (
                        <Link
                          key={tag}
                          href={`/tags/${tag}`}
                          className="dark:bg-border hover:text-primary text-2xs rounded-[2.8px] bg-[#f9fafb] px-1.5 leading-[1.7] font-medium text-neutral-500 hover:underline"
                        >
                          {tag}
                        </Link>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>{' '}
            </div>
          ))}
        </div>
      </div>
    </RootLayout>
  );
}
