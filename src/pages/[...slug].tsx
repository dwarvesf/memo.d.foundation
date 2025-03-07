import fs from 'fs';
import path from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import matter from 'gray-matter';
import { GetStaticProps, GetStaticPaths } from 'next';
import { asyncBufferFromFile, parquetRead } from 'hyparquet';

interface ContentPageProps {
  content: string;
  frontmatter: Record<string, string | number | boolean | null>;
  slug: string[];
  backlinks: string[];
}

export const getStaticPaths: GetStaticPaths = async () => {
  // This function is called at build time to generate all possible paths
  // When using "output: export" we need to pre-render all paths
  // that will be accessible in the exported static site

  // You'll need to implement logic to find all markdown files
  // and generate paths for them
  const contentDir = path.join(process.cwd(), 'content');

  // Helper function to get all markdown files recursively
  function getAllMarkdownFiles(dir: string, basePath: string[] = []): string[][] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const paths: string[][] = [];

    for (const entry of entries) {
      const res = path.resolve(dir, entry.name);
      if (entry.isDirectory()) {
        paths.push(...getAllMarkdownFiles(res, [...basePath, entry.name]));
      } else if (entry.name.endsWith('.md')) {
        // Remove .md extension for the slug
        const slugName = entry.name.replace(/\.md$/, '');
        paths.push([...basePath, slugName]);
      }
    }

    return paths;
  }

  const paths = getAllMarkdownFiles(contentDir).map(slugArray => ({
    params: { slug: slugArray }
  }));

  return {
    paths,
    fallback: false // Must be 'false' for static export
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  try {
    const { slug } = params as { slug: string[] };

    // Construct the file path from the slug
    const filePath = path.join(process.cwd(), 'content', ...slug) + '.md';

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return {
        notFound: true,
      };
    }

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

    // Read from the parquet database to find references to this page
    let backlinks: string[] = [];
    try {
      const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
      if (fs.existsSync(parquetFilePath)) {
        // Create escaped versions for pattern matching
        const escapedFullPath = slug.join('/');
        const escapedSlug = slug[slug.length - 1];

        await parquetRead({
          file: await asyncBufferFromFile(parquetFilePath),
          columns: ['file_path', 'md_content'],
          onComplete: (data) => {
            const filteredData = data.filter(row => {
              const content = row[1]?.toString() || ''; // md_content is at index 1
              return (
                // Search for full URL mentions
                content.includes(`https://memo.d.foundation/${escapedFullPath}`) ||
                // Search for relative path mentions
                content.includes(`${escapedFullPath}`) ||
                // Search for just the slug mentions with .md extension
                content.includes(`/${escapedSlug}.md`) ||
                content.includes(`#${escapedSlug}.md`)
              );
            });

            backlinks = filteredData.map(row => row[0]?.toString() || '');
            console.log('Pages referencing this content:', backlinks);
          }
        });
      }
    } catch (parquetError) {
      console.error('Error reading parquet file:', parquetError);
    }

    return {
      props: {
        content: String(processedContent),
        frontmatter: JSON.parse(JSON.stringify(frontmatter)), // Ensure serializable
        slug,
        backlinks,
      },
    };
  } catch (error) {
    console.error('Error in getStaticProps:', error);
    return {
      notFound: true,
    };
  }
};

export default function ContentPage({ content, frontmatter, slug, backlinks }: ContentPageProps) {
  // Create a breadcrumb from the slug
  const breadcrumb = slug.join(' / ');

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <span className="inline-block px-2 py-1 text-sm text-gray-600 bg-gray-100 rounded dark:bg-gray-800 dark:text-gray-300">
          {breadcrumb}
        </span>
      </div>

      {frontmatter.title && <h1 className="text-3xl font-bold mb-6">{frontmatter.title}</h1>}

      {/* Render the HTML content safely */}
      <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: content }} />

      <div className="mt-12">
        <h2 className="text-xl font-bold mb-4">Backlinks</h2>
        <ul>
          {backlinks.map((backlink, index) => (
            <li key={index}>
              <a href={`/${backlink}`} className="text-blue-600 dark:text-blue-400 hover:underline">{backlink}</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}