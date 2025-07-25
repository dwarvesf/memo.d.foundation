import { cn } from '@/lib/utils';
import { ITocItem } from '@/types';
import Link from 'next/link';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import HeadingNavigator from './HeadingNavigator';
import { flattenTocItems } from '@/lib/utils';
import { useAudioEffects } from '@/hooks/useAudioEffects';

interface TableOfContentsProps {
  items?: ITocItem[];
}

const getHeadingLevelClass = (level: number) => {
  return `heading-level-${level}`;
};
const getIndicatorWidth = (depth: number) => {
  return Math.max((6 - depth) * 4, 4);
};

const TableOfContents: React.FC<TableOfContentsProps> = ({ items }) => {
  const [activeId, setActiveId] = useState<string>('');
  const shouldBlockHeadingObserver = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null); // Still needed for blocking observer
  const { playSharpClick, isSoundEnabled } = useAudioEffects();

  const scrollToId = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveId(id);
      shouldBlockHeadingObserver.current = true;
      window.history.pushState(null, '', `#${id}`);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        shouldBlockHeadingObserver.current = false;
      }, 1000);
    }
  }, []);

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
              style={{
                width: `${getIndicatorWidth(item.depth)}px`,
                borderRadius: '2px',
              }}
              className={cn(
                'bg-border hover:bg-border-dark/70 dark:hover:bg-border-light/70 mr-2.5 flex h-0.5 text-transparent transition-all',
                {
                  'bg-border-dark dark:bg-border-light': item.id === activeId,
                },
              )}
              onClick={e => {
                e.preventDefault();
                scrollToId(item.id);
              }}
              onMouseEnter={() => isSoundEnabled && playSharpClick()}
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
                'flex cursor-pointer items-center gap-1 rounded px-2 py-1.25 text-left text-xs leading-normal font-medium transition-all',
                getHeadingLevelClass(item.depth),
                'hover:bg-background-secondary-light hover:dark:bg-background-secondary',
                {
                  'text-muted-foreground': item.id !== activeId,
                  'text-primary': item.id === activeId,
                  'hover:text-foreground': item.id !== activeId,
                },
              )}
              onClick={e => {
                e.preventDefault();
                scrollToId(item.id);
              }}
              onMouseEnter={() => isSoundEnabled && playSharpClick()}
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

    // Check for hash on initial load and set activeId if valid
    const initialHash = window.location.hash.substring(1); // Remove '#'
    if (initialHash && tocIds.has(initialHash)) {
      scrollToId(initialHash);
    } else {
      // Set initial active ID to the first heading if no valid hash or hash not found
      setActiveId(headingElements[0].id);
    }

    // Use Intersection Observer for better performance
    const observerOptions = {
      rootMargin: '-10% 0px -50% 0px',
      threshold: 0.5,
    };

    const headingObserver = new IntersectionObserver(entries => {
      if (shouldBlockHeadingObserver.current) return;
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
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [items, scrollToId]);

  // Hotkey logic
  useHotkeys(
    'g>g',
    () => {
      const mainLayoutNode = document.querySelector('.main-layout');
      mainLayoutNode?.scrollTo({ top: 0, behavior: 'smooth' });
    },
    { enableOnFormTags: true, preventDefault: true, sequenceTimeoutMs: 500 },
    [],
  );

  useHotkeys(
    'shift+g',
    () => {
      const mainLayoutNode = document.querySelector('.main-layout');
      mainLayoutNode?.scrollTo({
        top: mainLayoutNode.scrollHeight,
        behavior: 'smooth',
      });
    },
    { enableOnFormTags: true, preventDefault: true },
    [],
  );

  useHotkeys(
    ']',
    e => {
      if (!items || items.length === 0) return;
      if (e.metaKey || e.ctrlKey) return; // Ignore if meta or ctrl is pressed
      const flattenedItems = flattenTocItems(items);
      const currentIndex = flattenedItems.findIndex(
        item => item.id === activeId,
      );
      if (currentIndex !== -1 && currentIndex < flattenedItems.length - 1) {
        scrollToId(flattenedItems[currentIndex + 1].id);
      }
    },
    { enableOnFormTags: true, useKey: true },
    [items, activeId, scrollToId],
  );

  useHotkeys(
    '[',
    e => {
      if (!items || items.length === 0) return;
      if (e.metaKey || e.ctrlKey) return; // Ignore if meta or ctrl is pressed
      const flattenedItems = flattenTocItems(items);
      const currentIndex = flattenedItems.findIndex(
        item => item.id === activeId,
      );
      if (currentIndex > 0) {
        scrollToId(flattenedItems[currentIndex - 1].id);
      }
    },
    { enableOnFormTags: true, useKey: true },
    [items, activeId, scrollToId],
  );

  if (!items?.length) return null;
  return (
    <>
      <HeadingNavigator items={items} scrollToId={scrollToId} />
      <div className="toc relative z-10 hidden md:block">
        <div className="toc-indicators peer fixed top-[104px] right-0 mr-2 cursor-pointer pr-2 pb-4 pl-5">
          <div className=""> {renderTocIndicators(items || [])}</div>
        </div>
        <div
          className={cn(
            'toc-modal bg-background fixed top-[80px] right-0 mr-6 mb-2 ml-2 rounded-xl',
            'border shadow-[0px_4px_6px_-2px_#10182808,0px_12px_16px_-4px_#10182814]',
            'invisible translate-x-[12px] opacity-0',
            'ease transition-all duration-300',
            'peer-hover:visible peer-hover:translate-x-0 peer-hover:opacity-100',
            'hover:visible hover:translate-x-0 hover:opacity-100',
          )}
        >
          <div className="max-h-[min(680px,calc(100vh-var(--header-height)-68px-32px-2rem))] max-w-[240px] overflow-y-auto p-3">
            {renderTocModalItems(items || [])}
          </div>
        </div>
      </div>
    </>
  );
};

export default TableOfContents;
