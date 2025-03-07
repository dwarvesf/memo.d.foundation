import fs from 'fs';
import path from 'path';
import { GetStaticProps, GetStaticPaths } from 'next';

// Import utility functions from lib directory
import { getAllMarkdownFiles } from '../lib/content/paths';
import { getMarkdownContent } from '../lib/content/markdown';
import { getBacklinks } from '../lib/content/backlinks';

interface ContentPageProps {
  content: string;
  frontmatter: Record<string, string | number | boolean | null>;
  slug: string[];
  backlinks: string[];
}

/**
 * Gets all possible paths for static generation
 * @returns Object with paths and fallback setting
 */
export const getStaticPaths: GetStaticPaths = async () => {
  // This function is called at build time to generate all possible paths
  // When using "output: export" we need to pre-render all paths
  // that will be accessible in the exported static site
  const contentDir = path.join(process.cwd(), 'content');
  
  const paths = getAllMarkdownFiles(contentDir).map(slugArray => ({
    params: { slug: slugArray }
  }));

  return {
    paths,
    fallback: false // Must be 'false' for static export
  };
};

/**
 * Gets static props for the content page
 */
export const getStaticProps: GetStaticProps = async ({ params }) => {
  try {
    const { slug } = params as { slug: string[] };

    // Construct the file path from the slug
    const filePath = path.join(process.cwd(), 'content', ...slug) + '.md';

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return { notFound: true };
    }

    // Get markdown content and frontmatter
    const { content, frontmatter } = await getMarkdownContent(filePath);
    
    // Get backlinks
    const backlinks = await getBacklinks(slug);

    return {
      props: {
        content,
        frontmatter: JSON.parse(JSON.stringify(frontmatter)), // Ensure serializable
        slug,
        backlinks,
      },
    };
  } catch (error) {
    console.error('Error in getStaticProps:', error);
    return { notFound: true };
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