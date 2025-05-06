import { cn } from '@/lib/utils';
import { ITocItem } from '@/types';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';

interface TableOfContentsProps {
  items?: ITocItem[];
}
const getHeadingLevelClass = (level: number) => {
  return `heading-level-${level}`;
};
const getIndicatorWidth = (depth: number) => {
  return (6 - depth) * 5;
};

const TableOfContents: React.FC<TableOfContentsProps> = ({ items }) => {
  const [activeId, setActiveId] = useState<string>('');
  const isUserClicking = React.useRef(false);
  // Function to render TOC items recursively
  const renderTocIndicators = (items: ITocItem[]) => {
    return (
      <ul className="flex h-full list-none flex-col items-end gap-3 pl-0 text-right">
        {items.map(item => (
          <li
            key={item.id}
            className="flex h-full list-none flex-col items-end gap-3 pl-0 text-right"
          >
            <Link
              href={`#${item.id}`}
              style={{ width: `${getIndicatorWidth(item.depth)}px` }}
              className={cn('bg-border flex h-0.5 text-transparent', {
                'bg-border-dark dark:bg-border-light': item.id === activeId,
              })}
              onClick={e => {
                e.preventDefault();
                const element = document.getElementById(item.id);
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                  setActiveId(item.id);
                }
              }}
            >
              {item.value}
            </Link>
            {item.children &&
              item.children.length > 0 &&
              renderTocIndicators(item.children)}
          </li>
        ))}
      </ul>
    );
  };
  const renderTocModalItems = (items: ITocItem[], depth = 0) => {
    return (
      <ul className="flex h-full list-none flex-col items-end pl-0">
        {items.map(item => (
          <li key={item.id} className="w-full leading-6">
            <Link
              style={{ marginLeft: `${depth * 16}px` }}
              href={`#${item.id}`}
              className={cn(
                'text-foreground flex rounded-lg p-1 text-[13px] leading-4 transition-all duration-150',
                getHeadingLevelClass(item.depth),
                'hover:bg-background-tertiary-light hover:dark:bg-background-tertiary',
                {
                  'text-primary': item.id === activeId,
                },
              )}
              onClick={e => {
                e.preventDefault();
                setActiveId(item.id);
                document
                  .getElementById(item.id)
                  ?.scrollIntoView({ behavior: 'smooth' });
                isUserClicking.current = true;
                setTimeout(() => {
                  isUserClicking.current = false;
                }, 1000);
              }}
            >
              {item.value}
            </Link>
            {item.children &&
              item.children.length > 0 &&
              renderTocModalItems(item.children, depth + 1)}
          </li>
        ))}
      </ul>
    );
  };

  useEffect(() => {
    if (!items || items.length === 0) return;

    // Collect all headings with IDs from TOC items
    const tocIds = new Set<string>();

    function collectIds(items: ITocItem[]) {
      items.forEach(item => {
        tocIds.add(item.id);
        if (item.children && item.children.length > 0) {
          collectIds(item.children);
        }
      });
    }

    collectIds(items);

    // Only select headings that are in our TOC
    const headingElements = Array.from(
      document.querySelectorAll('h2, h3, h4, h5'),
    ).filter(heading => heading.id && tocIds.has(heading.id));

    if (headingElements.length === 0) return;

    // Set initial active ID
    setActiveId(headingElements[0].id);

    // Use Intersection Observer for better performance
    const observerOptions = {
      rootMargin: '-10% 0px -50% 0px',
      threshold: 0.5,
    };

    const headingObserver = new IntersectionObserver(entries => {
      if (isUserClicking.current) return;
      // Get all headings that are currently intersecting
      const visibleHeadings = entries
        .filter(entry => entry.isIntersecting)
        .map(entry => entry.target as HTMLElement);

      if (visibleHeadings.length === 0) return;

      // Use the first visible heading (closest to the top)
      setActiveId(visibleHeadings[0].id);
    }, observerOptions);

    // Observe all heading elements
    headingElements.forEach(heading => {
      headingObserver.observe(heading);
    });

    return () => {
      // Clean up observer when component unmounts
      headingObserver.disconnect();
    };
  }, [items]);

  if (!items?.length) return null;
  return (
    <div className="toc relative z-10 hidden md:block">
      <div className="toc-indicators peer fixed top-[var(--header-height)] right-0 mt-15 cursor-pointer pr-2 pb-4 pl-5">
        <div className=""> {renderTocIndicators(items || [])}</div>
      </div>
      <div
        className={cn(
          'toc-modal bg-background fixed top-[var(--header-height)] right-0 m-2 mt-17 rounded-xl',
          'border shadow-[0px_4px_6px_-2px_#10182808,0px_12px_16px_-4px_#10182814]',
          'invisible translate-x-[12px] opacity-0',
          'ease transition-all duration-300',
          'peer-hover:visible peer-hover:translate-x-0 peer-hover:opacity-100',
          'hover:visible hover:translate-x-0 hover:opacity-100',
        )}
      >
        <div className="max-h-[min(680px,calc(100vh-var(--header-height)-68px-32px-2rem))] max-w-[240px] overflow-y-auto p-4">
          {renderTocModalItems(items || [])}
        </div>
      </div>
    </div>
  );
};

export default TableOfContents;
