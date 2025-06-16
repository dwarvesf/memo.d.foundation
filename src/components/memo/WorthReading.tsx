import { formatContentPath } from '@/lib/utils/path-utils';
import { BentoCard, BentoGrid } from './bento-grid';
import { BlocksIcon, BookOpenIcon, BrainIcon, SproutIcon } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface BlockProps {
  title: string;
  subtitle: string;
  tag: string;
}

interface WorthReadingProps {
  memos: { title: string; tags: string[]; filePath: string; date: string }[];
  blocks: BlockProps[];
}

const getIconForBlock = (index: number) => {
  const icons = {
    1: BookOpenIcon,
    2: BlocksIcon,
    3: SproutIcon,
    4: BrainIcon,
  };
  return icons[index as keyof typeof icons];
};

const dummyTexts = [
  "You're not supposed to read this",
  'Bruh why are you reading this?',
  'This is a secret',
  "I'm not sure why you're reading this",
];

const WorthReading = ({ blocks, memos }: WorthReadingProps) => {
  return (
    <div className="relative flex flex-col">
      <h2>Worth Reading</h2>
      <BentoGrid>
        {blocks.map((block, index) => {
          const Icon = getIconForBlock(index + 1);
          const isWide = index === 1 || index === 2;

          const data = memos
            .filter(
              memo =>
                memo.tags.includes(block.tag) ||
                memo.tags.includes(block.tag.toLocaleLowerCase()),
            )
            .slice(0, 5);

          return (
            <BentoCard
              key={block.tag}
              name={block.title}
              description={block.subtitle}
              Icon={Icon}
              href={`/tags/${block.tag}`}
              cta="View all"
              className={cn('col-span-1', {
                'sm:col-span-5': isWide,
                'sm:col-span-4': !isWide,
              })}
              background={
                <>
                  <ul className="mt-0 flex list-none flex-col gap-y-1 p-0">
                    {data.map(memo => (
                      <li
                        key={memo.title}
                        className="truncate p-0 whitespace-nowrap"
                      >
                        <Link
                          href={formatContentPath(memo.filePath)}
                          className="hover:text-primary text-sm !no-underline transition-colors before:hidden hover:!no-underline"
                        >
                          {format(memo.date, 'yyyy MMM dd')}: {memo.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <div className="pointer-events-none absolute right-0 bottom-0 flex w-full translate-y-full flex-col gap-y-1 p-6 pt-0 opacity-50 blur">
                    {Array(10)
                      .fill(0)
                      .map(() => {
                        const text =
                          dummyTexts[
                            Math.floor(Math.random() * dummyTexts.length)
                          ];
                        return (
                          <span
                            key={Date.now()}
                            className="text-muted-foreground truncate text-sm whitespace-nowrap"
                          >
                            {new Date().getFullYear()} Jan 12: {text}
                          </span>
                        );
                      })}
                  </div>
                </>
              }
            />
          );
        })}
      </BentoGrid>
    </div>
  );
};

export default WorthReading;
