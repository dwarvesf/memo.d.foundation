import { IMemoItem } from '@/types';
import React, { useState } from 'react';
import Link from 'next/link';
import { cn, uppercaseSpecialWords } from '@/lib/utils';
import { getFirstMemoImage } from './utils';
import { formatContentPath } from '@/lib/utils/path-utils';
import { formatDate } from 'date-fns';
import Tag from '../ui/tag';

interface Props {
  data: IMemoItem[];
  className?: string;
  hideThumbnail?: boolean;
  hideAuthors?: boolean;
  hideDate?: boolean;
  showTags?: boolean;
  max?: number;
}

const MemoVList = (props: Props) => {
  const {
    data = [],
    className,
    hideThumbnail,
    hideAuthors,
    hideDate,
    showTags = false,
    max = 999,
  } = props;
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [showAll, setShowAll] = useState(false);

  const displayData = showAll ? data : data.slice(0, max);
  const remainingCount = data.length - max;

  return (
    <>
      <div className={cn('v-list', className)} data-placement="vertical">
        {displayData.map((memo, index) => {
          const imgSrc = hideThumbnail
            ? null
            : memo.image || getFirstMemoImage(memo);
          const path = formatContentPath(memo.filePath || '');
          return (
            <div
              id={`memo-${index + 1}`}
              key={path}
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
                  className="hover:text-primary hover:decoration-primary decoration-link-decoration mt-0 text-[17px] font-semibold underline"
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
                          href={`/contributor/${author.toLocaleLowerCase()}`}
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

                {showTags && memo.tags && memo.tags.length > 0 && (
                  <div className="mt-1">
                    {memo.tags.map(tag => (
                      <Tag
                        key={tag}
                        href={`/tags/${tag}`}
                        className="mr-2 text-xs"
                      >
                        {uppercaseSpecialWords(tag)}
                      </Tag>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!showAll && remainingCount > 0 && (
        <button
          ref={buttonRef}
          className="text-muted-foreground hover:text-foreground mt-4 cursor-pointer underline"
          onClick={() => {
            const mainLayout = document.querySelector('.main-layout');
            if (mainLayout) {
              const currentScroll = buttonRef.current
                ? buttonRef.current.getBoundingClientRect().top +
                  window.scrollY -
                  mainLayout.getBoundingClientRect().top -
                  50
                : 0;

              setShowAll(true);
              setTimeout(() => {
                mainLayout.scrollTo({ top: currentScroll, behavior: 'auto' });
              }, 0);
            } else {
              setShowAll(true);
            }
          }}
          aria-label={`View all ${remainingCount} remaining articles`}
        >
          View all ({remainingCount} more)
        </button>
      )}
    </>
  );
};

export default MemoVList;
