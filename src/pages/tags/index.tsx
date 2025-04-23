import { RootLayout } from '@/components';
import { getRootLayoutPageProps } from '@/lib/content/utils';
import { RootLayoutPageProps } from '@/types';
import { GetStaticProps } from 'next';
import Link from 'next/link';
import React, { useMemo } from 'react';

export const getStaticProps: GetStaticProps = async () => {
  try {
    const layoutProps = await getRootLayoutPageProps();

    return {
      props: layoutProps,
    };
  } catch (error) {
    console.error('Error in getStaticProps:', error);
    return {
      props: {},
    };
  }
};

const TagsPage = (props: RootLayoutPageProps) => {
  const { directoryTree } = props;
  const tags = useMemo(() => {
    if (!directoryTree) return null;
    const tagsNode = directoryTree['/tags'].children;

    if (!tagsNode) return null; // Add this check as well, just in case children is null/undefined

    return Object.entries(tagsNode).sort(([a], [b]) => a.localeCompare(b));
  }, [directoryTree]);
  return (
    <RootLayout {...props} title="Tags">
      <div className="flex items-center">
        {tags && (
          <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold">Tags</h1>
            <ul className="list-disc pl-5">
              {tags.map(([path, node]) => (
                <li key={path} className="text-lg">
                  <div className="flex items-center gap-1">
                    <Link
                      href={path}
                      className="hover:text-primary hover:decoration-primary dark:hover:text-primary line-clamp-3 text-[1.0625rem] -tracking-[0.0125rem] underline decoration-neutral-100 transition-colors duration-200 ease-in-out dark:text-neutral-300"
                    >
                      {node.label}{' '}
                    </Link>
                    ({node.count})
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </RootLayout>
  );
};

export default TagsPage;
