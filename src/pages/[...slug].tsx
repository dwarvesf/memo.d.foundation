import fs from 'fs';
import path from 'path';
import { GetStaticProps, GetStaticPaths } from 'next';

// Import utility functions from lib directory
import { getAllMarkdownFiles } from '../lib/content/paths';
import { getMarkdownContent } from '../lib/content/markdown';
import { getBacklinks } from '../lib/content/backlinks';

// Import components
import { RootLayout, ContentLayout } from '../components';

interface ContentPageProps {
  content: string;
  frontmatter: Record<string, any>;
  slug: string[];
  backlinks: string[];
  tableOfContents?: string;
}

/**
 * Gets all possible paths for static generation
 * @returns Object with paths and fallback setting
 */
export const getStaticPaths: GetStaticPaths = async () => {
  // This function is called at build time to generate all possible paths
  // When using "output: export" we need to pre-render all paths
  // that will be accessible in the exported static site
  const contentDir = path.join(process.cwd(), 'public/content');
  
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
    const filePath = path.join(process.cwd(), 'public/content', ...slug) + '.md';

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return { notFound: true };
    }

    // Get markdown content and frontmatter
    const { content, frontmatter, tableOfContents } = await getMarkdownContent(filePath);
    
    // Get backlinks
    const backlinks = await getBacklinks(slug);

    return {
      props: {
        content,
        frontmatter: JSON.parse(JSON.stringify(frontmatter)), // Ensure serializable
        slug,
        backlinks,
        tableOfContents: tableOfContents || null,
      },
    };
  } catch (error) {
    console.error('Error in getStaticProps:', error);
    return { notFound: true };
  }
};

export default function ContentPage({ 
  content, 
  frontmatter, 
  slug, 
  backlinks, 
  tableOfContents 
}: ContentPageProps) {
  // Format metadata for display
  const metadata = {
    created: frontmatter.date ? new Date(frontmatter.date).toLocaleDateString() : undefined,
    updated: frontmatter.lastmod ? new Date(frontmatter.lastmod).toLocaleDateString() : undefined,
    author: frontmatter.authors?.[0],
    coAuthors: frontmatter.authors?.slice(1),
    tags: frontmatter.tags,
    folder: slug.slice(0, -1).join('/'),
    // Calculate reading time based on word count (average reading speed: 200 words per minute)
    wordCount: content.split(/\s+/).length,
    readingTime: `${Math.ceil(content.split(/\s+/).length / 200)} min read`,
  };

  // Format backlinks for display
  const formattedBacklinks = backlinks.map(backlink => ({
    title: backlink.split('/').pop() || backlink,
    url: `/${backlink}`
  }));

  return (
    <RootLayout
      title={frontmatter.title || 'Dwarves Memo'}
      description={frontmatter.description}
      image={frontmatter.image}
    >
      <ContentLayout
        title={frontmatter.title}
        description={frontmatter.description}
        metadata={metadata}
        tableOfContents={tableOfContents}
        backlinks={formattedBacklinks}
        hideFrontmatter={frontmatter.hide_frontmatter}
        hideTitle={frontmatter.hide_title}
      >
        {/* Render the HTML content safely */}
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </ContentLayout>
    </RootLayout>
  );
}