## RFC: Implementing Dynamic Contributor Profiles with MDX and External Data

**Status:** Proposed

**Context:**

The current contributor page implementation at `src/pages/contributor/[slug].tsx` is functional but rigid. It primarily lists a contributor's memos fetched from our DuckDB `vault`. The vision is far grander: a rich, dynamic profile page bundling information from disparate sources like GitHub, Discord, and crypto wallets, serving as a lasting commemoration of contributions. Our editors, while not Next.js gurus, are comfortable with Markdown. This necessitates a shift towards a more flexible content format that allows for easier authoring and integration of external data, all while adhering to our static export (`output: 'export'`) constraint.

**Decision:**

We will transition the contributor profile pages to use **MDX** as the primary content format. This will be orchestrated via a single dynamic route file, `src/pages/contributor/[...slug].tsx`, which will handle the build-time data fetching from external sources using standard libraries (like Octokit for GitHub). Internal data from the DuckDB `vault` will be queried directly within the MDX files using embedded query blocks. The fetched external data will be passed as props to a dedicated MDX template component, allowing for flexible presentation and easy content updates by non-Next.js experts.

**Detailed Plan and Implementation:**

This isn't just slapping some Markdown together; this is building a data-driven content engine for our most valuable asset: our contributors! The core idea is to leverage Next.js's static generation capabilities to pull all necessary data _before_ the site is deployed, burning it into static HTML pages. No client-side shenanigans for core data display, keeping things fast and reliable.

1.  **File Structure:**
    The main dynamic route handler will reside at `src/pages/contributor/[...slug].tsx`. This file will contain the necessary Next.js data fetching functions for _external_ data. The reusable MDX template for the profile layout will live within the `vault` at `vault/contributors/ContributorProfileTemplate.mdx`. This file will be processed and moved to `public/content/contributors/` during the build, similar to other vault files, and will be imported by the `.tsx` page.

2.  **`next.config.ts` Modifications:**
    We need to tell Next.js to recognize `.mdx` files and process them. This requires adding `'mdx'` to the `pageExtensions` array and integrating a Next.js MDX plugin, such as `@next/mdx`. This is a straightforward config tweak, nothing too spicy.

    ```typescript
    import type { NextConfig } from 'next';
    import withMDX from '@next/mdx'; // Assuming @next/mdx is installed

    const nextConfig: NextConfig = {
      output: 'export',
      trailingSlash: true,
      pageExtensions: ['js', 'jsx', 'md', 'ts', 'tsx', 'mdx'], // Add 'mdx'
      images: {
        unoptimized: true,
      },
      reactStrictMode: true,
      experimental: {
        largePageDataBytes: 1024 * 1024,
      },
    };

    // Merge MDX config with Next.js config
    const withMdxConfig = withMDX({
      // MDX options go here if needed
      extension: /\.mdx?$/,
    })(nextConfig);

    export default withMdxConfig;
    ```

    _Note: You'll need to install `@next/mdx` and potentially other related MDX packages._ This just wires up the compiler; the real magic happens in the data fetching.

3.  **`getStaticPaths` Implementation:**
    This function, located within `src/pages/contributor/[...slug].tsx`, is the gatekeeper. It determines _which_ contributor pages get built. We'll query the DuckDB `vault` to get the definitive list of authors who have contributed memos. This is the single source of truth for generating profile pages.

    ```typescript
    import { GetStaticPaths } from 'next';
    // Assume you have a DuckDB utility function to run queries
    import { queryDuckDB } from '@/lib/db/utils'; // Placeholder utility
    import slugify from 'slugify';

    export const getStaticPaths: GetStaticPaths = async () => {
      // Query DuckDB to get all unique authors
      const authorsResult = await queryDuckDB(`
        SELECT DISTINCT UNNEST(authors) AS author
        FROM vault
        WHERE authors IS NOT NULL;
      `);

      // Extract author names and format them for URLs (slugs)
      const paths = authorsResult.map((row: { author: string }) => ({
        params: { slug: [slugify(row.author, { lower: true, strict: true })] }, // Use slugify for URL-friendly slugs
      }));

      return {
        paths,
        fallback: false, // Essential for static export
      };
    };
    ```

    _This query is the backbone, dynamically generating paths based on actual contributions. No manual path listing needed!_ We'll use `slugify` to ensure the URLs are clean and consistent.

4.  **`getStaticProps` Implementation:**
    This is where we gather all the juicy _external_ data for a specific contributor. For each `slug` (contributor name) identified by `getStaticPaths`, this function runs at build time. It fetches data from external sources using standard libraries.

    ```typescript
    import { GetStaticProps } from 'next';
    // Assume utilities for fetching memo data and external data
    import { getAllMarkdownContents } from '@/lib/content/memo'; // Existing memo utilities (still needed for author name lookup)
    import { Octokit } from '@octokit/rest'; // Assuming octokit is installed

    // Assume ContributorProfileTemplate.mdx exists and is processed by the MDX plugin
    // The MDX plugin will likely provide a way to import the compiled component
    // import ContributorProfileTemplate from '@/components/ContributorProfileTemplate.mdx'; // Conceptual import

    export const getStaticProps: GetStaticProps = async ({ params }) => {
      const { slug } = params as { slug: string[] };
      const contributorSlug = slug[0]; // Assuming a single slug segment for contributor name

      // --- Fetch Contributor Name Casing (from Memos) ---
      const allMemos = await getAllMarkdownContents(); // Fetch all memos to find original name casing
      // Find the original contributor name casing from memos if needed
      const originalContributorName =
        allMemos
          .find(memo =>
            memo.authors?.some(
              author =>
                slugify(author, { lower: true, strict: true }) ===
                contributorSlug,
            ),
          )
          ?.authors?.find(
            author =>
              slugify(author, { lower: true, strict: true }) ===
              contributorSlug,
          ) || contributorSlug; // Fallback to slug if not found

      // --- Fetch External Data (GitHub Example using Octokit) ---
      let githubData = null;
      try {
        // Assuming the contributor slug can be used as a GitHub username
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN }); // Use Octokit
        // Fetch user profile details (username, avatar, bio)
        const { data: githubUser } = await octokit.rest.users.getByUsername({
          username: contributorSlug,
        });
        githubData = githubUser; // Pass the user data
      } catch (error) {
        console.error(
          `Failed to fetch GitHub data for ${contributorSlug}:`,
          error,
        );
        // Handle errors, maybe set githubData to null or an error state
      }

      // --- Fetch Other External Data (Discord, Crypto, etc.) ---
      // This would involve calling other APIs here (MCP tools are not used in the spec doc)
      let discordData = null; // Placeholder
      let cryptoData = null; // Placeholder

      // Note: Internal data (like memos from DuckDB) will be fetched directly within the MDX file
      // using embedded dsql-list blocks, not here in getStaticProps.

      return {
        props: {
          // Pass layout props (assuming getRootLayoutPageProps is adapted)
          // ...await getRootLayoutPageProps(), // Need to figure out how layout props integrate
          contributorName: originalContributorName, // Pass the original name for display
          githubData, // Pass fetched GitHub data
          discordData, // Pass fetched Discord data
          cryptoData, // Pass fetched crypto data
          // Any other data needed by the MDX template
        },
      };
    };
    ```

    *This is the data aggregation point for *external* data. We're pulling from external APIs using standard libraries like Octokit. It's like building a contributor data fusion reactor!* Error handling is crucial here; external APIs can be flaky. Internal data (memos) will be handled differently, directly within the MDX.

5.  **MDX Template Structure (`vault/contributors/ContributorProfileTemplate.mdx`):**
    This file is the canvas. It uses Markdown for static text and JSX components to render the dynamic data passed from `getStaticProps`. Crucially, it will also embed **DuckDB queries** using the ````dsql-list` syntax, allowing memo data to be fetched directly within the content file itself.

    `````mdx
    import { ContributorHeader } from '@/components/ContributorHeader';
    import { GitHubActivity } from '@/components/GitHubActivity';
    import { MemoList } from '@/components/MemoList';
    // Import other components for Discord, Crypto, etc.

    {/* No component export or return needed in the MDX content file itself */}

    <ContributorHeader name={props.contributorName} />
    {/* Access data via props */}

    ## About {props.contributorName}

    {/* Static bio content can go here, or maybe fetched from a new field in vault/authors? */}
    This is the profile page for {props.contributorName}, a valued contributor to the Dwarves Brainery.

    ## Contributions

    ### Memos

    {/* DuckDB query embedded directly in MDX to list memos by this author */}
    {/* The build process needs to be configured to execute these blocks */}

    ```dsql-list
    SELECT markdown_link(COALESCE(short_title, title), file_path)
    FROM vault
    WHERE ARRAY_CONTAINS(authors, '${props.contributorName}') -- Assuming authors is an array and contributorName is the exact name
    ORDER BY date DESC;
    ```
    `````

    ### GitHub Activity

    {props.githubData ? (
    <GitHubActivity data={props.githubData} />
    ) : (
      <p>Could not load GitHub activity for {props.contributorName}.</p>
    )}

    {/_ Add sections for Discord, Crypto, etc. using similar conditional rendering _/}

    {/_ More static MDX content or components _/}

    `````
    *This is where the magic happens visually. Markdown for prose, components for data, and embedded DuckDB queries for internal data! Simple, powerful.* The components (`ContributorHeader`, `GitHubActivity`, `MemoList`) will need to be created or adapted to accept and display the specific data structures passed to them. Note that `MemoList` might not be needed if the DuckDB query block renders the list directly, or it might be used to format the results of the query block. This needs to be aligned with how the ````dsql-list` processing works. Data passed from `getStaticProps` in the `.tsx` file will be available to components in the MDX file, typically via a `props` object or context.

    `````

6.  **Page Component (`src/pages/contributor/[...slug].tsx` default export):**
    The default export in the `.tsx` file will be a standard React component that receives the props from `getStaticProps` and renders the MDX template component, passing the data along.

    ```typescript
    import React from 'react';
    // Import the compiled MDX component - the exact import depends on the MDX plugin setup
    import ContributorProfileTemplate from '@/components/ContributorProfileTemplate.mdx'; // Assuming it's copied/processed to components
    // Import layout components and types
    import { RootLayout } from '@/components';
    import { RootLayoutPageProps } from '@/types'; // Removed IMemoItem as memos are fetched in MDX

    interface ContributorPageProps extends RootLayoutPageProps {
      contributorName: string;
      githubData: any; // Define a proper type later
      discordData: any; // Define a proper type later
      cryptoData: any; // Define a proper type later
      // Include other layout props like directoryTree, searchIndex
      directoryTree: any; // Placeholder
      searchIndex: any; // Placeholder
    }

    export default function ContributorPage(props: ContributorPageProps) {
      // Pass all relevant props to the MDX template component
      return (
        <RootLayout
          title={`${props.contributorName}'s Profile`}
          directoryTree={props.directoryTree}
          searchIndex={props.searchIndex}
          // Pass other layout props as needed
        >
          <ContributorProfileTemplate {...props} />
        </RootLayout>
      );
    }
    ```

    _This component is just the glue, connecting the fetched external data to the presentation layer._ It wraps the MDX content in the standard site layout. Internal memo data is handled within the MDX itself.

**Integration with Current Setup:**

This new system is designed to be **incrementally integrated**. It lives in its own directory (`src/pages/contributor/`) and handles a specific route pattern. Your existing `src/pages/[...slug].tsx` file and the markdown processing pipeline in `src/lib/content/markdown.ts` will continue to function exactly as they do now for all other `.md` files. The addition to `next.config.ts` is additive, enabling `.mdx` processing without altering `.md` handling. It's like adding a new specialized tool to the toolbox without changing how the existing tools work. The key change is adapting the build process to recognize and execute the ````dsql-list` blocks within `.mdx` files and ensuring the MDX processing pipeline handles this correctly.

**Alternatives Considered:**

We briefly considered creating a separate MDX file _manually_ for each contributor. This is clearly suboptimal. Generating pages dynamically from the DuckDB author list is the only sane way to scale this. Manual files would be a maintenance nightmare, requiring updates every time a new contributor publishes a memo. Automating path generation from the data source is non-negotiable for a project like this. Keeping all data fetching in `getStaticProps` was also considered, but embedding DuckDB queries in MDX consolidates data modeling closer to content, which is a win for maintainability, assuming the build pipeline can support it.

**Consequences:**

- **Benefits:**
  - **Flexibility:** The editors can easily update contributor bios and page layouts using familiar Markdown syntax, embedding rich components where needed. This is a massive win for content velocity!
  - **Richer Profiles:** We can finally integrate external data, making these profiles actual hubs of contributor activity, not just memo lists. GitHub commits, Discord stats, maybe even NFT galleries – the possibilities are vast!
  - **Maintainability:** A single MDX template and data-fetching logic are easier to manage than individual `.tsx` files per contributor. Consolidating DuckDB queries in MDX improves maintainability for internal data.
- **Drawbacks:**
  - **Build Time:** Fetching data from external APIs at build time will increase build duration. This is the cost of static richness. We'll need to monitor this and potentially implement caching strategies if it becomes excessive.
  - **Dependency on External APIs:** The build process now relies on the availability and responsiveness of external services. Failures here will break the build. Robust error handling in `getStaticProps` is essential.
  - **Complexity:** While MDX simplifies content authoring, the underlying data fetching and integration logic in `getStaticProps` is more complex than the current simple markdown processing. Adapting the build pipeline to execute embedded DuckDB queries in MDX adds another layer of complexity that needs careful implementation.

This plan sets us up for dynamic, data-rich contributor profiles that are easy to update and maintain. It's a significant upgrade that respects our static export architecture and empowers content creators. Let's build this thing!
