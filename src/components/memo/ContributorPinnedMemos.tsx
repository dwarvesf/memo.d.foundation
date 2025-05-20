import { formatContentPath } from '@/lib/utils/path-utils';
import { IMemoItem } from '@/types';
import Link from 'next/link';
import BookOpenIcon from '../icons/BookOpenIcon';
import Tag from '../ui/tag';
import { uppercaseSpecialWords } from '@/lib/utils';

interface ContributorPinnedMemosProps {
  data: IMemoItem[];
}

function ContributorPinnedMemos({ data }: ContributorPinnedMemosProps) {
  return (
    <div className="relative mx-auto mb-10 grid w-full max-w-3xl gap-y-3">
      <span className="text-base">Pinned memos</span>
      <div className="grid auto-rows-auto grid-cols-3 gap-3">
        {data.map(memo => {
          return (
            <div
              className="border-border flex flex-col rounded-lg border px-4 py-3 !no-underline transition"
              key={memo.filePath}
            >
              <div className="flex items-start gap-2">
                <BookOpenIcon className="w-4 flex-shrink-0" />
                <Link
                  href={formatContentPath(memo.filePath)}
                  className="m-0 text-sm"
                >
                  {memo.title}
                </Link>
              </div>
              <p className="text-muted-foreground mt-1 mb-10 line-clamp-3 text-sm">
                {memo.description}
              </p>
              {memo.tags?.length && (
                <div className="mt-auto flex flex-wrap gap-1">
                  {memo.tags.map(t => (
                    <Tag className="text-xs" key={t}>
                      {uppercaseSpecialWords(t)}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ContributorPinnedMemos;
