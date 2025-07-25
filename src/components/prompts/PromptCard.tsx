import type { IPromptItem } from '@/types';
import React, { useCallback, useState } from 'react';
import PromptMarkdown from './PromptMarkdown';
import { promptCardStyles } from './styles';
import { cn } from '@/lib/utils';
import { CopyIcon, CheckIcon, Server } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { categoryIcons } from './CategoriesHeader';
import { plausible } from '@/analytics/plausible';

interface PromptCardProps {
  prompt: IPromptItem;
  category?: string;
}

const PromptCard: React.FC<PromptCardProps> = ({ prompt, category }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    plausible.trackEvent('copy_prompt', {
      props: {
        promptId: prompt.title,
        category,
      },
    });
    navigator.clipboard.writeText(prompt.mdContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [prompt.mdContent]);

  const Icon = categoryIcons[category as keyof typeof categoryIcons];

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
          <CheckIcon width={18} height={18} className="stroke-primary" />
        ) : (
          <CopyIcon width={18} height={18} className="stroke-primary" />
        )}
      </button>

      {/* Content */}
      <div className="flex h-full w-full flex-col">
        {/* Prompt Content */}
        <div className={promptCardStyles.content}>
          <PromptMarkdown content={prompt.mdContent} />
        </div>

        {/* Footer */}
        <div className={promptCardStyles.footer}>
          <div className="flex items-center gap-2">
            <span className={promptCardStyles.title}>
              <Icon className="text-muted-500" size={14} /> {prompt.title}
            </span>
          </div>
          {prompt.models?.length ? (
            <TooltipProvider skipDelayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Server size={16} className={promptCardStyles.models} />
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div>
                    {prompt.models.map(model => (
                      <p key={model}>{model}</p>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default React.memo(PromptCard);
