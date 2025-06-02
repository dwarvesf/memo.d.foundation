import { cn } from '@/lib/utils';
import { ITocItem } from '@/types';
import Link from 'next/link';
import React, { useState } from 'react';

interface PageTableOfContentsProps {
  items?: ITocItem[];
}

const getHeadingLevelClass = (level: number) => {
  return `heading-level-${level}`;
};

const PageTableOfContents: React.FC<PageTableOfContentsProps> = ({ items }) => {
  const [isOpen, setIsOpen] = useState(false);

  const renderTocItems = (items: ITocItem[], depth = 0) => {
    const listStyle = depth === 0 ? 'list-disc' : 'list-circle'; // Use list-disc for top level, list-circle for nested
    const paddingLeft = depth === 0 ? 'pl-5' : 'pl-8'; // Adjust padding for indentation

    return (
      <ul className={cn('flex h-full flex-col', listStyle, paddingLeft)}>
        {items.map(item => (
          <li key={item.id} className="w-full leading-6">
            <Link
              href={`#${item.id}`}
              className={cn(
                'text-primary text-[15px] leading-4 underline transition-all duration-150', // Adjusted font size to 15px
                getHeadingLevelClass(item.depth),
              )}
              onClick={e => {
                e.preventDefault();
                document
                  .getElementById(item.id)
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              {item.value}
            </Link>
            {item.children &&
              item.children.length > 0 &&
              renderTocItems(item.children, depth + 1)}
          </li>
        ))}
      </ul>
    );
  };

  if (!items?.length) return null;

  return (
    <div className="page-toc mb-4">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="mb-1 flex cursor-pointer items-center text-base font-semibold"
      >
        <span className="mr-2 w-4 text-sm">{isOpen ? '▼' : '▶'}</span>
        Table of contents
      </div>
      {isOpen && <div>{renderTocItems(items || [])}</div>}
    </div>
  );
};

export default PageTableOfContents;
