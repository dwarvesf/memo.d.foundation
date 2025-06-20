import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import katex from 'katex';
import { IBackLinkItem, IMetadata } from '@/types';
import SummaryBlock from '../memo/SummaryBlock';
import PageTableOfContents from './PageTableOfContents';
import { ITocItem } from '@/types';

interface ContentLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  image?: string;
  metadata?: IMetadata;
  tableOfContents?: ITocItem[];
  backlinks?: IBackLinkItem[];
  hideFrontmatter?: boolean;
  hideTitle?: boolean;
}

const ContentLayout: React.FC<ContentLayoutProps> = ({
  children,
  title = 'Untitled',
  metadata,
  tableOfContents,
  backlinks = [],
  hideTitle = false,
}) => {
  const isTagPage = (metadata?.folder || '').includes('/tags/');
  const formattedTitle = isTagPage ? `#${title.replace(/-/g, ' ')}` : title;

  const mathContainerRef = useRef<HTMLDivElement | null>(null);

  // Function to render LaTeX math using KaTeX

  useEffect(() => {
    const renderMath = () => {
      if (mathContainerRef.current) {
        const mathElements = mathContainerRef.current.querySelectorAll(
          '.language-math',
        ) as NodeListOf<HTMLElement>;
        mathElements?.forEach(element => {
          const mathContent = element.textContent || element.innerText;
          try {
            // Render inline math (e.g., $...$)
            katex.render(mathContent, element, {
              throwOnError: false, // Prevents errors from being thrown for invalid LaTeX
              displayMode: element.classList.contains('math-display'), // Determine if block math
            });
          } catch (e) {
            console.error('KaTeX rendering error:', e);
          }
        });
      }
    };
    renderMath();
  }, [metadata]);

  return (
    <div className="content-layout xl:m-h-[400px]">
      {/* Title section */}
      {!hideTitle && (
        <div className="flex flex-col items-start justify-between md:flex-row">
          {/* Hidden metadata for search engines */}
          <div className="hidden">{title}</div>
          {metadata?.tags && (
            <div className="hidden">tags: {metadata.tags.join(', ')}</div>
          )}

          <div className="flex-1">
            <h1 className="mt-0 mb-5 pb-0 font-serif text-[35px] leading-[42px] font-semibold tracking-tight">
              {formattedTitle}
            </h1>
          </div>
        </div>
      )}

      {/* Main content with prose styling */}
      <SummaryBlock summary={metadata?.summary}></SummaryBlock>
      {tableOfContents && tableOfContents.length > 0 && (
        <PageTableOfContents items={tableOfContents} />
      )}
      <div
        ref={mathContainerRef}
        className={cn(
          'prose dark:prose-dark prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight max-w-none font-serif',
          'prose-a:text-primary prose-a:underline prose-a:decoration-link-decoration prose-a:hover:text-primary prose-a:hover:decoration-primary prose-a:font-[inherit]',
          'prose-table:border prose-img:mt-[var(--element-margin)]',
        )}
      >
        {children}
      </div>

      {/* Backlinks section */}
      {backlinks.length > 0 && (
        <div className="mentionin border-border mt-12 border-t pt-6">
          <h6 className="font-ibm-sans mb-2 text-[10px] font-medium uppercase">
            Mentioned in
          </h6>
          <ul className="mt-[5px] mb-[10px] flex list-none flex-col gap-1.5 pl-0 font-serif">
            {backlinks.map((link, index) => (
              <li key={index} className="p-0 text-base">
                <Link
                  href={link.path}
                  className="hover:text-primary hover:decoration-primary decoration-link-decoration underline hover:underline"
                >
                  📄 {link.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ContentLayout;
