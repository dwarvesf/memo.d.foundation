import fs from 'fs';
import path from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import matter from 'gray-matter';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';

// Define interfaces for the AST nodes
interface ImageNode {
  type: 'image';
  url: string;
  title: string | null;
  alt: string | null;
}

/**
 * Custom remark plugin to resolve relative image paths
 * @param fileDir Directory of the markdown file
 */
function remarkResolveImagePaths(fileDir: string) {
  return (tree: Root) => {
    visit(tree, 'image', (node) => {
      const imageNode = node as ImageNode;
      // Only process relative URLs (not starting with http://, https://, or /)
      if (!/^(https?:\/\/|\/)/i.test(imageNode.url)) {
        // Get the directory of the markdown file
        const mdFileDir = path.dirname(fileDir);
        
        // Construct the path to the image relative to the content directory
        const absoluteImagePath = path.resolve(mdFileDir, imageNode.url);
        
        // Make the path relative to the public directory for serving
        // This maps content/assets/image.webp to /content/assets/image.webp
        let publicPath = '/' + path.relative(process.cwd(), absoluteImagePath);
        
        // Remove the 'public' prefix if it exists
        if (publicPath.startsWith('/public/')) {
          publicPath = publicPath.substring(7); // Remove '/public' (7 characters)
        }
        
        // Update the URL
        imageNode.url = publicPath;
      }
    });
  };
}

/**
 * Reads and parses markdown content from a file
 * @param filePath Path to the markdown file
 * @returns Object with frontmatter and processed HTML content
 */
export async function getMarkdownContent(filePath: string) {
  // Read the markdown file
  const markdownContent = fs.readFileSync(filePath, 'utf-8');

  // Parse frontmatter and content
  const { data: frontmatter, content } = matter(markdownContent);

  // Process the Markdown content
  const processedContent = await unified()
    .use(remarkParse)
    .use(() => remarkResolveImagePaths(filePath))
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(content);

  return {
    frontmatter,
    content: String(processedContent)
  };
}