import React from 'react';
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
  XIcon,
  FacebookIcon,
  LinkedinIcon,
  LinkIcon,
  CopyIcon,
  ChevronDownIcon,
  Printer,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

const ShareButton = (props: Props) => {
  const { className } = props;

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
            <DropdownMenuItem>
              <CopyIcon className="mr-2 h-4 w-4" />
              <span>Copy page</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Printer className="mr-2 h-4 w-4" />{' '}
              {/* Using LinkIcon as a placeholder for export cheatsheet */}
              <span>Print cheatsheet</span>
            </DropdownMenuItem>
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
        <div className="grid gap-4 py-4">
          <Button variant="outline" className="justify-start">
            <LinkIcon className="mr-2 h-4 w-4" />
            Copy link
          </Button>
          <Button variant="outline" className="justify-start">
            <XIcon className="mr-2 h-4 w-4" />
            Share to X
          </Button>
          <Button variant="outline" className="justify-start">
            <FacebookIcon className="mr-2 h-4 w-4" />
            Share to Facebook
          </Button>
          <Button variant="outline" className="justify-start">
            <LinkedinIcon className="mr-2 h-4 w-4" />
            Share to LinkedIn
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareButton;
