## Refactor: Static Page Generation and Path Resolution

This update introduces a significant refactoring of the system that handles static page generation, aliases, and redirects. The primary goal was to simplify logic, improve maintainability, and ensure consistent path resolution across the application.

**Key Changes & Improvements:**

- **Unified Path Resolution:** Introduced a new centralized function, `getStaticJSONPaths` (in `src/lib/content/paths.ts`). This function now serves as the single source of truth for mapping browser-accessible URLs to their corresponding canonical content file paths. It intelligently combines direct markdown file paths, reversed alias mappings, and filtered redirect rules.
- **Simplified Page Generation Logic:** The `getStaticPaths` and `getStaticProps` functions within `src/pages/[...slug].tsx` have been substantially simplified. They now rely entirely on `getStaticJSONPaths` to determine valid static paths and to resolve requested URLs to the correct content files. This reduces complexity and potential inconsistencies.
- **Removal of Unused Static Pages:** As a direct result of the more precise path resolution provided by `getStaticJSONPaths`, pages that are not explicitly defined or resolvable through this new system are no longer generated. This helps in keeping the build lean and focused on relevant content.
- **Robust Redirect and Alias Handling:** The logic for generating Nginx redirects (`getNginxRedirects`) and other redirect mappings (`getRedirectsNotToAliases` in `scripts/common.ts`) has been refactored. This ensures that redirects are handled more robustly, especially in relation to aliases, preventing conflicts and ensuring predictable behavior.
- **Updated Changelog URL:** The navigation link for the Changelog in the sidebar (`src/components/layout/Sidebar.tsx`) has been updated from `/updates/changelog` to `/changelog` for a cleaner URL structure.
