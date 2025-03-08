import type { NextConfig } from "next";
import createMDX from '@next/mdx'

const nextConfig: NextConfig = {
  output: 'export',
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  images: {
    unoptimized: true,
  },
  // Enable build caching features
  experimental: {
    // These settings help with build caching even in static export mode
    // Optimize for static export but still benefit from caching
    optimizePackageImports: ['react', 'react-dom'],
  },
  // Increase the build cache size
  onDemandEntries: {
    // Keep pages in memory for longer during development
    maxInactiveAge: 60 * 60 * 1000, // 1 hour
    // Number of pages to keep in memory
    pagesBufferLength: 5,
  },
  // Improve static generation performance
  staticPageGenerationTimeout: 120, // seconds
}

const withMDX = createMDX({
  // Add markdown plugins here, as desired
})
 
module.exports = withMDX(nextConfig)

// Merge MDX config with Next.js config
export default withMDX(nextConfig)
