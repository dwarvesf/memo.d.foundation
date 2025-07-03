'use client';

import React, { useMemo } from 'react';
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

interface ShareDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const ShareDialog = ({ isOpen, onOpenChange }: ShareDialogProps) => {
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

  const pageTitle = useMemo(() => {
    if (typeof document === 'undefined') {
      return 'Check out this page';
    }
    return document.title;
  }, []);

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

export default ShareDialog;
