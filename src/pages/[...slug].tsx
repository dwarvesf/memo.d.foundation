import React from 'react';
import fs from 'fs';
import path from 'path';
import { GetStaticProps, GetStaticPaths } from 'next';

// Import utility functions from lib directory
import { getAllMarkdownFiles } from '../lib/content/paths';
import { getMarkdownContent } from '../lib/content/markdown';
import { getBacklinks } from '../lib/content/backlinks';

// Import components
import { RootLayout, ContentLayout } from '../components';
import SubscriptionSection from '../components/layout/SubscriptionSection';

interface ContentPageProps {
  content: string;
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
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

    // Try multiple file path options to support Hugo's _index.md convention
    let filePath = path.join(process.cwd(), 'public/content', ...slug) + '.md';
    
    // If the direct path doesn't exist, check if there's an _index.md file in the directory
    if (!fs.existsSync(filePath)) {
      const indexFilePath = path.join(process.cwd(), 'public/content', ...slug, '_index.md');
      
      if (fs.existsSync(indexFilePath)) {
        filePath = indexFilePath;
      } else {
        return { notFound: true };
      }
    }

    // Get markdown content and frontmatter
    const { content, frontmatter} = await getMarkdownContent(filePath);

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

export default function ContentPage({
  content,
  frontmatter,
  slug,
  backlinks,
}: ContentPageProps) {
  // Create a React useEffect to generate and populate table of contents
  React.useEffect(() => {
    const articleContent = document.querySelector('.article-content');
    const tocContainer = document.getElementById('TableOfContents');
    
    if (articleContent && tocContainer) {
      // Find all headings h2, h3, h4
      const headings = articleContent.querySelectorAll('h2, h3, h4');
      
      if (headings.length > 0) {
        const toc = document.createElement('ul');
        const tocLinks: HTMLAnchorElement[] = [];
        
        headings.forEach((heading) => {
          // Create slug for heading
          const headingText = heading.textContent || '';
          const headingId = headingText
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
          
          // Set ID on the heading element
          heading.id = headingId;
          
          // Create TOC item
          const listItem = document.createElement('li');
          const link = document.createElement('a');
          link.href = `#${headingId}`;
          link.textContent = headingText;
          link.setAttribute('data-target', headingId);
          tocLinks.push(link);
          
          // Add smooth scrolling behavior
          link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetHeading = document.getElementById(headingId);
            
            if (targetHeading) {
              // Get the header height to offset the scroll position
              const headerHeight = 64; // Height of the fixed header
              const targetPosition = targetHeading.getBoundingClientRect().top + window.scrollY - headerHeight - 20; // Extra 20px padding
              
              // Scroll to the target position
              window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
              });
              
              // Update URL without causing page reload
              history.pushState(null, '', `#${headingId}`);
              
              // Add active class to the clicked link
              tocLinks.forEach(l => l.classList.remove('active'));
              link.classList.add('active');
            }
          });
          
          // Style based on heading level
          if (heading.tagName === 'H3') {
            listItem.style.paddingLeft = '1rem';
          } else if (heading.tagName === 'H4') {
            listItem.style.paddingLeft = '2rem';
          }
          
          listItem.appendChild(link);
          toc.appendChild(listItem);
        });
        
        tocContainer.innerHTML = '';
        tocContainer.appendChild(toc);
        
        // Add scroll spy functionality
        const observer = new IntersectionObserver(
          (entries) => {
            // Find first visible heading
            const visibleEntry = entries.find(entry => entry.isIntersecting);
            
            if (visibleEntry) {
              const id = visibleEntry.target.id;
              // Find the corresponding TOC link and highlight it
              tocLinks.forEach((link) => {
                link.classList.remove('active');
                if (link.getAttribute('data-target') === id) {
                  link.classList.add('active');
                }
              });
            }
          },
          {
            rootMargin: '-80px 0px -80% 0px', // Top offset adjusted
            threshold: 0.1 // Require at least 10% visibility
          }
        );
        
        // Observe all headings
        headings.forEach((heading) => {
          observer.observe(heading);
        });
        
      } else {
        // Hide the TOC if no headings found
        const label = document.querySelector('.nav-label');
        if (label) {
          label.textContent = '';
        }
        tocContainer.style.display = 'none';
      }
    }
    
    // Check for initial hash in URL to highlight correct TOC item
    if (window.location.hash) {
      const id = window.location.hash.substring(1);
      const target = document.getElementById(id);
      if (target) {
        setTimeout(() => {
          // Get the header height to offset the scroll position
          const headerHeight = 64; // Height of the fixed header
          const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight - 20;
          
          // Scroll to the target position
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
          
          // Highlight the correct TOC link
          const link = document.querySelector(`a[data-target="${id}"]`);
          if (link) {
            document.querySelectorAll('.table-of-contents a').forEach(a => a.classList.remove('active'));
            link.classList.add('active');
          }
        }, 200); // Slightly longer timeout to ensure TOC is fully rendered
      }
    }
    
  }, [content]); // Re-run when content changes

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
    // Additional character and block counts for metadata
    characterCount: content.length,
    blocksCount: content.split(/\n\s*\n/).length,
  };

  // Format backlinks for display
  const formattedBacklinks = backlinks.map(backlink => ({
    title: backlink.split('/').pop() || backlink,
    url: `/${backlink}`
  }));

  // Don't show subscription for certain pages
  const shouldShowSubscription = !frontmatter.hide_subscription && 
    !['home', 'tags', 'contributor'].some(path => slug.includes(path));

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
        backlinks={formattedBacklinks}
        hideFrontmatter={frontmatter.hide_frontmatter}
        hideTitle={frontmatter.hide_title}
      >
        {/* Render the HTML content safely */}
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </ContentLayout>
      
      {/* Only show subscription section on content pages, not special pages */}
      {shouldShowSubscription && <SubscriptionSection />}
    </RootLayout>
  );
}
