import fs from 'fs';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import matter from 'gray-matter';

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
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(content);

  return {
    frontmatter,
    content: String(processedContent)
  };
}