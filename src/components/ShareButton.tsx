'use client';

import React, { useMemo } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLayoutContext } from '@/contexts/layout';

interface Props {
  className?: string;
}

const ShareButton = (props: Props) => {
  const { className } = props;
  const { setIsShareDialogOpen } = useLayoutContext();

  const pageUrl = useMemo(() => {
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
  }, []);

  const copyLinktoClipboard = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
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
      toast.success('Copied memo content!');
    } catch (error) {
      console.error('Failed to copy memo content:', error);
    }
  };

  return (
    <div className={cn('inline-flex', className)} role="group">
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
          {/* <DropdownMenuItem className="cursor-pointer">
              <Printer className="mr-2 h-4 w-4" /> <span>Print cheatsheet</span>
            </DropdownMenuItem> */}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default ShareButton;
