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
    characterCount?: number;
    blocksCount?: number;
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
  // tableOfContents not used in component body
  backlinks = [],
  hideFrontmatter = false,
  hideTitle = false,
}) => {
  return (
    <>
      {/* Title with Hugo styling */}
      {!hideTitle && title && (
        <div className={`note-title ${hideFrontmatter ? 'clear-title' : ''}`}>
          <div className="title-index" style={{ display: 'none' }}>{title}</div>
          {metadata?.tags && (
            <div className="tags-index" style={{ display: 'none' }}>
              tags: {metadata.tags.join(', ')}
            </div>
          )}
          <h1 className="pagetitle">{title}</h1>
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
      )}
      
      {/* Main content */}
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
              className="memo-tag"
            >
              #{tag.replaceAll('-', ' ')}
            </Link>
          ))}
        </div>
      )}
      
      {/* Backlinks - using Hugo styling */}
      {backlinks.length > 0 && (
        <div className="backlinks">
          <h2>Backlinks</h2>
          <ul>
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
      
      {/* Table of Contents and Metadata are rendered in the right sidebar via the RootLayout */}
      {/* This will be injected into the pagenav area by the parent component */}
      {!hideFrontmatter && metadata && (
        <div id="metadata-content" className="hidden">
          <div className="metadata">
            <hr />
            <div className="stats">
              <div>Properties</div>
              <ul className="reading-properties">
                {metadata.created && (
                  <li>
                    <span>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><g fill="currentColor"><path d="M5.25 12a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H6a.75.75 0 0 1-.75-.75zM6 13.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75V14a.75.75 0 0 0-.75-.75zM7.25 12a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H8a.75.75 0 0 1-.75-.75zM8 13.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75V14a.75.75 0 0 0-.75-.75zM9.25 10a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H10a.75.75 0 0 1-.75-.75zm.75 1.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75V12a.75.75 0 0 0-.75-.75zM9.25 14a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H10a.75.75 0 0 1-.75-.75zM12 9.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75V10a.75.75 0 0 0-.75-.75zM11.25 12a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H12a.75.75 0 0 1-.75-.75zm.75 1.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75V14a.75.75 0 0 0-.75-.75zM13.25 10a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H14a.75.75 0 0 1-.75-.75zm.75 1.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75V12a.75.75 0 0 0-.75-.75z"/><path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2m-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25z" clipRule="evenodd"/></g></svg>
                      Created:
                    </span>
                    {metadata.created}
                  </li>
                )}
                
                {metadata.updated && metadata.updated !== metadata.created && (
                  <li>
                    <span>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><g fill="currentColor"><path d="M5.25 12a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H6a.75.75 0 0 1-.75-.75zM6 13.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75V14a.75.75 0 0 0-.75-.75zM7.25 12a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H8a.75.75 0 0 1-.75-.75zM8 13.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75V14a.75.75 0 0 0-.75-.75zM9.25 10a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H10a.75.75 0 0 1-.75-.75zm.75 1.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75V12a.75.75 0 0 0-.75-.75zM9.25 14a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H10a.75.75 0 0 1-.75-.75zM12 9.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75V10a.75.75 0 0 0-.75-.75zM11.25 12a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H12a.75.75 0 0 1-.75-.75zm.75 1.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75V14a.75.75 0 0 0-.75-.75zM13.25 10a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H14a.75.75 0 0 1-.75-.75zm.75 1.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75V12a.75.75 0 0 0-.75-.75z"/><path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2m-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25z" clipRule="evenodd"/></g></svg>
                      Updated:
                    </span>
                    {metadata.updated}
                  </li>
                )}
                
                {metadata.author && (
                  <li>
                    <span>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653m-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438M15.75 9a3.75 3.75 0 1 1-7.5 0a3.75 3.75 0 0 1 7.5 0" clipRule="evenodd"/></svg>
                      Author:
                    </span>
                    <Link href={`/contributor/${metadata.author}`}>
                      {metadata.author}
                    </Link>
                  </li>
                )}
                
                {metadata.coAuthors && metadata.coAuthors.length > 0 && (
                  <li>
                    <span>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653m-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438M15.75 9a3.75 3.75 0 1 1-7.5 0a3.75 3.75 0 0 1 7.5 0" clipRule="evenodd"/></svg>
                      Co-author:
                    </span>
                    {metadata.coAuthors.map((author, idx) => (
                      <React.Fragment key={idx}>
                        <Link href={`/contributor/${author}`}>
                          {author}
                        </Link>
                        {idx < metadata.coAuthors!.length - 1 && ', '}
                      </React.Fragment>
                    ))}
                  </li>
                )}
                
                {metadata.tags && metadata.tags.length > 0 && (
                  <li className="tags">
                    <span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" fillRule="evenodd" d="M5.25 2.25a3 3 0 0 0-3 3v4.318a3 3 0 0 0 .879 2.121l9.58 9.581c.92.92 2.39 1.186 3.548.428a18.849 18.849 0 0 0 5.441-5.44c.758-1.16.492-2.629-.428-3.548l-9.58-9.581a3 3 0 0 0-2.122-.879zM6.375 7.5a1.125 1.125 0 1 0 0-2.25a1.125 1.125 0 0 0 0 2.25" clipRule="evenodd"/></svg>
                      Tags:
                    </span>
                    {metadata.tags.slice(0, 3).map((tag, idx) => (
                      <React.Fragment key={idx}>
                        <Link href={`/tags/${tag.toLowerCase()}`} className="memo-tag">
                          {tag.replaceAll('-', ' ')}
                        </Link>
                        {idx < Math.min(metadata.tags!.length, 3) - 1 && ' '}
                      </React.Fragment>
                    ))}
                  </li>
                )}
              </ul>
              
              {metadata.folder && (
                <>
                  <div>Location</div>
                  <ul className="reading-location">
                    <li>
                      <span>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44"/></svg>
                        Folder:
                      </span>
                      {metadata.folder}
                    </li>
                  </ul>
                </>
              )}
              
              <div>Stats</div>
              <ul className="reading-stats">
                {metadata.wordCount && (
                  <li className="span">
                    <span>Words:</span>
                    {metadata.wordCount.toLocaleString()}
                  </li>
                )}
                
                {metadata.characterCount && (
                  <li className="span">
                    <span>Characters:</span>
                    {metadata.characterCount.toLocaleString()}
                  </li>
                )}
                
                {metadata.blocksCount && (
                  <li className="span">
                    <span>Blocks:</span>
                    {metadata.blocksCount.toLocaleString()}
                  </li>
                )}
                
                {metadata.readingTime && (
                  <li className="span">
                    <span>Est reading Time:</span>
                    {metadata.readingTime}
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ContentLayout;