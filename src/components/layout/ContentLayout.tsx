import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import katex from 'katex';
import { IBackLinkItem } from '@/types';
interface ContentLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  image?: string;
  metadata?: {
    created?: string;
    updated?: string;
    author?: string;
    coAuthors?: string[];
    tags?: string[];
    folder?: string;
    wordCount?: number;
    readingTime?: string;
    characterCount?: number;
    blocksCount?: number;
  };
  tableOfContents?: string;
  backlinks?: IBackLinkItem[];
  hideFrontmatter?: boolean;
  hideTitle?: boolean;
}

const ContentLayout: React.FC<ContentLayoutProps> = ({
  children,
  title = 'Untitled',
  metadata,
  backlinks = [],
  hideFrontmatter = false,
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
    <div className="content-layout">
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

          {/* Tags in flexbox layout */}
          {metadata?.tags && metadata.tags.length > 0 && !hideFrontmatter && (
            <div className="mt-2 flex flex-wrap gap-1.5 md:mt-0 md:ml-4">
              {metadata.tags.map(tag => (
                <Link
                  key={tag}
                  href={`/tags/${tag?.toLowerCase()}`}
                  className="bg-tag text-foreground inline-flex h-fit items-center justify-center rounded-[50px] px-[0.5rem] py-[0.125rem] text-xs leading-[1.125rem] font-medium no-underline"
                >
                  {tag?.replaceAll('-', ' ')}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main content with prose styling */}
      <div
        ref={mathContainerRef}
        className={cn(
          'prose dark:prose-dark prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight prose-headings:leading-[1.24] max-w-none font-serif',
          'prose-a:text-foreground prose-a:underline prose-a:decoration-neutral-200 prose-a:hover:text-primary prose-a:hover:decoration-primary prose-a:font-[inherit]',
          'prose-table:border',
        )}
      >
        {children}
      </div>

      {/* Backlinks section */}
      {backlinks.length > 0 && (
        <div className="mentionin border-border mt-12 border-t pt-6">
          <h6 className="mb-0 font-sans text-[10px] font-medium uppercase">
            Mentioned in
          </h6>
          <ul className="mt-[5px] mb-[10px] flex list-none flex-col gap-1.5 pl-0 font-serif">
            {backlinks.map((link, index) => (
              <li key={index} className="p-0 text-base">
                <Link
                  href={link.path}
                  className="hover:text-primary no-underline hover:underline"
                >
                  📄 {link.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Metadata for sidebar - this will be picked up by Javascript and moved to the right place */}
      {!hideFrontmatter && metadata && (
        <div className="metadata hidden">
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">
            Properties
          </h3>
          <ul className="space-y-2 text-sm">
            {metadata.created && (
              <li className="flex items-center gap-2">
                <svg
                  className="text-muted-foreground h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-muted-foreground">Created:</span>
                <span>{metadata.created}</span>
              </li>
            )}

            {metadata.updated && metadata.updated !== metadata.created && (
              <li className="flex items-center gap-2">
                <svg
                  className="text-muted-foreground h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-muted-foreground">Updated:</span>
                <span>{metadata.updated}</span>
              </li>
            )}

            {metadata.author && (
              <li className="flex items-center gap-2">
                <svg
                  className="text-muted-foreground h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653zm-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438M15.75 9a3.75 3.75 0 1 1-7.5 0a3.75 3.75 0 0 1 7.5 0"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-muted-foreground">Author:</span>
                <a
                  href={`/contributor/${metadata.author}`}
                  className="text-primary hover:underline"
                >
                  {metadata.author}
                </a>
              </li>
            )}

            {metadata.coAuthors && metadata.coAuthors.length > 0 && (
              <li className="flex items-center gap-2">
                <svg
                  className="text-muted-foreground h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653zm-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438M15.75 9a3.75 3.75 0 1 1-7.5 0a3.75 3.75 0 0 1 7.5 0"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-muted-foreground">Co-author:</span>
                <div className="flex flex-wrap gap-1">
                  {metadata.coAuthors.map((author, index) => (
                    <a
                      key={index}
                      href={`/contributor/${author}`}
                      className="text-primary hover:underline"
                    >
                      {author}
                      {index < metadata.coAuthors!.length - 1 ? ', ' : ''}
                    </a>
                  ))}
                </div>
              </li>
            )}

            {metadata.tags && metadata.tags.length > 0 && (
              <li className="flex items-start gap-2">
                <svg
                  className="text-muted-foreground mt-0.5 h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.25 2.25a3 3 0 0 0-3 3v4.318a3 3 0 0 0 .879 2.121l9.58 9.581c.92.92 2.39 1.186 3.548.428a18.849 18.849 0 0 0 5.441-5.44c.758-1.16.492-2.629-.428-3.548l-9.58-9.581a3 3 0 0 0-2.122-.879z"
                    clipRule="evenodd"
                  />
                  <path d="M6.375 7.5a1.125 1.125 0 1 0 0-2.25a1.125 1.125 0 0 0 0 2.25z" />
                </svg>
                <span className="text-muted-foreground mt-0.5">Tags:</span>
                <div className="flex flex-wrap gap-1">
                  {metadata.tags.slice(0, 3).map((tag, index) => (
                    <a
                      key={index}
                      href={`/tags/${tag}`}
                      className="bg-muted text-muted-foreground hover:bg-muted/80 inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
                    >
                      {tag?.replace(/-/g, ' ')}
                    </a>
                  ))}
                </div>
              </li>
            )}

            {metadata.folder && (
              <li className="flex items-center gap-2">
                <svg
                  className="text-muted-foreground h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44" />
                </svg>
                <span className="text-muted-foreground">Folder:</span>
                <a
                  href={`/${metadata.folder}`}
                  className="text-primary hover:underline"
                >
                  {metadata.folder}
                </a>
              </li>
            )}
          </ul>

          {(metadata.wordCount ||
            metadata.characterCount ||
            metadata.blocksCount ||
            metadata.readingTime) && (
            <>
              <h3 className="text-muted-foreground mt-6 mb-2 text-sm font-medium">
                Stats
              </h3>
              <ul className="space-y-2 text-sm">
                {metadata.wordCount && (
                  <li className="flex items-center gap-2">
                    <span className="text-muted-foreground">Words:</span>
                    <span>{metadata.wordCount.toLocaleString()}</span>
                  </li>
                )}

                {metadata.characterCount && (
                  <li className="flex items-center gap-2">
                    <span className="text-muted-foreground">Characters:</span>
                    <span>{metadata.characterCount.toLocaleString()}</span>
                  </li>
                )}

                {metadata.blocksCount && (
                  <li className="flex items-center gap-2">
                    <span className="text-muted-foreground">Blocks:</span>
                    <span>{metadata.blocksCount.toLocaleString()}</span>
                  </li>
                )}

                {metadata.readingTime && (
                  <li className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      Est. reading time:
                    </span>
                    <span>{metadata.readingTime}</span>
                  </li>
                )}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ContentLayout;
