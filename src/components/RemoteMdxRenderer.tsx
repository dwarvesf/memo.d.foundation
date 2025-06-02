import { MDXClient, MDXComponents } from 'next-mdx-remote-client';
import React from 'react';
import { type SerializeResult } from 'next-mdx-remote-client/serialize';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import MemoVList from './memo/MemoVList';
import ContributorHead from './memo/ContributorHead';
import { formatContentPath } from '@/lib/utils/path-utils';
import MemoVLinkList from './memo/MemoVLinkList';
import MemoTimelineList from './memo/MemoTimelineList';
import MemosByCategory from './memo/MemosByCategory';
import If from './common/If';
import Choose from './common/Choose';
import ContributionActivityCalendar from './memo/ContributionActivityCalendar';
import ContributorPinnedMemos from './memo/ContributorPinnedMemos';
import ContributorMemoTimeline from './memo/contributor-memo-timeline';
import ContributorContentBody from './memo/ContributorContentBody';

interface Props {
  mdxSource: SerializeResult;
}

const components: MDXComponents = {
  If,
  Choose,
  Link,
  MemoVLinkList,
  ContributorHead,
  ContributionActivityCalendar,
  ContributorPinnedMemos,
  ContributorMemoTimeline,
  ContributorContentBody,
  MemoVList,
  MemoTimelineList,
  MemosByCategory,
  MemoLink: props => {
    const { filePath, className, ...rest } = props;
    return (
      <Link
        href={formatContentPath(filePath || '')}
        className={cn(
          'line-clamp-3 text-[1.0625rem] -tracking-[0.0125rem] underline transition-colors duration-200 ease-in-out dark:text-neutral-300',
          className,
        )}
        {...rest}
      />
    );
  },
  a: props => {
    const { href, ...rest } = props;
    return <Link href={formatContentPath(href)} {...rest} />;
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
