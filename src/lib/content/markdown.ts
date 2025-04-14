import fs from 'fs';
import path from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkMath from 'remark-math';
import matter from 'gray-matter';
import { visit } from 'unist-util-visit';
import type { Heading, Root, Link, Literal } from 'mdast';
import type {
  Element,
  Properties,
  Root as HastRoot,
  Text as HastText,
} from 'hast';
import slugify from 'slugify';
import { ITocItem } from '@/types';
import rehypeHighlight from 'rehype-highlight';
import { getContentPath } from './paths';

// Define interfaces for the AST nodes
interface ImageNode {
  type: 'image';
  url: string;
  title: string | null;
  alt: string | null;
}

interface LinkNode {
  type: 'link';
  url: string;
  title: string | null;
  children: unknown[];
}

interface FileData {
  toc?: ITocItem[];
  headingTextMap?: Map<string, string>;
  blockCount?: number;
  [key: string]: unknown;
}

function preprocessDollarSigns(markdown: string) {
  return markdown.replace(/\$(\d[\d,.]*)/g, '[CURRENCY:$1]');
}

function postprocessDollarSigns(html: string) {
  return html.replace(/\[CURRENCY:([\d,.]*)\]/g, '$$$1');
}

// Function to wrap multi-line LaTeX math blocks

function rehypeTable() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent: Element) => {
      if (node.tagName === 'table' && parent) {
        parent.children[index] = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['table-container'] },
          children: [node],
        };
      }
    });
  };
}
/**
 * Custom remark plugin to extract table of contents
 */
function remarkToc() {
  return (tree: Root, file: { data: Record<string, unknown> }) => {
    const headings: ITocItem[] = [];
    const headingStack: { items: ITocItem[]; depth: number }[] = [
      { items: headings, depth: 1 },
    ];
    const headingTextMap = new Map<string, string>();
    const headingTextCount = new Map<string, number>();
    const fileData = file.data as FileData;

    // Extract headings
    visit(tree, 'heading', (node: Heading) => {
      // Skip h1 headings as they're typically the title
      if (node.depth < 2 || node.depth > 5) return;

      // Process text content of the heading
      let textContent = '';
      visit(node, 'text', textNode => {
        textContent += textNode.value;
      });

      // Generate slug for the heading
      const slug = slugify(textContent, { strict: true, lower: true });
      if (!slug) return;

      const currentCount = headingTextCount.get(textContent) || 0;
      const nextCount = currentCount + 1;

      // Store the mapping for later use
      headingTextMap.set(textContent, slug);
      headingTextCount.set(textContent, nextCount);

      // Create a TOC item
      const item: ITocItem = {
        id: nextCount > 1 ? `${slug}-${nextCount}` : `${slug}`,
        value: textContent,
        depth: node.depth,
        children: [],
      };

      // Pop from stack until we find the appropriate parent level
      while (
        headingStack.length > 1 &&
        headingStack[headingStack.length - 1].depth >= node.depth
      ) {
        headingStack.pop();
      }

      // Add the item to the appropriate parent array
      headingStack[headingStack.length - 1].items.push(item);

      // Push this item's children array to the stack for potential children
      headingStack.push({ items: item.children, depth: node.depth });
    });

    // Store the TOC in the file data
    fileData.toc = headings;
    fileData.headingTextMap = headingTextMap;
  };
}

/**
 * Custom remark plugin to count blocks
 */
function remarkBlockCount() {
  return (tree: Root, file: { data: Record<string, unknown> }) => {
    const fileData = file.data as FileData;

    fileData.blockCount = tree.children.length ?? 0;
  };
}

/**
 * Custom rehype plugin to add IDs to headings
 */
function rehypeAddHeadingIds() {
  return (tree: HastRoot, file: { data: Record<string, unknown> }) => {
    const fileData = file.data as FileData;
    const headingTextMap = fileData.headingTextMap;
    const headingTextCount = new Map<string, number>();

    if (!headingTextMap) return;

    visit(tree, 'element', (node: Element) => {
      if (/^h[2-5]$/.test(node.tagName)) {
        // Extract text content from heading
        let textContent = '';
        visit(node, 'text', (textNode: HastText) => {
          textContent += textNode.value;
        });

        // If we have an ID for this text, add it
        const id = headingTextMap.get(textContent);
        if (id) {
          const currentCount = headingTextCount.get(textContent) || 0;
          const nextCount = currentCount + 1;
          headingTextCount.set(textContent, nextCount);
          node.properties = node.properties || ({} as Properties);
          node.properties.id = nextCount > 1 ? `${id}-${nextCount}` : id;
        }
      }
    });
  };
}

/**
 * Custom remark plugin to resolve relative image paths
 * @param fileDir Directory of the markdown file
 */
function remarkResolveImagePaths(fileDir: string) {
  return (tree: Root) => {
    visit(tree, 'image', node => {
      const imageNode = node as ImageNode;
      // Only process relative URLs (not starting with http://, https://, or /)
      if (!/^(https?:\/\/|\/)/i.test(imageNode.url)) {
        // Get the directory of the markdown file
        const mdFileDir = path.dirname(fileDir);

        // Construct the path to the image relative to the content directory
        const absoluteImagePath = path.resolve(mdFileDir, imageNode.url);

        // Make the path relative to the public directory for serving
        let publicPath = '/' + path.relative(process.cwd(), absoluteImagePath);

        // Remove the 'public' prefix if it exists
        if (publicPath.startsWith('/public/')) {
          publicPath = publicPath.substring(7);
        }

        // Update the URL
        imageNode.url = publicPath;
      }
    });
  };
}

/**
 * Custom remark plugin to process links and remove .md extension from relative links
 */
function remarkProcessLinks() {
  return (tree: Root) => {
    visit(tree, 'link', (node: Link) => {
      const linkNode = node as LinkNode;

      // Only process relative links that end with .md
      if (
        !/^(https?:\/\/|\/)/i.test(linkNode.url) &&
        linkNode.url.endsWith('.md')
      ) {
        // Remove the .md extension
        linkNode.url = linkNode.url.slice(0, -3);
      }
    });
  };
}

/**
 * Custom rehype plugin to process video links
 */
function rehypeVideos() {
  return (tree: HastRoot) => {
    visit(tree, 'element', node => {
      if (node.tagName === 'img') {
        const ext = node.properties?.src?.toString().split('.').pop() || '';
        // if the image is a video
        if (['mp4', 'webm'].includes(ext)) {
          Object.assign(node, {
            tagName: 'video',
            properties: {
              controls: true,
              loop: true,
              className: ['markdown-video'],
              src: node.properties?.src,
            },
            children: [],
          });
        }
      }
    });
  };
}

/**
 * Reads and parses markdown content from a file
 * @param filePath Path to the markdown file
 * @returns Object with frontmatter, processed HTML content, and table of contents
 */
export async function getMarkdownContent(filePath: string) {
  // Read the markdown file
  const markdownContent = fs.readFileSync(filePath, 'utf-8');

  // Parse frontmatter and content
  const { data: frontmatter, content } = matter(markdownContent);

  // Define schema for rehype-sanitize to allow table elements & id attributes
  const schema = {
    tagNames: [
      // Default elements
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'a',
      'img',
      'ul',
      'ol',
      'li',
      'blockquote',
      'hr',
      'em',
      'strong',
      'code',
      'pre',
      'br',
      'del',
      'div',
      'span',
      // Table elements
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'video', // Add video tag
    ],
    attributes: {
      '*': ['id', 'className'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title'],
      th: ['align', 'scope', 'colspan', 'rowspan'],
      td: ['align', 'colspan', 'rowspan'],
      code: [['className', /^language-./, 'math-inline', 'math-display']],
      video: [
        'src',
        'controls',
        'loop',
        'className',
        'width',
        'height',
        'autoplay',
        'muted',
      ],
    },
    clobber: defaultSchema.clobber?.filter(i => i !== 'id'),
  };

  // Used to collect the file data during processing
  const fileData: Record<string, unknown> = {};
  function remarkLineBreaks() {
    return (tree: Root) => {
      visit(tree, 'html', (node: Literal) => {
        if (typeof node.value === 'string') {
          if (
            node.value.toLowerCase() === '<br>' ||
            node.value.toLowerCase() === '<br/>'
          ) {
            node.type = 'break';
          }
        }
      });
    };
  }
  // Process the Markdown content
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkLineBreaks)
    .use(() => remarkResolveImagePaths(filePath))
    .use(remarkProcessLinks) // Process links and remove .md extensions
    .use(remarkToc) // Extract table of contents and create heading ID mapping
    .use(remarkBlockCount) // Count blocks
    .use(remarkMath, {
      // singleDollarTextMath: false,
    }) // Process math blocks
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeVideos)
    // .use(rehypeKatex) // Render math blocks
    .use(rehypeAddHeadingIds) // Add IDs to headings in HTML
    .use(rehypeSanitize, schema as never) // Type cast needed due to rehype-sanitize typing limitations
    .use(rehypeTable) // Wrap tables in a container div
    .use(rehypeHighlight)

    .use(rehypeStringify);

  // Process the content
  const vFile = await processor.process({
    value: preprocessDollarSigns(content),
    data: fileData,
  });

  return {
    frontmatter,
    content: postprocessDollarSigns(String(vFile)),
    tocItems: (fileData as FileData).toc || [], // Return the table of contents
    blockCount: (fileData as FileData).blockCount || 0, // Return the block count
    rawContent: content,
  };
}

export function getMarkdownMetadata(slugPath: string) {
  const filePath = getContentPath(slugPath);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const markdownContent = fs.readFileSync(filePath, 'utf-8');
  const { data: frontmatter } = matter(markdownContent);
  return frontmatter;
}
