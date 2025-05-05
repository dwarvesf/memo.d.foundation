import { MDXClient, MDXComponents } from 'next-mdx-remote-client';
import React from 'react';
import { type SerializeResult } from 'next-mdx-remote-client/serialize';

interface Props {
  mdxSource: SerializeResult;
}

const components: MDXComponents = {
  ContributorHeader: props => <span>{props.name}</span>,
};
const RemoteMdxRenderer = (props: Props) => {
  const { mdxSource } = props;

  if (!mdxSource || 'error' in mdxSource) {
    return null;
  }
  return <MDXClient {...mdxSource} components={components} />;
};

export default RemoteMdxRenderer;
