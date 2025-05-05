import type { NextConfig } from 'next';
import createMDX from '@next/mdx';

const withMDX = createMDX({
  extension: /\.mdx?$/, // Fixed the escaping of the backslash
  options: {
    remarkPlugins: [],
    rehypePlugins: [],
  },
});

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'], // Added 'mdx' to the extensions
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  experimental: {
    largePageDataBytes: 1024 * 1024,
  },
};

// Merge MDX config with Next.js config
export default withMDX(nextConfig);
