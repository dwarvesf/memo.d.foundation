import React, { PropsWithChildren, useMemo } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  content?: string;
  className?: string;
  getHighlightedText?: (text: string) => string;
}

const createMarkdownComponent = (
  Tag: keyof React.JSX.IntrinsicElements,
  className?: string,
  getHighlightedText?: (text: string) => string,
) => {
  const Component = (props: PropsWithChildren) => {
    const { children } = props;
    return (
      <Tag className={className}>
        {typeof children === 'string' && getHighlightedText ? (
          <span
            dangerouslySetInnerHTML={{ __html: getHighlightedText(children) }}
          />
        ) : (
          children
        )}
      </Tag>
    );
  };

  Component.displayName = Tag;
  return Component;
};

const getComponents = (
  getHighlightedText?: (text: string) => string,
): Components => ({
  h1: createMarkdownComponent(
    'h1',
    'mb-4 text-xl font-semibold',
    getHighlightedText,
  ),
  h2: createMarkdownComponent(
    'h2',
    'mb-2 text-lg font-semibold',
    getHighlightedText,
  ),
  h3: createMarkdownComponent(
    'h3',
    'mb-2 text-base font-semibold',
    getHighlightedText,
  ),
  p: createMarkdownComponent('p', 'mb-2', getHighlightedText),
  ul: createMarkdownComponent(
    'ul',
    'mb-element-margin list-disc space-y-2 pl-6',
  ),
  ol: createMarkdownComponent(
    'ol',
    'mb-element-margin list-decimal space-y-2 pl-6',
  ),
  li: createMarkdownComponent('li', 'leading-5'),
  code: createMarkdownComponent('code', '', getHighlightedText),
  hr: () => <hr className="border-border my-6 border-t" />,
  strong: createMarkdownComponent('strong', 'font-bold', getHighlightedText),
});
const plugins = [remarkGfm];

const RenderMarkdown = ({ content, getHighlightedText }: Props) => {
  const formattedContent = useMemo(() => {
    if (!content) return null;
    return content.replace(/<hr\s*\/?>/gi, '\n').replace(/\\n/gi, '\n');
  }, [content]);

  if (!formattedContent) return null;

  return (
    <ReactMarkdown
      remarkPlugins={plugins}
      components={getComponents(getHighlightedText)}
    >
      {formattedContent}
    </ReactMarkdown>
  );
};

export default RenderMarkdown;
