import { RootLayout } from '@/components';
import { getAllMarkdownContents, sortMemos } from '@/lib/content/memo';
import { getRootLayoutPageProps } from '@/lib/content/utils';
import { RootLayoutPageProps } from '@/types';
import { GetStaticProps } from 'next';
import Link from 'next/link';
import React, { useMemo } from 'react';

export const getStaticProps: GetStaticProps = async () => {
  try {
    const allMemos = await getAllMarkdownContents();
    const layoutProps = await getRootLayoutPageProps(allMemos);
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
    return {
      props: { ...layoutProps, contributors: Array.from(contributors) },
    };
  } catch (error) {
    console.error('Error in getStaticProps:', error);
    return {
      props: {},
    };
  }
};

const Contributor = (
  props: RootLayoutPageProps & {
    contributors: string[];
  },
) => {
  const { contributors } = props;
  const sortedContributors = useMemo(() => {
    if (!contributors) return null;
    return contributors;
  }, [contributors]);

  return (
    <RootLayout {...props} title="Contributors">
      <div className="">
        {sortedContributors && (
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-2xl font-bold">Contributors</h1>
            <ul className="list-disc pl-5">
              {sortedContributors.map(contributor => (
                <li key={contributor} className="text-lg">
                  <Link
                    href={`/contributor/${contributor}`}
                    className="hover:text-primary hover:decoration-primary dark:hover:text-primary text-[1.0625rem] -tracking-[0.0125rem] underline decoration-neutral-100 transition-colors duration-200 ease-in-out dark:text-neutral-300"
                  >
                    {contributor}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </RootLayout>
  );
};

export default Contributor;
