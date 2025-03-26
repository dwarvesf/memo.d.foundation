import { cn } from '@/lib/utils';
import { IMetadata } from '@/types';
import React from 'react';
import { formatDate } from 'date-fns';
import {
  CalendarDaysIcon,
  CircleUserRoundIcon,
  FolderIcon,
  TagIcon,
} from 'lucide-react';

interface Props {
  metadata?: IMetadata;
}

const RightSidebar = (props: Props) => {
  const { metadata } = props;
  return (
    <div
      className={cn(
        'right-sidebar leading-[140% hidden w-[200px] text-sm font-medium xl:flex 2xl:w-[240px]',
        'transition-[transform,opacity] duration-100 ease-in-out',
        'w-0 translate-x-0 transform opacity-100 xl:w-[200px]',
        'reading:opacity-0 reading:translate-x-[50px]',
      )}
    >
      <div className="sticky top-[60px] right-0 flex flex-col gap-y-8 pt-3 pb-10 transition-[top] duration-200 ease-in-out">
        {metadata && (
          <div className="metadata space-y-6">
            <div className="">
              <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-[0.8px] uppercase">
                Properties
              </h3>
              <ul className="space-y-2 text-sm">
                {metadata.created && (
                  <li className="text-muted-foreground flex items-center gap-1 text-xs">
                    <CalendarDaysIcon className="h-4 w-4" />
                    <span>Created:</span>
                    <span>{formatDate(metadata.created, 'MMM dd, yyyy')}</span>
                  </li>
                )}

                {metadata.updated && metadata.updated !== metadata.created && (
                  <li className="text-muted-foreground flex items-center gap-1 text-xs">
                    <CalendarDaysIcon className="h-4 w-4" />
                    <span>Updated:</span>
                    <span>{metadata.updated}</span>
                  </li>
                )}

                {metadata.author && (
                  <li className="text-muted-foreground flex items-center gap-1 text-xs">
                    <CircleUserRoundIcon width={16} height={16} />
                    <span>Author:</span>
                    <a
                      href={`/contributor/${metadata.author}`}
                      className="hover:text-primary hover:underline"
                    >
                      {metadata.author}
                    </a>
                  </li>
                )}
                {metadata.coAuthors && metadata.coAuthors.length > 0 && (
                  <li className="text-muted-foreground flex gap-1 text-xs">
                    <CircleUserRoundIcon width={16} height={16} />
                    <span className="text-muted-foreground shrink-0">
                      Co-author:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {metadata.coAuthors.map((author, index) => (
                        <a
                          key={author}
                          href={`/contributor/${author}`}
                          className="hover:text-primary hover:underline"
                        >
                          {author}
                          {index < metadata.coAuthors!.length - 1 ? ', ' : ''}
                        </a>
                      ))}
                    </div>
                  </li>
                )}

                {metadata.tags && metadata.tags.length > 0 && (
                  <li className="text-muted-foreground flex items-start gap-1 text-xs">
                    <TagIcon width={16} height={16} />
                    <span>Tags:</span>
                    <div className="inline-flex flex-wrap gap-1">
                      {metadata.tags.slice(0, 3).map((tag, index) => (
                        <a
                          key={index}
                          href={`/tags/${tag}`}
                          className="bg-muted text-muted-foreground hover:bg-muted/80 hover:text-primary inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium"
                        >
                          {tag.replace(/-/g, ' ')}
                        </a>
                      ))}
                    </div>
                  </li>
                )}
              </ul>
            </div>

            {metadata.folder && (
              <div className="">
                <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-[0.8px] uppercase">
                  Location
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="text-muted-foreground flex gap-1 text-xs">
                    <FolderIcon width={16} height={16} />
                    <span>Folder:</span>
                    <a
                      href={`/${metadata.folder}`}
                      className="hover:text-primary break-all hover:underline"
                    >
                      {metadata.folder}
                    </a>
                  </li>
                </ul>
              </div>
            )}

            {(metadata.wordCount ||
              metadata.characterCount ||
              metadata.blocksCount ||
              metadata.readingTime) && (
              <div className="">
                <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-[0.8px] uppercase">
                  Stats
                </h3>
                <ul className="space-y-2 text-sm">
                  {metadata.wordCount && (
                    <li className="text-muted-foreground flex items-center justify-between gap-1 text-xs">
                      <span>Words:</span>
                      <span>{metadata.wordCount.toLocaleString()}</span>
                    </li>
                  )}

                  {metadata.characterCount && (
                    <li className="text-muted-foreground flex items-center justify-between gap-1 text-xs">
                      <span>Characters:</span>
                      <span>{metadata.characterCount.toLocaleString()}</span>
                    </li>
                  )}

                  {metadata.blocksCount && (
                    <li className="text-muted-foreground flex items-center justify-between gap-1 text-xs">
                      <span>Blocks:</span>
                      <span>{metadata.blocksCount.toLocaleString()}</span>
                    </li>
                  )}

                  {metadata.readingTime && (
                    <li className="text-muted-foreground flex items-center justify-between gap-1 text-xs">
                      <span>Reading time:</span>
                      <span>{metadata.readingTime}</span>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RightSidebar;
