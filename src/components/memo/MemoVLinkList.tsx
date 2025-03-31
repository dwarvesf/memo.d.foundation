import { IMemoItem } from '@/types';
import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatMemoPath } from './utils';
import { formatDate } from 'date-fns';

interface Props {
  data: IMemoItem[];
  className?: string;
  id?: string;
  hideDate?: boolean;
  color?: 'primary' | 'secondary';
}

const MemoVLinkList = ({
  data = [],
  className,
  id = 'changelog',
  hideDate,
  color = 'primary',
}: Props) => {
  return (
    <div
      id={id}
      className={cn('link-v-list mt-2.5 flex flex-col gap-1.5', className)}
      data-placement="vertical"
    >
      {data.map((memo, index) => {
        const path = formatMemoPath(memo.filePath);
        return (
          <div
            id={`memo-${index + 1}`}
            key={memo.filePath}
            className="link-v-list-item flex items-center"
          >
            <Link
              href={path}
              className={cn(
                'link-v-list-item-title hover:text-primary hover:decoration-primary text-[17px] underline decoration-neutral-100',
                {
                  'text-primary decoration-primary': color === 'primary',
                },
              )}
            >
              {memo.short_title || memo.title}
            </Link>

            {!hideDate && memo.date && (
              <span className="link-v-list-item-time text-secondary-foreground font-ibm-sans ml-1 text-sm font-normal">
                {' - '}
                {formatDate(new Date(memo.date), 'MMMM dd, yyyy')}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MemoVLinkList;
