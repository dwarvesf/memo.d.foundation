import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get site URL from environment or use default
const SITE_URL = process.env.SITE_URL || 'https://memo.d.foundation';
const SITE_TITLE = 'Dwarves Memo';
const SITE_DESCRIPTION = 'Knowledge sharing platform for Dwarves Foundation';
const OUTPUT_DIR = path.join(__dirname, '../out');

/**
 * Gets all markdown files recursively from a directory
 */
function getAllMarkdownFiles(dir, basePath = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const paths = [];

  // Check for readme.md first, then _index.md in the current directory
  const readmeFilePath = path.join(dir, 'readme.md');
  const indexFilePath = path.join(dir, '_index.md');

  // Prioritize readme.md over _index.md
  if (fs.existsSync(readmeFilePath) && basePath.length > 0) {
    // If readme.md exists, add the current directory as a path
    paths.push([...basePath]);
  } else if (fs.existsSync(indexFilePath) && basePath.length > 0) {
    // If _index.md exists but readme.md doesn't, add the current directory as a path
    paths.push([...basePath]);
  }

  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      paths.push(...getAllMarkdownFiles(res, [...basePath, entry.name]));
    } else if (
      entry.name.endsWith('.md') &&
      entry.name !== '_index.md' &&
      entry.name !== 'readme.md'
    ) {
      // Skip _index.md and readme.md as they're already handled above
      // Remove .md extension for the slug
      const slugName = entry.name.replace(/\.md$/, '');
      paths.push([...basePath, slugName]);
    }
  }

  return paths;
}

/**
 * Reads and parses markdown content from a file
 */
function getMarkdownContent(filePath) {
  // Read the markdown file
  const markdownContent = fs.readFileSync(filePath, 'utf-8');

  // Parse frontmatter and content
  const frontmatterMatch = markdownContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  
  if (!frontmatterMatch) {
    return {
      frontmatter: {},
      content: markdownContent
    };
  }
  
  const frontmatterStr = frontmatterMatch[1];
  const content = frontmatterMatch[2];
  
  // Parse frontmatter
  const frontmatter = {};
  frontmatterStr.split('\n').forEach(line => {
    try {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // Handle arrays
        if (value.startsWith('[') && value.endsWith(']')) {
          value = value.slice(1, -1).split(',').map(v => v.trim());
        }
        
        // Handle dates safely
        if (key === 'date' || key === 'lastmod') {
          // Try to parse the date to ensure it's valid
          try {
            if (value) { // Only try to parse if value exists and is not empty
              new Date(value).toISOString();
            } else {
              value = null; // Set explicit null for empty values
            }
          } catch (e) {
            // Silently set invalid dates to null without warning
            value = null; // Set to null so we can use the current date later
          }
        }
        
        frontmatter[key] = value;
      }
    } catch (error) {
      console.warn(`Error parsing frontmatter line: ${line}`, error);
    }
  });
  
  return {
    frontmatter,
    content
  };
}

/**
 * Helper function to escape XML special characters
 */
function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generates RSS feeds in multiple formats (RSS, Atom)
 */
async function generateRSSFeeds() {
  console.log('Generating RSS feeds...');
  
  // Get all markdown files
  const contentDir = path.join(__dirname, '../public/content');
  const allSlugs = getAllMarkdownFiles(contentDir);
  
  // Process content for all files
  const items = allSlugs.map(slug => {
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
      const { frontmatter, content } = getMarkdownContent(filePath);
      
      // Skip if the post is marked as draft
      if (frontmatter.draft === true) {
        return null;
      }

      // Create URL
      const url = `${SITE_URL}/${slug.join('/')}`;
      
      // Extract date with error handling
      let pubDate;
      try {
        pubDate = frontmatter.date 
          ? new Date(frontmatter.date).toISOString()
          : new Date().toISOString();
      } catch (error) {
        // Silently use current date without warning
        pubDate = new Date().toISOString();
      }
      
      let modDate;
      try {
        modDate = frontmatter.lastmod
          ? new Date(frontmatter.lastmod).toISOString()
          : pubDate;
      } catch (error) {
        // Silently use pubDate without warning
        modDate = pubDate;
      }
      
      // Create description/excerpt
      const excerpt = content
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
        author: Array.isArray(frontmatter.authors) ? frontmatter.authors[0] : 'Dwarves Foundation',
      };
    } catch (error) {
      console.error(`Error processing file for RSS: ${slug.join('/')}`, error);
      return null;
    }
  });

  // Filter out null items
  const validItems = items.filter(item => item !== null);
  
  // Generate RSS XML
  generateAndSaveRSSFeeds(validItems);
  
  console.log('RSS feeds generated successfully!');
}

/**
 * Generate and save RSS feeds in multiple formats
 */
function generateAndSaveRSSFeeds(items) {
  // Filter out any items with invalid dates
  items = items.filter(item => {
    try {
      new Date(item.pubDate).toISOString();
      new Date(item.modDate).toISOString();
      return true;
    } catch (error) {
      // Silently skip without warning
      return false;
    }
  });

  // Sort by date (newest first)
  items.sort((a, b) => {
    try {
      return new Date(b.pubDate) - new Date(a.pubDate);
    } catch (error) {
      return 0; // Keep original order if dates can't be compared
    }
  });
  
  // Generate RSS XML
  const rssXml = generateRSSXml(items);
  const atomXml = generateAtomXml(items);
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Write to common RSS file paths
  const rssOutputPaths = [
    path.join(OUTPUT_DIR, 'feed.xml'),
    path.join(OUTPUT_DIR, 'rss.xml'),
    path.join(OUTPUT_DIR, 'index.xml')
  ];
  
  const atomOutputPaths = [
    path.join(OUTPUT_DIR, 'atom.xml')
  ];
  
  // Create feed directory
  const rssDir = path.join(OUTPUT_DIR, 'feed');
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
function generateRSSXml(items) {
  // Current date for lastBuildDate
  const lastBuildDate = new Date().toUTCString();
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:wfw="http://wellformedweb.org/CommentAPI/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:sy="http://purl.org/rss/1.0/modules/syndication/" xmlns:slash="http://purl.org/rss/1.0/modules/slash/">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
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
function generateAtomXml(items) {
  // Current date for updated
  const updated = new Date().toISOString();
  
  let xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(SITE_TITLE)}</title>
  <link href="${SITE_URL}/atom.xml" rel="self" type="application/atom+xml" />
  <link href="${SITE_URL}" rel="alternate" type="text/html" />
  <updated>${updated}</updated>
  <id>${SITE_URL}/</id>
  <subtitle>${escapeXml(SITE_DESCRIPTION)}</subtitle>
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

// Run the RSS generator
generateRSSFeeds().catch(error => {
  console.error('Error generating RSS feeds:', error);
  process.exit(1);
});