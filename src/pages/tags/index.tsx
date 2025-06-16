import { RootLayout } from '@/components';
import { GetStaticProps } from 'next';
import Link from 'next/link';
import React from 'react';
import { getTagsWithCounts } from '@/lib/content/tags-utils';
import { getRootLayoutPageProps } from '@/lib/content/utils';
import { RootLayoutPageProps } from '@/types';
import { truncate } from 'lodash';

interface TagCount {
  name: string;
  count: string;
}

interface TagsPageProps extends RootLayoutPageProps {
  tagCounts: TagCount[];
}

export const getStaticProps: GetStaticProps<TagsPageProps> = async () => {
  try {
    const tagCounts = await getTagsWithCounts();
    const layoutProps = await getRootLayoutPageProps();

    return {
      props: {
        tagCounts: tagCounts.map(tag => ({
          name: tag.name,
          count: tag.count.toString(), // Convert count to string as per requirement
        })),
        ...layoutProps,
      },
    };
  } catch (error) {
    console.error('Error in getStaticProps:', error);
    return {
      props: {
        tagCounts: [],
      },
    };
  }
};

const TagsPage = ({ tagCounts, directoryTree }: TagsPageProps) => {
  return (
    <RootLayout title="Tags" directoryTree={directoryTree}>
      <div className="flex items-center">
        {tagCounts && tagCounts.length > 0 && (
          <div className="flex flex-col gap-4">
            <h1 className="mt-0 mb-8 text-2xl font-bold">
              Explore articles by tag:
            </h1>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3 lg:grid-cols-4">
              {tagCounts.map(tag => (
                <div key={tag.name} className="gap-1 text-sm">
                  <Link
                    href={`/tags/${tag.name.toLocaleLowerCase()}`}
                    className="hover:text-primary hover:decoration-primary dark:hover:text-primary decoration-link-decoration whitespace-nowrap underline transition-colors duration-200 ease-in-out dark:text-neutral-300"
                  >
                    {truncate(tag.name, {
                      length: 22,
                    })}
                  </Link>
                  <span className="text-muted-foreground ml-1 opacity-75">
                    ({tag.count})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </RootLayout>
  );
};

export default TagsPage;
