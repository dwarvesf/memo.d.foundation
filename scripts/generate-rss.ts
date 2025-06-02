import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const SITE_URL = process.env.SITE_URL || 'https://memo.d.foundation';
const SITE_TITLE = 'Dwarves Memo';
const SITE_DESCRIPTION = 'Knowledge sharing platform for Dwarves Foundation';

const CONTENT_DIR = path.join(__dirname, '../public/content');
const OUTPUT_DIR = path.join(__dirname, '../out');

const RSS_TARGET_FILES = ['feed', 'rss', 'index']; // Basenames for RSS 2.0 files
const ATOM_TARGET_FILES = ['atom']; // Basenames for Atom 1.0 files

const FEED_LIMITS = {
  MIN: 10, // Minimum number of items for limited feeds
  MAX: 100, // Maximum number of items for limited feeds
  STEP: 5, // Step for generating different limited feed sizes
};

const RSS_LIMIT_VARIANTS = (() => {
  const variants = [];
  for (let i = FEED_LIMITS.MIN; i <= FEED_LIMITS.MAX; i += FEED_LIMITS.STEP) {
    variants.push(i);
  }
  return variants;
})();

// --- Types ---
type Frontmatter = {
  title?: string | string[];
  date?: string;
  lastmod?: string;
  description?: string | string[];
  authors?: string[] | string;
  draft?: boolean | string;
  [key: string]: any; // Allow other frontmatter fields
};

type RSSItem = {
  title: string | string[];
  url: string;
  pubDate: string; // ISO string
  modDate: string; // ISO string
  description: string | string[];
  content: string;
  author: string;
};

// --- Utility Functions ---

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function validateDateInput(
  dateInput: string | undefined | null,
): string {
  if (!dateInput) {
    return '';
  }
  try {
    const date = new Date(String(dateInput));
    if (isNaN(date.getTime())) {
      return '';
    }
    return dateInput; // Return the original input if it's a valid date
  } catch (e) {
    return '';
  }
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatXmlTextField(fieldValue: string | string[] | undefined): string {
  if (Array.isArray(fieldValue)) {
    return fieldValue
      .filter(Boolean)
      .map(t => escapeXml(String(t)))
      .join(', ');
  }
  return escapeXml(String(fieldValue || ''));
}


/**
 * Gets all markdown file slugs recursively from a directory.
 * A slug is an array of path segments.
 */
async function getAllMarkdownSlugs(dir: string, basePath: string[] = []): Promise<string[][]> {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const paths: string[][] = [];

  // Check for readme.md first, then _index.md in the current directory
  const readmeFilePath = path.join(dir, 'readme.md');
  const indexFilePath = path.join(dir, '_index.md');

  const readmeExists = await fileExists(readmeFilePath);
  const indexExists = await fileExists(indexFilePath);

  // Prioritize readme.md over _index.md for directory representation
  if (readmeExists && basePath.length > 0) {
    paths.push([...basePath]);
  } else if (indexExists && basePath.length > 0) {
    paths.push([...basePath]);
  }

  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      paths.push(...await getAllMarkdownSlugs(res, [...basePath, entry.name]));
    } else if (
      entry.name.endsWith('.md') &&
      entry.name !== '_index.md' &&
      entry.name !== 'readme.md'
    ) {
      // Skip _index.md and readme.md as they're handled above for directory slugs
      // Remove .md extension for the file slug
      const slugName = entry.name.replace(/\.md$/, '');
      paths.push([...basePath, slugName]);
    }
  }

  return paths;
}

/**
 * Reads and parses markdown content from a file path.
 * Attempts to find the correct file path based on slug (supports _index.md and readme.md).
 */
async function getMarkdownContent(
  slug: string[],
): Promise<{ frontmatter: Frontmatter; content: string } | null> {
  const possiblePaths = [
    path.join(CONTENT_DIR, ...slug) + '.md', // Standard file
    path.join(CONTENT_DIR, ...slug, 'readme.md'), // readme.md
    path.join(CONTENT_DIR, ...slug, '_index.md'), // Hugo _index.md
  ];

  let filePath: string | undefined;
  for (const p of possiblePaths) {
    if (await fileExists(p)) {
      filePath = p;
      break;
    }
  }

  if (!filePath) {
    console.warn(`Could not find markdown file for slug: ${slug.join('/')}`);
    return null;
  }

  try {
    const markdownContent = await fsp.readFile(filePath, 'utf-8');
    const frontmatterMatch = markdownContent.match(
      /^---\n([\s\S]*?)\n---\n([\s\S]*)$/,
    );

    if (!frontmatterMatch) {
      return { frontmatter: {}, content: markdownContent };
    }

    const frontmatterStr = frontmatterMatch[1];
    const content = frontmatterMatch[2];

    const frontmatter: Frontmatter = {};
    frontmatterStr.split('\n').forEach(line => {
      try {
        const match = line.match(/^([^:]+):\s*(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value: any = match[2].trim();

          // Attempt to parse JSON values (arrays, booleans, numbers)
          try {
            value = JSON.parse(value);
          } catch (e) {
            // Not JSON, keep as string
          }

          frontmatter[key] = value;
        }
      } catch (error) {
        console.warn(`Error parsing frontmatter line: ${line}`, error);
      }
    });

    return { frontmatter, content };
  } catch (error) {
    console.error(`Error reading or parsing file ${filePath}:`, error);
    return null;
  }
}

/**
 * Creates an RSSItem object from a markdown slug.
 */
async function createRSSItemFromSlug(slug: string[]): Promise<RSSItem | null> {
  const contentData = await getMarkdownContent(slug);
  if (!contentData) return null;

  const { frontmatter, content } = contentData;

  // Skip if the post is marked as draft
  if (
    frontmatter.draft === true ||
    String(frontmatter.draft).toLowerCase() === 'true'
  ) {
    return null;
  }

  const url = `${SITE_URL}/${slug.join('/')}`;
  const pubDate = validateDateInput(frontmatter.date);
  const modDate = validateDateInput(frontmatter.lastmod) ?? pubDate; // Fallback to pubDate if lastmod is invalid

  // Ensure pubDate is valid
  if (!pubDate) {
    return null;
  }

  // Create description/excerpt
  const excerpt =
    content
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .substring(0, 280) // Limit to 280 chars
      .trim() + '...';

  const author = Array.isArray(frontmatter.authors)
    ? frontmatter.authors[0] || 'Dwarves Foundation'
    : frontmatter.authors || 'Dwarves Foundation';

  return {
    title: frontmatter.title || slug[slug.length - 1],
    url,
    pubDate,
    modDate,
    description: frontmatter.description || excerpt,
    content,
    author,
  };
}

/**
 * Generates RSS 2.0 XML format.
 */
function generateRSSXml(items: RSSItem[]): string {
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

  items.forEach(item => {
    xml += `    <item>
      <title>${formatXmlTextField(item.title)}</title>
      <link>${item.url}</link>
      <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>
      <dc:creator><![CDATA[${item.author}]]></dc:creator>
      <description><![CDATA[${formatXmlTextField(item.description)}]]></description>
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
 * Generates Atom 1.0 XML format.
 */
function generateAtomXml(items: RSSItem[]): string {
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

  items.forEach(item => {
    xml += `  <entry>
    <title>${formatXmlTextField(item.title)}</title>
    <link href="${item.url}" rel="alternate" type="text/html" title="${formatXmlTextField(item.title)}" />
    <published>${item.pubDate}</published>
    <updated>${item.modDate}</updated>
    <id>${item.url}</id>
    <author>
      <name>${item.author}</name>
    </author>
    <summary type="html"><![CDATA[${formatXmlTextField(item.description)}]]></summary>
    <content type="html"><![CDATA[${item.content}]]></content>
  </entry>
`;
  });

  xml += `</feed>`;

  return xml;
}

/**
 * Gets the output filename for a feed based on base name and optional limit.
 */
function getFeedOutputFilename(baseName: string, limit?: number): string {
  return limit ? `${baseName}_${limit}.xml` : `${baseName}.xml`;
}

/**
 * Generates and saves RSS and Atom feeds for a given list of items and an optional limit.
 */
async function generateAndSaveFeed(items: RSSItem[], limit?: number): Promise<void> {
  const limitedItems = limit ? items.slice(0, limit) : items;

  const rssXml = generateRSSXml(limitedItems);
  const atomXml = generateAtomXml(limitedItems);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    await fsp.mkdir(OUTPUT_DIR, { recursive: true });
  }

  // Write RSS files
  for (const baseName of RSS_TARGET_FILES) {
    const filePath = path.join(
      OUTPUT_DIR,
      getFeedOutputFilename(baseName, limit),
    );
    await fsp.writeFile(filePath, rssXml);
  }


  // Write Atom files
  for (const baseName of ATOM_TARGET_FILES) {
    const filePath = path.join(
      OUTPUT_DIR,
      getFeedOutputFilename(baseName, limit),
    );
    await fsp.writeFile(filePath, atomXml);
  }

  console.log(`Generated feeds with limit ${limit ?? 'none'}.`);
}

/**
 * Main function to generate all RSS and Atom feeds.
 */
async function main() {
  console.log('Starting RSS feed generation...');

  // Get all markdown slugs
  const allSlugs = await getAllMarkdownSlugs(CONTENT_DIR);

  // Create RSS items from slugs
  const items = (await Promise.all(allSlugs.map(slug => createRSSItemFromSlug(slug))))
    .filter((item): item is RSSItem => item !== null); // Filter out null items and assert type

  // Sort items by date (newest first)
  const sortedItems = items.sort((a, b) => {
    try {
      return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
    } catch (error) {
      console.warn(
        `Error comparing dates for items: ${a.url}, ${b.url}`,
        error,
      );
      return 0; // Keep original order if dates can't be compared
    }
  });

  // Generate feeds for all limit variants
  for (const limit of RSS_LIMIT_VARIANTS) {
    await generateAndSaveFeed(sortedItems, limit);
  }

  // Generate the default feed without limit
  await generateAndSaveFeed(sortedItems, undefined);

  console.log('RSS feed generation completed successfully!');
}

// Run the main function
main().catch(error => {
  console.error('Error during RSS feed generation:', error);
  process.exit(1);
});
