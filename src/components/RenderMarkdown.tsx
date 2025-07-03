import React, { useMemo } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  content?: string;
  className?: string;
}
const components: Components = {
  h1: ({ children }) => (
    <h1 className="mb-4 text-xl font-semibold">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 text-lg font-semibold">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 text-base font-semibold">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-2">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-element-margin list-disc space-y-2 pl-6">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-element-margin list-decimal space-y-2 pl-6">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-5">{children}</li>,
  hr: () => <hr className="border-border my-6 border-t" />,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
};
const plugins = [remarkGfm];

const RenderMarkdown = ({ content }: Props) => {
  const formattedContent = useMemo(() => {
    if (!content) return null;
    return content.replace(/<hr\s*\/?>/gi, '\n').replace(/\\n/gi, '\n');
  }, [content]);

  if (!formattedContent) return null;

  return (
    <ReactMarkdown remarkPlugins={plugins} components={components}>
      {formattedContent}
    </ReactMarkdown>
  );
};

export default RenderMarkdown;
