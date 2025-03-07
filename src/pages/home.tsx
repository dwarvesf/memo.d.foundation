import fs from 'fs';
import path from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import matter from 'gray-matter'; // Add this import for frontmatter parsing

interface HomePageProps { 
  content: string;
  frontmatter: Record<string, string>;
}

export async function getStaticProps() {
  // Read the .md file
  const markdownFilePath = path.join(process.cwd(), 'content/home.md');
  const markdownContent = fs.readFileSync(markdownFilePath, 'utf-8');

  // Parse frontmatter and content
  const { data: frontmatter, content } = matter(markdownContent);
  console.log(frontmatter)

  // Process the Markdown content (without frontmatter)
  const processedContent = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(content);

  return {
    props: {
      content: String(processedContent),
      frontmatter: JSON.stringify(frontmatter),
    },
  };
}

export default function HomePage({ content, frontmatter }: HomePageProps) {
  return (
    <div>
      {frontmatter.title && <h1>{frontmatter.title}</h1>}
      
      {/* Render the HTML content safely */}
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}