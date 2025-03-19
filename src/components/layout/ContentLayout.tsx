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
  backlinks = [],
  hideFrontmatter = false,
  hideTitle = false,
}) => {
  return (
    <div className="memo-content">
      {/* Hidden metadata for search engines */}
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

      {/* Main content with prose styling */}
      <div className="prose dark:prose-invert max-w-none article-content">
        {children}
      </div>

      {/* Tags */}
      {metadata?.tags && metadata.tags.length > 0 && (
        <div className="tags-container">
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

      {/* Backlinks section (matching Hugo styling) */}
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

      {/* Metadata for sidebar - direct rendering instead of DOM manipulation */}
      {!hideFrontmatter && metadata && (
        <div id="sidebar-metadata">
          <div className="metadata">
            <hr />
            <div className="stats">
              <div>Properties</div>
              <ul className="reading-properties">
                {metadata.created && (
                  <li>
                    <span>
                      <svg width="16" height="16" viewBox="0 0 20 20"><path d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2z" fill="currentColor" />
                      </svg>
                      Created:
                    </span>
                    {metadata.created}
                  </li>
                )}

                {metadata.updated && metadata.updated !== metadata.created && (
                  <li>
                    <span>
                      <svg width="16" height="16" viewBox="0 0 20 20"><path d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2z" fill="currentColor" />
                      </svg>
                      Updated:
                    </span>
                    {metadata.updated}
                  </li>
                )}

                {metadata.author && (
                  <li>
                    <span>
                      <svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="currentColor" />
                      </svg>
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
                      <svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="currentColor" />
                      </svg>
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
                      <svg width="16" height="16" viewBox="0 0 24 24"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" fill="currentColor" />
                      </svg>
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
                        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" fill="currentColor" />
                        </svg>
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
    </div>
  );
};

export default ContentLayout;
