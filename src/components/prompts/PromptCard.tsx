import { Prompt } from '@/types';
import React, { useCallback, useState } from 'react';
import PromptMarkdown from './PromptMarkdown';
import { promptCardStyles } from './styles';
import { cn } from '@/lib/utils';
import { CopyIcon } from 'lucide-react';

interface PromptCardProps {
  prompt: Prompt;
}

const PromptCard: React.FC<PromptCardProps> = ({ prompt }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(prompt.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [prompt.prompt]);

  return (
    <div className={promptCardStyles.container}>
      {/* Copy button - positioned absolutely in top-right corner */}
      <button
        className={cn(promptCardStyles.copyButton, {
          'animate__animated animate__pulse': copied,
        })}
        onClick={handleCopy}
        title="Copy prompt"
        aria-label="Copy prompt to clipboard"
      >
        {copied ? (
          'Copied!'
        ) : (
          <CopyIcon width={18} height={18} className="stroke-primary" />
        )}
      </button>

      {/* Content */}
      <div className="flex h-full w-full flex-col">
        {/* Prompt Content */}
        <div className={promptCardStyles.content}>
          <PromptMarkdown content={prompt.prompt} />
        </div>

        {/* Footer */}
        <div className={promptCardStyles.footer}>
          <div className="flex items-center gap-2">
            <span className={promptCardStyles.title}>{prompt.title}</span>
          </div>
          {prompt.models?.length ? (
            <div className="flex items-center gap-2">
              <span className={promptCardStyles.models}>
                {prompt.models.join(', ')}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default React.memo(PromptCard);
