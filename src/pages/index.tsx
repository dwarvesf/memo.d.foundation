import { Geist, Geist_Mono } from 'next/font/google';
import { GetStaticProps } from 'next';
import Link from 'next/link';
import path from 'path';
import fs from 'fs';

import { RootLayout } from '../components';
import { getAllMarkdownFiles } from '../lib/content/paths';
import { getMarkdownContent } from '../lib/content/markdown';
import { buildDirectorTree } from '@/lib/content/directoryTree';
import { IMiniSearchIndex, ITreeNode } from '@/types';
import {
  getSerializableSearchIndex,
  initializeSearchIndex,
} from '@/lib/content/search';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
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
  directoryTree: Record<string, ITreeNode>;
  searchIndex?: IMiniSearchIndex;
}

export const getStaticProps: GetStaticProps = async () => {
  try {
    const contentDir = path.join(process.cwd(), 'public/content');
    initializeSearchIndex();
    const searchIndex = getSerializableSearchIndex();
    // Get all markdown files
    const allPaths = getAllMarkdownFiles(contentDir);
    const directoryTree = buildDirectorTree(allPaths);

    // Get the most recent posts (limit to 6)

    const recentPostsPromises = allPaths
      .slice(0, 10) // Get the first 10 files to process
      .map(async slugArray => {
        const filePath = path.join(contentDir, ...slugArray) + '.md';

        if (!fs.existsSync(filePath)) {
          return null;
        }

        const { frontmatter } = await getMarkdownContent(filePath);

        return {
          title: frontmatter.title || slugArray[slugArray.length - 1],
          slug: '/' + slugArray.join('/'),
          date: frontmatter.date
            ? new Date(frontmatter.date).toISOString()
            : null,
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
        directoryTree,
        searchIndex,
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

export default function Home({
  featuredPosts,
  directoryTree,
  searchIndex,
}: HomePageProps) {
  return (
    <RootLayout
      title="Dwarves Memo - Home"
      description="Knowledge sharing platform for Dwarves Foundation"
      directoryTree={directoryTree}
      searchIndex={searchIndex}
    >
      <div className={`${geistSans.variable} ${geistMono.variable}`}>
        <section className="py-12 md:py-12">
          <div className="container mx-auto max-w-5xl px-4">
            <h1 className="mb-6 text-4xl font-bold md:text-5xl">
              Dwarves Memo
            </h1>
            <p className="text-muted-foreground mb-12 text-xl">
              A knowledge sharing platform for the Dwarves Foundation community
            </p>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {featuredPosts.map(post => (
                <Link key={post.slug} href={post.slug} className="group block">
                  <div className="bg-card hover:border-primary h-full overflow-hidden rounded-lg border p-6 transition-colors">
                    <div className="mb-4">
                      {post.tags && post.tags.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {post.tags.slice(0, 3).map(tag => (
                            <span
                              key={tag}
                              className="bg-muted rounded-full px-2 py-1 text-xs"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <h3 className="group-hover:text-primary line-clamp-2 text-lg font-medium transition-colors">
                        {post.title}
                      </h3>
                    </div>

                    {post.description && (
                      <p className="text-muted-foreground mb-4 line-clamp-3 text-sm">
                        {post.description}
                      </p>
                    )}

                    {post.date && (
                      <div className="text-muted-foreground mt-auto text-xs">
                        {new Date(post.date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-muted py-12">
          <div className="container mx-auto max-w-5xl px-4 text-center">
            <h2 className="mb-8 text-2xl font-bold">Explore by Category</h2>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Link
                href="/consulting"
                className="bg-card hover:border-primary rounded-lg border p-6 transition-colors"
              >
                <div className="mb-2 text-xl font-medium">Consulting</div>
                <p className="text-muted-foreground text-sm">
                  Case studies and insights
                </p>
              </Link>

              <Link
                href="/earn"
                className="bg-card hover:border-primary rounded-lg border p-6 transition-colors"
              >
                <div className="mb-2 text-xl font-medium">Earn</div>
                <p className="text-muted-foreground text-sm">
                  Bounties and rewards
                </p>
              </Link>

              <Link
                href="/careers/hiring"
                className="bg-card hover:border-primary rounded-lg border p-6 transition-colors"
              >
                <div className="mb-2 text-xl font-medium">Hiring</div>
                <p className="text-muted-foreground text-sm">Join our team</p>
              </Link>

              <Link
                href="/playground"
                className="bg-card hover:border-primary rounded-lg border p-6 transition-colors"
              >
                <div className="mb-2 text-xl font-medium">Playground</div>
                <p className="text-muted-foreground text-sm">
                  Experimental content
                </p>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </RootLayout>
  );
}
