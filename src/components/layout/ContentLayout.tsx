import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { cn, uppercaseSpecialWords } from '@/lib/utils';
import katex from 'katex';
import { IBackLinkItem, IMetadata } from '@/types';
import SummaryBlock from '../memo/SummaryBlock';
import PageTableOfContents from './PageTableOfContents';
import { ITocItem } from '@/types';
import ShareButton from '@/components/ShareButton'; // Import the new ShareButton component

import { EyeIcon, TagIcon, Calendar1Icon, UserIcon } from 'lucide-react';
import { formatDate } from 'date-fns';

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
        <div className="flex-start flex justify-between space-x-2">
          <h1 className="mt-0 mb-5 pb-0 font-serif text-3xl leading-[1.2em] font-semibold tracking-tight md:text-[35px]">
            {formattedTitle}
          </h1>

          <ShareButton className="mt-2" metadata={metadata} />
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-4 border-b pb-8 xl:hidden">
        {metadata?.author && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <UserIcon className="h-4 w-4" />
            <Link
              href={`/contributor/${metadata?.author.toLocaleLowerCase()}`}
              className="hover:text-primary underline"
            >
              {metadata?.author}
            </Link>
          </div>
        )}

        {metadata?.created && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Calendar1Icon className="h-4 w-4" />
            <span>
              {formatDate(metadata?.created as string, 'MMM dd, yyyy')}
            </span>
          </div>
        )}

        {metadata?.pageViewCount && (
          <li className="text-muted-foreground flex items-center gap-2 text-sm">
            <EyeIcon className="h-4 w-4" />
            <span>{metadata?.pageViewCount.toLocaleString()}</span>
          </li>
        )}
      </div>

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

      {metadata?.tags && metadata?.tags.length > 0 && (
        <div className="mt-10 flex flex-wrap items-center gap-2 border-t pt-6 xl:hidden">
          <div className="flex items-center space-x-1">
            <TagIcon className="h-3.5 w-3.5" />
            <span>Tags:</span>
          </div>
          {metadata?.tags.slice(0, 3).map((tag, index) => (
            <Link
              key={index}
              href={`/tags/${tag.toLowerCase().replace(/\s+/g, '-')}`}
              className="bg-muted hover:bg-muted/80 hover:text-primary dark:bg-border dark:text-foreground dark:hover:text-primary inline-flex items-center rounded-md px-1.5 py-0.5 text-sm font-medium text-[#4b4f53]"
            >
              {uppercaseSpecialWords(tag)}
            </Link>
          ))}
        </div>
      )}

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
