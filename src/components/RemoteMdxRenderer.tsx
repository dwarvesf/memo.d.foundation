import { MDXClient, MDXComponents } from 'next-mdx-remote-client';
import React from 'react';
import { type SerializeResult } from 'next-mdx-remote-client/serialize';
import Link from 'next/link';
import { formatMemoPath } from './memo/utils';
import { cn } from '@/lib/utils';

interface Props {
  mdxSource: SerializeResult;
}

const components: MDXComponents = {
  ContributorHeader: props => <span>{props.name}</span>,
  MemoLink: props => {
    const { filePath, className, ...rest } = props;
    return (
      <Link
        href={formatMemoPath(filePath || '')}
        className={cn(
          'line-clamp-3 text-[1.0625rem] -tracking-[0.0125rem] underline transition-colors duration-200 ease-in-out dark:text-neutral-300',
          className,
        )}
        {...rest}
      />
    );
  },
  wrapper(props) {
    const { children } = props;
    return (
      <div
        className={cn(
          'article-content prose dark:prose-dark prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight max-w-none font-serif',
          'prose-a:text-foreground prose-a:underline prose-a:decoration-link-decoration prose-a:hover:text-primary prose-a:hover:decoration-primary prose-a:font-[inherit]',
          'prose-table:border prose-img:mt-[var(--element-margin)]',
        )}
      >
        {children}
      </div>
    );
  },
};
const RemoteMdxRenderer = (props: Props) => {
  const { mdxSource } = props;

  if (!mdxSource || 'error' in mdxSource) {
    return null;
  }
  return <MDXClient {...mdxSource} components={components} />;
};

export default RemoteMdxRenderer;
