import React, { useMemo } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import type { ComponentPropsWithoutRef } from 'react';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { omit } from 'lodash';
import { promptMDParser } from '@/lib/utils/prompt-parser';
import { promptMarkdownStyles } from './styles';
import { cn } from '@/lib/utils';

interface PromptMarkdownProps {
  content: string;
}

type CodeProps = ComponentPropsWithoutRef<'code'> & { inline?: boolean };

const plugins = [remarkGfm];
const hypePlugins = [rehypeHighlight];

const PromptMarkdownComponents: Components = {
  span: ({ children, className }) => {
    if (!className) {
      return <span>{children}</span>;
    }

    return (
      <>
        <span className={cn('hidden group-hover:inline', className)}>
          {children}
        </span>
        <span className={cn('inline group-hover:hidden')}>{children}</span>
      </>
    );
  },

  code: ({ inline, children, ..._props }: CodeProps) => {
    const props = omit(_props, ['inline', 'className', 'children', 'node']);

    if (inline) {
      return (
        <code className={promptMarkdownStyles.inlineCode} {...props}>
          {children}
        </code>
      );
    }

    return (
      <pre className={promptMarkdownStyles.codeBlock.pre}>
        <code className={promptMarkdownStyles.codeBlock.code} {...props}>
          {children}
        </code>
      </pre>
    );
  },

  p: ({ children }) => {
    const textContent = String(children);
    const parts = promptMDParser(textContent);

    return (
      <>
        {parts.map((part, index) => (
          <span
            key={index}
            className={
              part.type === 'variable'
                ? promptMarkdownStyles.template
                : promptMarkdownStyles.text
            }
          >
            {part.content}
          </span>
        ))}
      </>
    );
  },
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
