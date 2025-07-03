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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Share2Icon,
  CopyIcon,
  ChevronDownIcon,
  // Printer,
  LinkIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import EmailIcon from './icons/social/EmailIcon';
import XIcon from './icons/social/XIcon';
import FacebookIcon from './icons/social/FacebookIcon';
import LinkedinIcon from './icons/social/LinkedinIcon';
import { toast } from 'sonner';

interface Props {
  className?: string;
  pageTitle: string;
}

const ShareButton = (props: Props) => {
  const { className, pageTitle } = props;

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
    <Dialog>
      <div className={cn('inline-flex', className)} role="group">
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-2 rounded-r-none text-sm shadow-none"
            size="sm"
          >
            <Share2Icon className="text-muted-foreground !h-4 !w-4" />
            Share
          </Button>
        </DialogTrigger>
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

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Share this page</DialogTitle>
          <DialogDescription>
            Choose how you want to share this page.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Button variant="outline" className="h-auto justify-start" asChild>
            <a
              href={`https://x.com/intent/tweet?url=${encodeURIComponent(
                pageUrl,
              )}&text=${encodeURIComponent(pageTitle)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <XIcon className="mr-2 !h-7 !w-7" />
              Share to X
            </a>
          </Button>
          <Button variant="outline" className="h-auto justify-start" asChild>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                pageUrl,
              )}&quote=${encodeURIComponent(pageTitle)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FacebookIcon className="mr-2 !h-7 !w-7" />
              Share to Facebook
            </a>
          </Button>
          <Button variant="outline" className="h-auto justify-start" asChild>
            <a
              href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(
                pageUrl,
              )}&title=${encodeURIComponent(pageTitle)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <LinkedinIcon className="mr-2 !h-7 !w-7" />
              Share to LinkedIn
            </a>
          </Button>
          <Button variant="outline" className="h-auto justify-start" asChild>
            <a
              href={`mailto:?subject=${encodeURIComponent(
                pageTitle,
              )}&body=${encodeURIComponent(`Check out this page: ${pageUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <EmailIcon className="mr-2 !h-7 !w-7" />
              Share to Email
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareButton;
