import { uppercaseSpecialWords } from '@/lib/utils';
import { formatContentPath } from '@/lib/utils/path-utils';
import { IMemoItem } from '@/types';
import { formatDate } from 'date-fns';
import Link from 'next/link';

interface Props {
  data: IMemoItem[];
  title: string;
}

const MemoTimelineList = (props: Props) => {
  const { data = [], title } = props;
  return (
    <div>
      {title && (
        <h3 className="!m-0 !mt-0 !mb-2" style={{ marginTop: '0!important' }}>
          #{uppercaseSpecialWords(title)}
        </h3>
      )}
      {data.map(memo => {
        return (
          <div key={memo.filePath} className="flex">
            <span className="text-muted-foreground font-ibm-sans mr-5 w-20 tabular-nums">
              {formatDate(memo.date, 'dd.MM.yyyy')}
            </span>
            <Link
              href={formatContentPath(memo.filePath || '')}
              className="font-medium !no-underline hover:!underline"
            >
              {uppercaseSpecialWords(memo.short_title || memo.title)}
            </Link>
          </div>
        );
      })}
    </div>
  );
};

export default MemoTimelineList;
