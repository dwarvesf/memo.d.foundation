'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import XIcon from './icons/social/XIcon';
import FacebookIcon from './icons/social/FacebookIcon';
import LinkedinIcon from './icons/social/LinkedinIcon';
import EmailIcon from './icons/social/EmailIcon';
import { plausible } from '@/analytics/plausible';

interface ShareDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const ShareDialog = ({ isOpen, onOpenChange }: ShareDialogProps) => {
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

  const getPageTitle = () => {
    if (typeof document === 'undefined') {
      return 'Check out this page';
    }
    return document.title;
  };

  const handleLogEvent = (event: string) => {
    plausible.trackShare(event, getPageUrl(), {
      title: getPageTitle(),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
                getPageUrl(),
              )}&text=${encodeURIComponent(getPageTitle())}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleLogEvent('memo_shared_to_x')}
            >
              <XIcon className="mr-2 !inline-flex !h-7 !w-7" />
              Share to X
            </a>
          </Button>
          <Button variant="outline" className="h-auto justify-start" asChild>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                getPageUrl(),
              )}&quote=${encodeURIComponent(getPageTitle())}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleLogEvent('memo_shared_to_facebook')}
            >
              <FacebookIcon className="mr-2 !inline-flex !h-7 !w-7" />
              Share to Facebook
            </a>
          </Button>
          <Button variant="outline" className="h-auto justify-start" asChild>
            <a
              href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(
                getPageUrl(),
              )}&title=${encodeURIComponent(getPageTitle())}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleLogEvent('memo_shared_to_linkedin')}
            >
              <LinkedinIcon className="mr-2 !inline-flex !h-7 !w-7" />
              Share to LinkedIn
            </a>
          </Button>
          <Button variant="outline" className="h-auto justify-start" asChild>
            <a
              href={`mailto:?subject=${encodeURIComponent(
                getPageTitle(),
              )}&body=${encodeURIComponent(`Check out this page: ${getPageUrl()}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleLogEvent('memo_shared_to_email')}
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

export default ShareDialog;
