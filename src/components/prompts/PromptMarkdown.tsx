import React, { useMemo } from 'react';
import ReactMarkdown, { Components, ExtraProps } from 'react-markdown';
import type { ComponentPropsWithoutRef } from 'react';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { promptMarkdownStyles } from './styles';
import { cn } from '@/lib/utils';
import { promptMDParser } from '@/lib/utils/prompt-parser';

interface PromptMarkdownProps {
  content: string;
}

type CodeProps = ComponentPropsWithoutRef<'code'> & { inline?: boolean };

const plugins = [remarkGfm];
const hypePlugins = [rehypeHighlight];

// Define a common type for component props
type CommonProps = {
  children?: React.ReactNode;
  className?: string;
} & ExtraProps;

function getParsedMDContent(children: React.ReactNode) {
  const parsedMd = promptMDParser(children);
  return parsedMd.map((part, index) =>
    part.type === 'text' ? (
      <>{part.content}</>
    ) : (
      <span key={index} className={promptMarkdownStyles.template}>
        {part.content}
      </span>
    ),
  );
}

// Generic helper function to create components with optional custom rendering
const createMarkdownComponent = (
  Tag: keyof React.JSX.IntrinsicElements,
  customRender?: (props: CommonProps) => React.ReactElement | null,
) => {
  const Component = (props: CommonProps) => {
    if (customRender) {
      return customRender(props);
    }

    const { children, className } = props;
    return (
      <Tag className={cn(promptMarkdownStyles.textDefaultColor, className)}>
        {getParsedMDContent(children)}
      </Tag>
    );
  };

  Component.displayName = Tag;
  return Component;
};

const PromptMarkdownComponents: Components = {
  pre: createMarkdownComponent('pre', ({ children }) => (
    <pre className={promptMarkdownStyles.codeBlock.pre}>{children}</pre>
  )),
  code: createMarkdownComponent(
    'code',
    ({ inline, children }: CodeProps & ExtraProps) => {
      if (inline) {
        return (
          <code className={promptMarkdownStyles.inlineCode}>{children}</code>
        );
      }

      return (
        <code className={promptMarkdownStyles.codeBlock.code}>{children}</code>
      );
    },
  ),

  // Use the generic helper function for all other components
  span: createMarkdownComponent('span'),
  p: createMarkdownComponent('p'),
  ul: createMarkdownComponent('ul'),
  ol: createMarkdownComponent('ol'),
  li: createMarkdownComponent('li'),
  blockquote: createMarkdownComponent('blockquote'),
  h1: createMarkdownComponent('h1'),
  h2: createMarkdownComponent('h2'),
  h3: createMarkdownComponent('h3'),
  h4: createMarkdownComponent('h4'),
  h5: createMarkdownComponent('h5'),
  h6: createMarkdownComponent('h6'),
  a: createMarkdownComponent('a'),
  img: createMarkdownComponent('img'),
  strong: createMarkdownComponent('strong'),
  em: createMarkdownComponent('em'),
  del: createMarkdownComponent('del'),
  th: createMarkdownComponent('th'),
  td: createMarkdownComponent('td'),
  details: createMarkdownComponent('details'),
  summary: createMarkdownComponent('summary'),
  mark: createMarkdownComponent('mark'),
  time: createMarkdownComponent('time'),
  kbd: createMarkdownComponent('kbd'),
  sub: createMarkdownComponent('sub'),
  sup: createMarkdownComponent('sup'),
  div: createMarkdownComponent('div'),
};

const PromptMarkdown: React.FC<PromptMarkdownProps> = ({ content }) => {
  // Memoize the markdown component to prevent unnecessary re-renders
  const markdown = useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={plugins}
        rehypePlugins={hypePlugins}
        components={PromptMarkdownComponents}
      >
        {content}
      </ReactMarkdown>
    ),
    [content],
  );

  return markdown;
};

export default PromptMarkdown;
