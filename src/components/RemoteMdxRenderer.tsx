import { MDXClient, MDXComponents } from 'next-mdx-remote-client';
import React from 'react';
import { type SerializeResult } from 'next-mdx-remote-client/serialize';
import Link from 'next/link';
import { formatMemoPath } from './memo/utils';

interface Props {
  mdxSource: SerializeResult;
}

const components: MDXComponents = {
  ContributorHeader: props => <span>{props.name}</span>,
  MemoLink: props => {
    const { filePath, ...rest } = props;
    return <Link href={formatMemoPath(filePath || '')} {...rest} />;
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
