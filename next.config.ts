import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  pageExtensions: ['js', 'jsx', 'md', 'ts', 'tsx'],
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  experimental: {
    largePageDataBytes: 1024 * 1024,
  },
};

module.exports = nextConfig;

// Merge MDX config with Next.js config
export default nextConfig;
