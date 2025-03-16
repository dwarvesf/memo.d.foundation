import { Geist, Geist_Mono } from "next/font/google";
import { GetStaticProps } from 'next';
import Link from 'next/link';
import path from 'path';
import fs from 'fs';

import { RootLayout } from '../components';
import { getAllMarkdownFiles } from '../lib/content/paths';
import { getMarkdownContent } from '../lib/content/markdown';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

interface FeaturedPost {
  title: string;
  slug: string;
  date: string;
  description?: string;
  tags?: string[];
}

interface HomePageProps {
  featuredPosts: FeaturedPost[];
}

export const getStaticProps: GetStaticProps = async () => {
  try {
    const contentDir = path.join(process.cwd(), 'public/content');
    
    // Get all markdown files
    const allPaths = getAllMarkdownFiles(contentDir);
    
    // Get the most recent posts (limit to 6)
    const recentPostsPromises = allPaths
      .slice(0, 10) // Get the first 10 files to process
      .map(async (slugArray) => {
        const filePath = path.join(contentDir, ...slugArray) + '.md';
        
        if (!fs.existsSync(filePath)) {
          return null;
        }
        
        const { frontmatter } = await getMarkdownContent(filePath);
        
        return {
          title: frontmatter.title || slugArray[slugArray.length - 1],
          slug: '/' + slugArray.join('/'),
          date: frontmatter.date ? new Date(frontmatter.date).toISOString() : null,
          description: frontmatter.description,
          tags: frontmatter.tags,
        };
      });
    
    const recentPosts = (await Promise.all(recentPostsPromises))
      .filter(post => post !== null)
      .sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      })
      .slice(0, 6); // Get the 6 most recent posts

    return {
      props: {
        featuredPosts: recentPosts,
      },
    };
  } catch (error) {
    console.error('Error in getStaticProps:', error);
    return {
      props: {
        featuredPosts: [],
      },
    };
  }
};

export default function Home({ featuredPosts }: HomePageProps) {
  return (
    <RootLayout title="Dwarves Memo - Home" description="Knowledge sharing platform for Dwarves Foundation">
      <div className={`${geistSans.variable} ${geistMono.variable}`}>
        <section className="py-12 md:py-20">
          <div className="container max-w-5xl mx-auto px-4">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Dwarves Memo</h1>
            <p className="text-xl text-muted-foreground mb-12">
              A knowledge sharing platform for the Dwarves Foundation community
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredPosts.map((post, index) => (
                <Link 
                  key={post.slug} 
                  href={post.slug}
                  className="block group"
                >
                  <div className="bg-card h-full rounded-lg border overflow-hidden transition-colors hover:border-primary p-6">
                    <div className="mb-4">
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {post.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-xs px-2 py-1 bg-muted rounded-full">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <h3 className="text-lg font-medium group-hover:text-primary transition-colors line-clamp-2">
                        {post.title}
                      </h3>
                    </div>
                    
                    {post.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                        {post.description}
                      </p>
                    )}
                    
                    {post.date && (
                      <div className="text-xs text-muted-foreground mt-auto">
                        {new Date(post.date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
        
        <section className="py-12 bg-muted">
          <div className="container max-w-5xl mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold mb-8">Explore by Category</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link 
                href="/consulting"
                className="p-6 bg-card rounded-lg border hover:border-primary transition-colors"
              >
                <div className="text-xl font-medium mb-2">Consulting</div>
                <p className="text-sm text-muted-foreground">Case studies and insights</p>
              </Link>
              
              <Link 
                href="/earn"
                className="p-6 bg-card rounded-lg border hover:border-primary transition-colors"
              >
                <div className="text-xl font-medium mb-2">Earn</div>
                <p className="text-sm text-muted-foreground">Bounties and rewards</p>
              </Link>
              
              <Link 
                href="/careers/hiring"
                className="p-6 bg-card rounded-lg border hover:border-primary transition-colors"
              >
                <div className="text-xl font-medium mb-2">Hiring</div>
                <p className="text-sm text-muted-foreground">Join our team</p>
              </Link>
              
              <Link 
                href="/playground"
                className="p-6 bg-card rounded-lg border hover:border-primary transition-colors"
              >
                <div className="text-xl font-medium mb-2">Playground</div>
                <p className="text-sm text-muted-foreground">Experimental content</p>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </RootLayout>
  );
}
