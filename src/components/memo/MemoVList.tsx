import { IMemoItem } from '@/types';
import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatMemoPath, getFirstMemoImage } from './utils';
import { formatDate } from 'date-fns';

interface Props {
  data: IMemoItem[];
  className?: string;
  hideThumbnail?: boolean;
  hideAuthors?: boolean;
  hideDate?: boolean;
}

const MemoVList = (props: Props) => {
  const { data = [], className, hideThumbnail, hideAuthors, hideDate } = props;
  return (
    <div className={cn('v-list', className)} data-placement="vertical">
      {data.map((memo, index) => {
        const imgSrc = hideThumbnail ? null : getFirstMemoImage(memo);
        const path = formatMemoPath(memo.filePath);
        return (
          <div
            id={`memo-${index + 1}`}
            key={memo.filePath}
            className={cn(
              'v-list-item xs:flex-row flex w-full flex-col not-last:border-b',
              !imgSrc && 'no-image first:*:pt-0',
            )}
          >
            {imgSrc && (
              <div className="v-list-item-image xs:w-3/10 xs:pb-3 xs:pr-6 pt-3 pb-0">
                <img
                  className="no-zoom h-[130px] w-full rounded-sm object-cover"
                  src={imgSrc}
                  alt={`Cover image for ${memo.title}`}
                  height={130}
                  loading="lazy"
                />
              </div>
            )}

            <div className={cn('flex flex-1 flex-col gap-1 py-3')}>
              <Link
                href={path}
                className="hover:text-primary hover:decoration-primary mt-0 text-[17px] font-semibold underline decoration-neutral-100"
              >
                {memo.short_title || memo.title}
              </Link>

              <div className="text-foreground line-clamp-2 text-sm font-normal">
                {memo.description}
              </div>

              {!hideAuthors && memo.authors && memo.authors.length > 0 && (
                <div className="dark:text-secondary-light font-ibm-sans text-sm font-normal">
                  {memo.authors.map((author, i) => (
                    <React.Fragment key={author}>
                      <Link
                        className="text-secondary-foreground hover:text-primary underline"
                        href={`/contributor/${author}`}
                      >
                        {author}
                      </Link>
                      {i < (memo.authors?.length ?? 0) - 1 && ', '}
                    </React.Fragment>
                  ))}
                </div>
              )}
              {!hideDate && memo.date && (
                <div className="text-secondary-foreground dark:text-secondary-light font-ibm-sans mt-1 text-sm font-normal">
                  {formatDate(memo.date, 'MMMM dd, yyyy')}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MemoVList;
