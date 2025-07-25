import { ITocItem } from '@/types';
import fs from 'fs/promises'; // Use asynchronous promises API
import matter from 'gray-matter';
import { h } from 'hastscript';
import type {
  Element,
  Root as HastRoot,
  Text as HastText,
  Properties,
} from 'hast';
import type { Code, Heading, Link, Literal, Root } from 'mdast';
import path from 'path';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import slugify from 'slugify';
import { unified } from 'unified';
import { SKIP, visit } from 'unist-util-visit';
import { getContentPath, getStaticJSONPaths } from './paths';
import { unescape } from 'lodash';

// Define interfaces for the AST nodes
interface ImageNode {
  type: 'image';
  url: string;
  title: string | null;
  alt: string | null;
}

interface FileData {
  toc?: ITocItem[];
  headingTextMap?: Map<string, string>;
  blockCount?: number;
  summaries?: string[];
  [key: string]: unknown;
}

function preprocessDollarSigns(markdown: string) {
  // First handle currency formatting to avoid conflicts with math
  let result = markdown.replace(/\$(\d[\d,.]*)/g, '[CURRENCY:$1]');

  // Fix multiline display math blocks by converting them to single-line format
  // This helps remark-math parse them correctly as inlineMath nodes
  result = result.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (match, content) => {
    // Normalize the content while preserving important LaTeX formatting
    const cleanContent = content
      .trim()
      // Replace line breaks with spaces, but preserve \\\\ which are LaTeX line breaks
      .replace(/\n\s*/g, ' ')
      // Normalize multiple spaces to single space, but avoid breaking \\\\
      .replace(/\s+/g, ' ')
      // Clean up spaces around \\\\
      .replace(/\s*\\\\\s*/g, ' \\\\ ');

    return `$$${cleanContent}$$`;
  });

  return result;
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
function rehypeCodeblock() {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: Element) => {
      if (
        node.tagName === 'pre' &&
        node.children.some(child => (child as Element).tagName === 'code')
      ) {
        node.properties = node.properties || {};
        const curClassName = node.properties.className;
        const customClassName = 'markdown-codeblock';
        if (Array.isArray(curClassName)) {
          node.properties.className = [...curClassName, customClassName];
        } else {
          node.properties.className = [
            ...(typeof curClassName === 'string' ? [curClassName] : []),
            customClassName,
          ];
        }
      }
    });
  };
}

/**
 * Custom rehype plugin to convert inline code elements to span elements with mark-text-block class
 */
export function rehypeInlineCodeToSpan() {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName === 'code') {
        // Check if the parent is NOT a 'pre' element.
        // Inline code <code> elements are direct children of other elements like <p>,
        // whereas code blocks are <code> within <pre>.
        const parentIsPre =
          parent &&
          (parent as Element).type === 'element' &&
          (parent as Element).tagName === 'pre';

        // Check if this is a math element (has math-related classes)
        const classNames = Array.isArray(node.properties?.className)
          ? node.properties.className
          : typeof node.properties?.className === 'string'
            ? [node.properties.className]
            : [];

        const isMathElement = classNames.some(
          (className: string | number) =>
            typeof className === 'string' &&
            ['math-inline', 'math-display', 'language-math'].includes(
              className,
            ),
        );

        if (!parentIsPre && !isMathElement) {
          node.tagName = 'span';
          node.properties = node.properties || {}; // Ensure properties object exists

          // Initialize or update className
          let updatedClassNames: string[] = [];
          if (Array.isArray(node.properties.className)) {
            updatedClassNames = node.properties.className.map(String);
          } else if (typeof node.properties.className === 'string') {
            updatedClassNames = [node.properties.className];
          }

          // Remove any existing highlighting classes that might be there by mistake
          updatedClassNames = updatedClassNames.filter(
            (cn: string) => !cn.startsWith('language-') && cn !== 'hljs',
          );

          // Add 'mark-text-block' if not already present
          if (!updatedClassNames.includes('mark-text-block')) {
            updatedClassNames.push('mark-text-block');
          }
          node.properties.className = updatedClassNames;
        }
      }
    });
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
 * Custom remark plugin to extract and remove summary code blocks
 */
function remarkExtractSummaries() {
  return (tree: Root, file: { data: Record<string, unknown> }) => {
    const fileData = file.data as FileData;
    fileData.summaries = fileData.summaries || [];

    visit(tree, 'code', (node: Code, index, parent) => {
      if (node.lang === 'summary' && parent && typeof index === 'number') {
        fileData.summaries = fileData.summaries || [];
        // Extract the content of the summary block
        fileData.summaries.push(...node.value.split('\n').filter(Boolean));
        // Remove the summary block from the tree
        parent.children.splice(index, 1);
        return [SKIP, index];
      }
    });
  };
}

/**
 * Custom remark plugin to extract, remove TLDR code blocks and convert them
 * to a blockquote with a class
 * Eg:
 * ```tldr
 * This is a TLDR summary
 * ```
 * To:
 * <blockquote class="tldr">
 *   <p>This is a TLDR summary</p>
 * </blockquote>
 */
export function remarkExtractTLDR() {
  return (tree: Root) => {
    visit(tree, 'code', (node: Code, index, parent) => {
      if (node.lang === 'tldr' && parent && typeof index === 'number') {
        // Create a blockquote node with TL;DR: prefix and the TLDR content
        const tldrContent = node.value.trim();
        const tldrLines = tldrContent.split('\n').filter(Boolean);
        if (tldrLines.length === 0) {
          return [SKIP, index];
        }
        const blockquoteNode = {
          type: 'blockquote' as const,
          children: [
            {
              type: 'paragraph' as const,
              children: [
                {
                  type: 'strong' as const,
                  children: [{ type: 'text' as const, value: 'tl;dr;' }],
                },
              ],
            },
            ...tldrLines.map(line => ({
              type: 'paragraph' as const,
              children: [
                {
                  type: 'text' as const,
                  value: line.trim(),
                },
              ],
            })),
          ],
          data: {
            hProperties: {
              className: ['tldr'],
            },
          },
        };

        // Replace the code block with the blockquote
        parent.children[index] = blockquoteNode;
        return [SKIP, index];
      }
    });
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
      if (/^h[2-6]$/.test(node.tagName)) {
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
          const headingId = nextCount > 1 ? `${id}-${nextCount}` : id;
          node.properties.id = headingId;

          // Create the link icon element
          const linkIcon = h(
            'span',
            {
              className:
                'absolute right-full top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pr-3',
              'aria-label': `Link to section ${textContent}`,
              title: `Link to section ${textContent}`,
            },
            h(
              'span',
              {
                className:
                  'text-muted-foreground hover:text-foreground w-6 rounded-md hidden sm:flex items-center justify-center h-6 border',
              },
              h(
                'svg',
                {
                  xmlns: 'http://www.w3.org/2000/svg',
                  viewBox: '0 0 24 24',
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: '2',
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  className: 'w-3 h-3 text-current',
                },
                h('path', {
                  d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
                }),
                h('path', {
                  d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
                }),
              ),
            ),
          );

          // Wrap the heading content in a div to apply relative positioning
          // and insert the link icon as a sibling within that div.
          // This requires changing the heading node itself.
          // The original heading content will be a child of this new div.
          const originalChildren = [...node.children];
          node.children = [
            h(
              'div',
              {
                className: 'relative inline-block group cursor-pointer',
                'data-heading-id': headingId, // Custom attribute to easily retrieve the ID
              }, // Use group for hover effect
              ...originalChildren,
              linkIcon,
            ),
          ];
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
 * Custom remark plugin to process links and resolve relative paths
 * @param markdownFilePath Path to the markdown file being processed
 */
export function remarkProcessLinks(
  markdownFilePath: string,
  aliasJSONPaths: Record<string, string>,
) {
  return (tree: Root) => {
    visit(tree, 'link', (node: Link) => {
      const linkNode = node as Link; // Use mdast Link type
      const targetUrl = linkNode.url;

      // Skip external links, mailto, tel, and anchor links
      if (/^(https?:\/\/|mailto:|tel:|#)/i.test(targetUrl)) {
        return;
      }

      let finalUrl: string;

      if (targetUrl.startsWith('/')) {
        // Link is already absolute from the site root (or should be treated as such)
        if (targetUrl.endsWith('.md')) {
          finalUrl = targetUrl.slice(0, -3);
        } else if (targetUrl.endsWith('.mdx')) {
          finalUrl = targetUrl.slice(0, -4);
        } else {
          finalUrl = targetUrl;
        }
      } else {
        // Relative link
        const currentFileDir = path.dirname(markdownFilePath);
        const absoluteTargetPath = path.resolve(currentFileDir, targetUrl);

        const contentDir = path.join(process.cwd(), 'public', 'content');
        let relativeToContentDir = path.relative(
          contentDir,
          absoluteTargetPath,
        );

        relativeToContentDir = relativeToContentDir.split(path.sep).join('/');
        finalUrl = '/' + relativeToContentDir;

        if (finalUrl.endsWith('.md')) {
          finalUrl = finalUrl.slice(0, -3);
        }

        if (finalUrl.endsWith('.mdx')) {
          finalUrl = finalUrl.slice(0, -4);
        }
        // Handle cases where the link might now be to an index page like /folder/ (previously /folder/_index or /folder/readme)
        // This might need adjustment based on how your `_index.md` or `readme.md` files are treated for URLs.
        // For example, if `/folder/_index` should become `/folder/`
        if (finalUrl.endsWith('/_index') || finalUrl.endsWith('/readme')) {
          finalUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/'));
          if (finalUrl === '') finalUrl = '/'; // Handle root index/readme
        }
      }
      linkNode.url = getServerSideRedirectPath(finalUrl, aliasJSONPaths);
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
 * Custom rehype plugin to add a class to internal links for Next.js router handling
 */
export function rehypeNextjsLinks() {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: Element) => {
      if (
        node.tagName === 'a' &&
        node.properties &&
        typeof node.properties.href === 'string'
      ) {
        const href = node.properties.href;

        // Check if the link is internal (doesn't start with a protocol or anchor)
        if (href && !/^(https?:\/\/|mailto:|tel:|#)/i.test(href)) {
          // Add the 'js-nextjs-link' class
          const existingClasses = Array.isArray(node.properties.className)
            ? node.properties.className
            : typeof node.properties.className === 'string'
              ? [node.properties.className]
              : [];
          node.properties.className = [...existingClasses, 'js-nextjs-link'];
        }
      }
    });
  };
}

/**
 * Custom rehype plugin to enhance lists with improved styling classes
 */
export function rehypeEnhanceLists() {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: Element) => {
      // Add enhanced classes to unordered lists
      if (node.tagName === 'ul') {
        const existingClasses = Array.isArray(node.properties?.className)
          ? node.properties.className
          : typeof node.properties?.className === 'string'
            ? [node.properties.className]
            : [];
        node.properties = node.properties || {};
        node.properties.className = existingClasses.includes(
          'contains-task-list',
        )
          ? existingClasses
          : [...existingClasses, 'enhanced-list', 'enhanced-list--unordered'];
      }

      // Add enhanced classes to ordered lists
      if (node.tagName === 'ol') {
        const existingClasses = Array.isArray(node.properties?.className)
          ? node.properties.className
          : typeof node.properties?.className === 'string'
            ? [node.properties.className]
            : [];
        node.properties = node.properties || {};
        node.properties.className = existingClasses.includes(
          'contains-task-list',
        )
          ? existingClasses
          : [...existingClasses, 'enhanced-list', 'enhanced-list--ordered'];
      }

      // Add enhanced classes to list items
      if (node.tagName === 'li') {
        const existingClasses = Array.isArray(node.properties?.className)
          ? node.properties.className
          : typeof node.properties?.className === 'string'
            ? [node.properties.className]
            : [];
        node.properties = node.properties || {};
        node.properties.className = existingClasses.includes('task-list-item')
          ? existingClasses
          : [...existingClasses, 'enhanced-list__item'];
      }
    });
  };
}

/**
 * Reads and parses markdown content from a file
 * @param filePath Path to the markdown file
 * @returns Object with frontmatter, processed HTML content, and table of contents
 */
import aliasesJson from '../../../public/content/aliases.json';
import { getServerSideRedirectPath } from './utils';

export async function getMarkdownContent(filePath: string) {
  // Filter out files that are shadowed by an alias key
  // (e.g. if /brainery is an alias, /brainery.md should not be rendered)
  const contentDir = path.join(process.cwd(), 'public', 'content');
  const relPath = path.relative(contentDir, filePath);
  const relPathNoExt = relPath.replace(/\.mdx?$/, '').replace(/\\/g, '/');
  const aliasKeys = Object.keys(aliasesJson);
  const aliasJSONPaths = await getStaticJSONPaths();

  // If this file matches an alias key (e.g. brainery.md for /brainery), skip rendering
  if (
    aliasKeys.some(
      alias => alias.replace(/^\//, '') === relPathNoExt.replace(/^\//, ''),
    )
  ) {
    throw new Error(
      `File ${filePath} is shadowed by alias key in aliases.json and should not be rendered.`,
    );
  }

  // Read the markdown file
  const markdownContent = await fs.readFile(filePath, 'utf-8'); // Use asynchronous readFile

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
      'input', // Add input tag for checkboxes
      // Table elements
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'video', // Add video tag
      'iframe', // Add iframe tag
      // KaTeX math elements
      'math',
      'semantics',
      'mrow',
      'mi',
      'mo',
      'mn',
      'msub',
      'msup',
      'msubsup',
      'mfrac',
      'msqrt',
      'mroot',
      'mtext',
      'mspace',
      'menclose',
      'mpadded',
      'mphantom',
      'annotation',
      'mtable',
      'mtr',
      'mtd',
      'mlabeledtr',
      'maligngroup',
      'malignmark',
      'mglyph',
      'munder',
      'mover',
      'munderover',
      'mmultiscripts',
      'mprescripts',
      'none',
      'mfenced',
      'maction',
      // SVG tags for Mermaid
      'svg',
      'g',
      'path',
      'rect',
      'circle',
      'ellipse',
      'line',
      'polyline',
      'polygon',
      'text',
      'tspan',
      'style',
      'defs',
      'marker',
      'use',
    ],
    attributes: {
      // Allow common attributes on all elements
      '*': ['id', 'className', 'style'],
      a: ['href', 'target', 'rel', 'className'], // Ensure className is allowed on a tags
      img: ['src', 'alt', 'title'],
      th: ['align', 'scope', 'colspan', 'rowspan'],
      td: ['align', 'colspan', 'rowspan'],
      code: [['className', /^language-./, 'math-inline', 'math-display']],
      input: ['type', 'checked', 'disabled'], // Add input attributes for checkboxes
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
      iframe: [
        'src',
        'width',
        'height',
        'allow',
        'allowfullscreen',
        'frameborder',
        'title',
        'referrerpolicy',
      ],
      // KaTeX math attributes
      math: ['xmlns', 'display'],
      semantics: [],
      mrow: [],
      mi: ['mathvariant'],
      mo: ['stretchy', 'fence', 'separator', 'lspace', 'rspace', 'form'],
      mn: [],
      msub: [],
      msup: [],
      msubsup: [],
      mfrac: ['linethickness'],
      msqrt: [],
      mroot: [],
      mtext: [],
      mspace: ['width', 'height', 'depth'],
      menclose: ['notation'],
      mpadded: ['width', 'lspace', 'voffset'],
      mphantom: [],
      annotation: ['encoding'],
      mtable: ['align', 'rowalign', 'columnalign', 'groupalign'],
      mtr: [],
      mtd: ['columnspan', 'rowspan'],
      mlabeledtr: [],
      maligngroup: [],
      malignmark: [],
      mglyph: ['src', 'alt', 'width', 'height'],
      munder: [],
      mover: [],
      munderover: [],
      mmultiscripts: [],
      mprescripts: [],
      none: [],
      mfenced: ['open', 'close', 'separators'],
      maction: ['actiontype', 'selection'],
      // SVG attributes
      svg: [
        'width',
        'height',
        'viewBox',
        'xmlns',
        'xmlns:xlink',
        'version',
        'preserveAspectRatio',
      ],
      g: ['transform', 'fill', 'stroke', 'stroke-width'],
      path: [
        'd',
        'fill',
        'stroke',
        'stroke-width',
        'marker-start',
        'marker-end',
        'marker-mid',
      ],
      rect: [
        'x',
        'y',
        'width',
        'height',
        'rx',
        'ry',
        'fill',
        'stroke',
        'stroke-width',
      ],
      circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width'],
      ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'stroke-width'],
      line: [
        'x1',
        'y1',
        'x2',
        'y2',
        'stroke',
        'stroke-width',
        'marker-start',
        'marker-end',
        'marker-mid',
      ],
      polyline: ['points', 'fill', 'stroke', 'stroke-width'],
      polygon: ['points', 'fill', 'stroke', 'stroke-width'],
      text: [
        'x',
        'y',
        'dx',
        'dy',
        'text-anchor',
        'font-size',
        'font-family',
        'font-weight',
        'fill',
        'stroke',
        'stroke-width',
      ],
      tspan: ['x', 'y', 'dx', 'dy'],
      marker: [
        'id',
        'viewBox',
        'markerWidth',
        'markerHeight',
        'refX',
        'refY',
        'orient',
        'markerUnits',
        'preserveAspectRatio',
      ],
      use: ['href', 'xlink:href', 'x', 'y', 'width', 'height'], // Note: xlink:href might be needed for older compatibility
    },
    // Keep existing clobber logic, ensuring 'id' is not clobbered
    clobber: defaultSchema.clobber?.filter(i => i !== 'id'),
    // Add required protocols for href attributes (especially for 'use' tag)
    protocols: {
      ...defaultSchema.protocols,
      href: ['http', 'https', 'mailto', 'tel', '#'], // Ensure '#' is allowed for internal references
      'xlink:href': ['#'], // Allow internal references for xlink:href
    },
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
    .use(remarkMath) // Process math blocks BEFORE remarkGfm to avoid conflicts
    .use(remarkGfm)
    .use(remarkFixMathEntities) // Fix HTML entities in math content AFTER remarkGfm
    .use(remarkLineBreaks)
    .use(() => remarkResolveImagePaths(filePath))
    .use(() => remarkProcessLinks(filePath, aliasJSONPaths)) // Process links and resolve paths
    .use(remarkExtractSummaries) // Extract and remove summary code blocks
    .use(remarkExtractTLDR) // Extract and convert TLDR code blocks to blockquotes
    .use(remarkToc) // Extract table of contents and create heading ID mapping
    .use(remarkBlockCount) // Count blocks
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw) // Allow raw HTML - must come early to properly parse math
    .use(rehypeVideos)
    .use(rehypeFixMathEntities) // Fix entity encoding in HTML before KaTeX
    .use(rehypeKatex) // Render math blocks with KaTeX
    .use(rehypeInlineCodeToSpan) // Convert inline code to span with quote-block class - AFTER KaTeX
    .use(rehypeSanitize, schema as never) // Move sanitize AFTER KaTeX to preserve math elements
    .use(rehypeAddHeadingIds) // Add IDs to headings in HTML
    .use(rehypeNextjsLinks) // Add this new plugin here AFTER sanitize
    .use(rehypeEnhanceLists) // Add enhanced classes to lists
    .use(rehypeTable) // Wrap tables in a container div
    .use(rehypeCodeblock) // Add the custom class plugin here
    .use(rehypeHighlight)

    .use(rehypeStringify);
  // Process the content
  const vFile = await processor.process({
    value: preprocessDollarSigns(content),
    data: fileData,
  });

  // Process summaries using a simple inline processor
  const summaryProcessor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkLineBreaks)
    .use(() => remarkResolveImagePaths(filePath)) // Keep image resolution in case summaries have images
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSanitize, schema as never)
    .use(rehypeStringify);

  let rawSummaries = (fileData as FileData).summaries || [];
  if (
    !rawSummaries.length &&
    frontmatter.ai_summary &&
    frontmatter.ai_generated_summary?.length > 0
  ) {
    rawSummaries = frontmatter.ai_generated_summary.map(
      (line: string) => `- ${line}`,
    );
  }
  const processedSummary =
    rawSummaries.length > 0
      ? await summaryProcessor.process(rawSummaries.join('\n'))
      : '';

  return {
    frontmatter,
    content: postprocessDollarSigns(String(vFile)),
    summary: processedSummary.toString(),
    tocItems: (fileData as FileData).toc || [], // Return the table of contents
    blockCount: (fileData as FileData).blockCount || 0, // Return the block count
    rawContent: content,
  };
}

export async function getMarkdownMetadata(slugPath: string) {
  // Make the function asynchronous
  const filePath = getContentPath(slugPath);
  let fileExists = false;
  try {
    await fs.stat(filePath); // Use asynchronous stat to check existence
    fileExists = true;
  } catch {
    // File does not exist
  }

  if (!fileExists) {
    return {};
  }
  const markdownContent = await fs.readFile(filePath, 'utf-8'); // Use asynchronous readFile
  const { data: frontmatter } = matter(markdownContent);
  return frontmatter;
}

/**
 * Custom remark plugin to fix math content that has HTML entities
 */
function remarkFixMathEntities() {
  return (tree: Root) => {
    visit(tree, ['math', 'inlineMath'], (node: any) => {
      if (node.value && typeof node.value === 'string') {
        // Fix HTML entities that might have been introduced
        node.value = unescape(node.value);
      }
    });
  };
}

/**
 * Custom rehype plugin to fix entity encoding in math elements before KaTeX processing
 * This runs on the HTML AST and fixes entities that were encoded during markdown->HTML conversion
 */
function rehypeFixMathEntities() {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: Element) => {
      if (
        node.tagName === 'span' &&
        node.properties &&
        node.properties.className &&
        Array.isArray(node.properties.className) &&
        (node.properties.className.includes('math-display') ||
          node.properties.className.includes('math-inline'))
      ) {
        // Fix entities in text nodes within math elements
        visit(node, 'text', (textNode: HastText) => {
          if (textNode.value && typeof textNode.value === 'string') {
            textNode.value = unescape(textNode.value);
          }
        });
      }
    });
  };
}
