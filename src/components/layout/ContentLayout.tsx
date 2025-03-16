import React from 'react';
import Link from 'next/link';

interface ContentLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  metadata?: {
    created?: string;
    updated?: string;
    author?: string;
    coAuthors?: string[];
    tags?: string[];
    folder?: string;
    wordCount?: number;
    readingTime?: string;
  };
  tableOfContents?: string;
  backlinks?: Array<{
    title: string;
    url: string;
  }>;
  hideFrontmatter?: boolean;
  hideTitle?: boolean;
}

const ContentLayout: React.FC<ContentLayoutProps> = ({
  children,
  title,
  description,
  metadata,
  tableOfContents,
  backlinks = [],
  hideFrontmatter = false,
  hideTitle = false,
}) => {
  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Main content area */}
      <div className="flex-1 min-w-0">
        {!hideTitle && title && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">{title}</h1>
            {description && <p className="text-muted-foreground">{description}</p>}
          </div>
        )}
        
        {/* The main content */}
        <div className="prose dark:prose-invert max-w-none">
          {children}
        </div>
        
        {/* Tags */}
        {metadata?.tags && metadata.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {metadata.tags.map((tag) => (
              <Link 
                key={tag} 
                href={`/tags/${tag.toLowerCase()}`}
                className="inline-block px-3 py-1 text-sm rounded-full bg-muted hover:bg-muted/80 transition-colors"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}
        
        {/* Backlinks */}
        {backlinks.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold mb-4">Backlinks</h2>
            <ul className="space-y-2">
              {backlinks.map((link, index) => (
                <li key={index}>
                  <Link 
                    href={link.url}
                    className="text-primary hover:underline"
                  >
                    {link.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* Sidebar with TOC and metadata */}
      <div className="w-full lg:w-64 shrink-0 order-first lg:order-last">
        <div className="lg:sticky lg:top-8 space-y-8">
          {/* Table of Contents */}
          {tableOfContents && (
            <div className="p-4 rounded-lg border">
              <h3 className="text-sm font-medium mb-3">On this page</h3>
              <div 
                className="text-sm text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: tableOfContents }} 
              />
            </div>
          )}
          
          {/* Metadata */}
          {metadata && !hideFrontmatter && (
            <div className="p-4 rounded-lg border">
              <h3 className="text-sm font-medium mb-3">Metadata</h3>
              <dl className="space-y-2 text-sm">
                {metadata.created && (
                  <div>
                    <dt className="inline font-medium mr-1">Created:</dt>
                    <dd className="inline text-muted-foreground">{metadata.created}</dd>
                  </div>
                )}
                
                {metadata.updated && (
                  <div>
                    <dt className="inline font-medium mr-1">Updated:</dt>
                    <dd className="inline text-muted-foreground">{metadata.updated}</dd>
                  </div>
                )}
                
                {metadata.author && (
                  <div>
                    <dt className="inline font-medium mr-1">Author:</dt>
                    <dd className="inline text-muted-foreground">
                      <Link href={`/contributor/${metadata.author}`} className="text-primary hover:underline">
                        {metadata.author}
                      </Link>
                    </dd>
                  </div>
                )}
                
                {metadata.wordCount && (
                  <div>
                    <dt className="inline font-medium mr-1">Words:</dt>
                    <dd className="inline text-muted-foreground">{metadata.wordCount}</dd>
                  </div>
                )}
                
                {metadata.readingTime && (
                  <div>
                    <dt className="inline font-medium mr-1">Reading time:</dt>
                    <dd className="inline text-muted-foreground">{metadata.readingTime}</dd>
                  </div>
                )}
                
                {metadata.folder && (
                  <div>
                    <dt className="inline font-medium mr-1">Folder:</dt>
                    <dd className="inline text-muted-foreground">{metadata.folder}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContentLayout;