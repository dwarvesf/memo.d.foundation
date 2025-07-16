import { formatContentPath } from '@/lib/utils/path-utils';
import { IMemoItem } from '@/types';
import Link from 'next/link';
import BookOpenIcon from '../icons/BookOpenIcon';
import Tag from '../ui/tag';
import { uppercaseSpecialWords } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '../ui/scrollarea';

interface ContributorPinnedMemosProps {
  data: IMemoItem[];
}

function ContributorPinnedMemos({ data }: ContributorPinnedMemosProps) {
  if (data.length === 0) {
    return null;
  }
  return (
    <div className="relative mx-auto mb-10 grid w-full max-w-3xl gap-y-3">
      <span className="px-3.5 text-base md:px-0">Pinned memos</span>
      <ScrollArea>
        <div className="flex auto-rows-auto grid-cols-3 gap-3 overflow-hidden px-3.5 md:grid md:px-0">
          {data.map(memo => {
            return (
              <div
                className="border-border flex w-[calc(100vw-28px)] max-w-[250px] flex-col rounded-lg border px-4 py-3 !no-underline transition md:w-auto"
                key={memo.filePath}
              >
                <div className="flex items-start gap-2">
                  <BookOpenIcon className="w-4 flex-shrink-0" />
                  <Link
                    href={formatContentPath(memo.filePath)}
                    className="m-0 line-clamp-2 text-sm"
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
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

export default ContributorPinnedMemos;
