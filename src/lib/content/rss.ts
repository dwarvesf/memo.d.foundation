import fs from 'fs';
import path from 'path';
import { getAllMarkdownFiles } from './paths';
import { getMarkdownContent } from './markdown';

// Define types for RSS feed items
interface RSSItem {
  title: string;
  url: string;
  pubDate: string;
  modDate: string;
  description: string;
  content: string;
  author: string;
}

/**
 * Generates RSS feeds in multiple formats (RSS, Atom, etc.)
 * @param siteUrl Base URL of the site (e.g., https://memo.d.foundation)
 * @param title Site title
 * @param description Site description
 * @param outputDir Directory to write RSS files to
 */
export async function generateRSSFeeds(
  siteUrl: string,
  title: string,
  description: string,
  outputDir: string = 'public',
) {
  // Get all markdown files
  const contentDir = path.join(process.cwd(), 'public/content');
  const allSlugs = await getAllMarkdownFiles(contentDir);

  // Fetch and process content for all files
  const items = await Promise.all(
    allSlugs.map(async slug => {
      try {
        // Try multiple file path options to support Hugo's _index.md convention
        let filePath = path.join(contentDir, ...slug) + '.md';

        // If the direct path doesn't exist, check if there's an _index.md or readme.md file in the directory
        if (!fs.existsSync(filePath)) {
          const indexFilePath = path.join(contentDir, ...slug, '_index.md');
          const readmeFilePath = path.join(contentDir, ...slug, 'readme.md');

          if (fs.existsSync(readmeFilePath)) {
            // Prioritize readme.md if it exists
            filePath = readmeFilePath;
          } else if (fs.existsSync(indexFilePath)) {
            filePath = indexFilePath;
          } else {
            return null;
          }
        }

        // Get content and frontmatter
        const { frontmatter, content } = await getMarkdownContent(filePath);

        // Skip if the post is marked as draft
        if (frontmatter.draft === true) {
          return null;
        }

        // Skip if title or date is missing
        if (!frontmatter.title || !frontmatter.date) {
          return null;
        }

        // Create URL
        const url = `${siteUrl}/${slug.join('/')}`;

        // Extract date
        const pubDate = frontmatter.date
          ? new Date(frontmatter.date).toISOString()
          : new Date().toISOString();

        const modDate = frontmatter.lastmod
          ? new Date(frontmatter.lastmod).toISOString()
          : pubDate;

        // Create description/excerpt
        const excerpt =
          content
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .substring(0, 280) // Limit to 280 chars
            .trim() + '...';

        return {
          title: frontmatter.title || slug[slug.length - 1],
          url,
          pubDate,
          modDate,
          description: frontmatter.description || excerpt,
          content,
          author: frontmatter.authors?.[0] || 'Dwarves Foundation',
        };
      } catch (error) {
        console.error(
          `Error processing file for RSS: ${slug.join('/')}`,
          error,
        );
        return null;
      }
    }),
  );

  // Filter out null items and apply type assertion
  const validItems = items.filter((item): item is RSSItem => item !== null);

  // Generate RSS XML
  const rssXml = generateRSSXml(title, description, siteUrl, validItems);
  const atomXml = generateAtomXml(title, description, siteUrl, validItems);

  // Write to files
  const rssOutputPaths = [
    path.join(outputDir, 'feed.xml'),
    path.join(outputDir, 'rss.xml'),
    path.join(outputDir, 'index.xml'),
  ];

  const atomOutputPaths = [path.join(outputDir, 'atom.xml')];

  // Create directories if they don't exist
  const rssDir = path.join(outputDir, 'feed');
  const rssIndexPath = path.join(rssDir, 'index.xml');

  if (!fs.existsSync(rssDir)) {
    fs.mkdirSync(rssDir, { recursive: true });
  }

  // Write RSS XML files
  rssOutputPaths.forEach(filePath => {
    fs.writeFileSync(filePath, rssXml);
    console.log(`Generated RSS feed: ${filePath}`);
  });

  // Also write to /feed/index.xml
  fs.writeFileSync(rssIndexPath, rssXml);
  console.log(`Generated RSS feed: ${rssIndexPath}`);

  // Write Atom XML files
  atomOutputPaths.forEach(filePath => {
    fs.writeFileSync(filePath, atomXml);
    console.log(`Generated Atom feed: ${filePath}`);
  });
}

/**
 * Generates RSS 2.0 XML format
 */
function generateRSSXml(
  title: string,
  description: string,
  siteUrl: string,
  items: RSSItem[],
): string {
  // Current date for lastBuildDate
  const lastBuildDate = new Date().toUTCString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:wfw="http://wellformedweb.org/CommentAPI/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:sy="http://purl.org/rss/1.0/modules/syndication/" xmlns:slash="http://purl.org/rss/1.0/modules/slash/">
  <channel>
    <title>${escapeXml(title)}</title>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
    <link>${siteUrl}</link>
    <description>${escapeXml(description)}</description>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <language>en-US</language>
    <sy:updatePeriod>hourly</sy:updatePeriod>
    <sy:updateFrequency>1</sy:updateFrequency>
`;

  // Add items
  items.forEach(item => {
    xml += `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.url}</link>
      <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>
      <dc:creator><![CDATA[${item.author}]]></dc:creator>
      <description><![CDATA[${item.description}]]></description>
      <content:encoded><![CDATA[${item.content}]]></content:encoded>
      <guid isPermaLink="true">${item.url}</guid>
    </item>
`;
  });

  xml += `  </channel>
</rss>`;

  return xml;
}

/**
 * Generates Atom 1.0 XML format
 */
function generateAtomXml(
  title: string,
  description: string,
  siteUrl: string,
  items: RSSItem[],
): string {
  // Current date for updated
  const updated = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(title)}</title>
  <link href="${siteUrl}/atom.xml" rel="self" type="application/atom+xml" />
  <link href="${siteUrl}" rel="alternate" type="text/html" />
  <updated>${updated}</updated>
  <id>${siteUrl}/</id>
  <subtitle>${escapeXml(description)}</subtitle>
`;

  // Add entries
  items.forEach(item => {
    xml += `  <entry>
    <title>${escapeXml(item.title)}</title>
    <link href="${item.url}" rel="alternate" type="text/html" title="${escapeXml(item.title)}" />
    <published>${item.pubDate}</published>
    <updated>${item.modDate}</updated>
    <id>${item.url}</id>
    <author>
      <name>${item.author}</name>
    </author>
    <summary type="html"><![CDATA[${item.description}]]></summary>
    <content type="html"><![CDATA[${item.content}]]></content>
  </entry>
`;
  });

  xml += `</feed>`;

  return xml;
}

/**
 * Helper function to escape XML special characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
