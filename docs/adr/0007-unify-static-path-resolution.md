# ADR: Unify Static Path Resolution for Markdown Content

**Date:** 2025-05-28

**Status:** Accepted

**Context:**

The previous system for handling static page generation involved disparate logic for resolving direct file paths, aliases, and redirects. This was spread across `getStaticPaths` and `getStaticProps` in `src/pages/[...slug].tsx`, and various helper functions in `scripts/common.ts` and `src/lib/content/paths.ts`. This led to:

- Increased complexity in understanding how a URL maps to a content file.
- Potential inconsistencies in path resolution.
- Difficulty in maintaining and extending the system.
- Generation of potentially unused static pages if not carefully managed.

**Decision:**

We decided to refactor the static path resolution mechanism to centralize and unify the logic. The core of this decision is the introduction of a new function, `getStaticJSONPaths` (located in `src/lib/content/paths.ts`).

This function will be responsible for:

1.  Aggregating all valid content paths from markdown files (excluding specific directories like `contributor` and `tags`).
2.  Incorporating reversed alias mappings (where the alias target becomes the key and the alias path becomes the value).
3.  Applying redirect rules, ensuring they don't conflict with aliases and correctly point to canonical content paths.
4.  Providing a single, comprehensive `Record<string, string>` where keys are browser-accessible paths (e.g., `/my-alias/page`) and values are the corresponding canonical content file paths (e.g., `/actual-folder/actual-page`).

The `getStaticPaths` and `getStaticProps` functions in `src/pages/[...slug].tsx` will be simplified to consume the output of `getStaticJSONPaths` directly. This makes them solely responsible for using this mapping to generate static pages and fetch content, rather than performing complex resolution logic themselves.

Helper functions in `scripts/common.ts` for generating Nginx redirects and other path mappings will also be refactored to align with this unified approach, ensuring consistency between server-side redirects and application-level path resolution.

**Consequences:**

- **Pros:**
  - **Simplified Logic:** Path resolution logic is now centralized, making it easier to understand, debug, and maintain.
  - **Improved Consistency:** Ensures that all parts of the system (static generation, client-side navigation, server-side redirects) use the same source of truth for path mapping.
  - **Reduced Redundancy:** Eliminates duplicate path resolution logic.
  - **Leaner Builds:** By relying on a definitive list of resolvable paths, we implicitly avoid generating unused static pages.
  - **Easier Extensibility:** Adding new types of path mappings or modifying existing ones becomes more straightforward by targeting the `getStaticJSONPaths` function.
- **Cons:**
  - The `getStaticJSONPaths` function becomes a critical piece of infrastructure; any bugs here will have a wide impact.
  - Initial refactoring requires careful testing to ensure all edge cases for aliases and redirects are handled correctly.

**Rationale:**

The previous approach was becoming increasingly difficult to manage as the number of aliases, redirects, and content files grew. A unified system provides a more robust and scalable foundation for handling content paths. This change prioritizes maintainability and predictability in how URLs are resolved to content.
