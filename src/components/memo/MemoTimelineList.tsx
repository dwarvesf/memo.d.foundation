import { uppercaseSpecialWords } from '@/lib/utils';
import { formatContentPath } from '@/lib/utils/path-utils';
import { IMemoItem } from '@/types';
import { formatDate } from 'date-fns';
import Link from 'next/link';
import React from 'react';

interface Props {
  data: IMemoItem[];
  title: string;
}

const MemoTimelineList = (props: Props) => {
  const { data = [], title } = props;
  return (
    <div>
      {title && <h3 className="!mt-6 !mb-4">{title}</h3>}
      {data.map(memo => {
        return (
          <div key={memo.filePath} className="leading-6.5">
            <span className="text-muted-foreground font-ibm-sans mr-5 tabular-nums">
              {formatDate(memo.date, 'dd.MM.yyyy')}
            </span>
            <Link
              href={formatContentPath(memo.filePath || '')}
              className="font-semibold !no-underline hover:!underline"
            >
              {uppercaseSpecialWords(memo.title)}
            </Link>
          </div>
        );
      })}
    </div>
  );
};

export default MemoTimelineList;
