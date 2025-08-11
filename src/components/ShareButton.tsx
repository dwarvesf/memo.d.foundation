'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown';
import {
  Share2Icon,
  CopyIcon,
  ChevronDownIcon,
  // Printer,
  LinkIcon,
  PrinterIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLayoutContext } from '@/contexts/layout';
import { IMetadata } from '@/types';
import { createPrintableMarkdown } from '@/lib/content/markdown-printer';
import { plausible } from '@/analytics/plausible';

interface Props {
  className?: string;
  metadata?: IMetadata;
}

const ShareButton = (props: Props) => {
  const { className, metadata } = props;
  const { setIsShareDialogOpen } = useLayoutContext();

  const getPageUrl = () => {
    if (typeof window === 'undefined') {
      return '';
    }

    return (window?._memo_frontmatter?.redirect || [])
      .map(link => {
        return window.location.protocol + '//' + window.location.host + link;
      })
      .reduce((a, c) => {
        if (c.length < a.length) {
          return c;
        }
        return a;
      }, window.location.href);
  };

  const copyLinktoClipboard = async () => {
    try {
      await navigator.clipboard.writeText(getPageUrl());
      plausible.trackShare('memo_link_copied', getPageUrl(), {
        title: metadata?.title || 'Untitled Memo',
      });
      toast.success('Copied memo link!');
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const copyMemoContent = async () => {
    try {
      const memoContent = document.querySelector(
        '.memo-content',
      ) as HTMLElement;
      let content = 'No content found';
      if (memoContent) {
        content =
          memoContent.textContent ||
          memoContent.innerHTML ||
          ''.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
      }
      navigator.clipboard.writeText(content);

      plausible.trackShare('memo_content_copied', getPageUrl(), {
        title: metadata?.title || 'Untitled Memo',
      });
      toast.success('Copied memo content!');
    } catch (error) {
      console.error('Failed to copy memo content:', error);
    }
  };

  return (
    <div className={cn('inline-flex', className)} role="group">
      {/* Desktop: Show full button with text */}
      <div className="hidden sm:flex">
        <Button
          variant="outline"
          className="flex items-center gap-2 rounded-r-none text-sm shadow-none"
          size="sm"
          onClick={() => setIsShareDialogOpen(true)}
        >
          <Share2Icon className="text-muted-foreground !h-4 !w-4" />
          Share
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="!w-8 min-w-auto rounded-l-none border-l-0 shadow-none"
            >
              <ChevronDownIcon className="text-muted-foreground !h-4 !w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => copyMemoContent()}
            >
              <CopyIcon className="mr-2 h-4 w-4" />
              <span>Copy page</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => copyLinktoClipboard()}
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              <span>Copy link</span>
            </DropdownMenuItem>
            {metadata?.sprContent ? (
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() =>
                  createPrintableMarkdown(
                    {
                      title: metadata.title,
                      spr_content: metadata.sprContent!,
                    },
                    getPageUrl,
                  )
                }
              >
                <PrinterIcon className="mr-2 h-4 w-4" />
                <span>Print lesson</span>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile: Icon-only dropdown with all share options */}
      <div className="flex sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="!w-8 min-w-auto shadow-none"
              aria-label="Share options"
            >
              <Share2Icon className="text-muted-foreground !h-4 !w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => setIsShareDialogOpen(true)}
            >
              <Share2Icon className="mr-2 h-4 w-4" />
              <span>Share</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => copyMemoContent()}
            >
              <CopyIcon className="mr-2 h-4 w-4" />
              <span>Copy page</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => copyLinktoClipboard()}
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              <span>Copy link</span>
            </DropdownMenuItem>
            {metadata?.sprContent ? (
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() =>
                  createPrintableMarkdown(
                    {
                      title: metadata.title,
                      spr_content: metadata.sprContent!,
                    },
                    getPageUrl,
                  )
                }
              >
                <PrinterIcon className="mr-2 h-4 w-4" />
                <span>Print lesson</span>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default ShareButton;
