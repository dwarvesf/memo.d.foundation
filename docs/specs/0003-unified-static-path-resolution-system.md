# Specification: Unified Static Path Resolution System

**Version:** 1.0
**Date:** 2025-05-28

## 1. Introduction

This document outlines the specification for a refactored system to handle static page generation, URL aliasing, and redirects. The primary objective is to create a unified, maintainable, and predictable mechanism for mapping browser-accessible URLs to their corresponding content files.

## 2. Goals

- Centralize path resolution logic.
- Simplify the `getStaticPaths` and `getStaticProps` implementations in Next.js.
- Ensure consistent handling of direct file paths, aliases, and redirects.
- Reduce redundancy in path management code.
- Implicitly prevent the generation of unused static pages by relying on a definitive set of resolvable paths.

## 3. System Architecture

The core component of the new system is the `getStaticJSONPaths` function, located in `src/lib/content/paths.ts`.

### 3.1. `getStaticJSONPaths` Function

- **Purpose:** To generate a comprehensive mapping of all valid browser-accessible paths to their canonical content file paths.
- **Output:** `Promise<Record<string, string>>`
  - Keys: Normalized browser-accessible paths (e.g., `/my-blog-post`, `/alias/to/content`). Paths will be slash-prefixed and have no trailing slash.
  - Values: Normalized canonical content file paths relative to the content root (e.g., `/blog/my-post`, `/actual/folder/content-file`). Paths will be slash-prefixed and have no trailing slash.
- **Logic:**
  1.  **Fetch Raw Data:**
      - Read `redirects.json` to get redirect rules (`getRedirectsNotToAliases` from `scripts/common.ts` will be used to pre-filter redirects that might conflict with or are superseded by aliases).
      - Read `aliases.json` to get alias rules (`getReversedAliasPaths` from `scripts/common.ts` will be used to get a mapping of `target -> alias`).
      - Scan the `public/content` directory to get all markdown/MDX file paths (`getAllMarkdownFiles` from `scripts/common.ts`), excluding specified directories like `contributor/` and `tags/`.
  2.  **Path Normalization:** All paths (keys and values) will be normalized:
      - Ensure they start with a `/`.
      - Ensure they do not end with a `/` (unless it's the root path `/`).
  3.  **Processing Order & Precedence:**
      - **Markdown Files:** Direct markdown file paths form the base set of canonical content.
      - **Aliases:** Alias paths (keys from the reversed alias map) will map to their corresponding original content paths (values from the reversed alias map). These effectively create alternative URLs for existing content.
      - **Redirects:** Redirect source paths will map to their target paths. If a redirect target is an alias, it should resolve to the alias's canonical content path. Redirects should not overwrite existing direct markdown paths or alias paths if the source of the redirect is already a valid content path or alias.
  4.  **Output Generation:** Combine these sources into a single record, ensuring that aliases and redirects correctly point to the final canonical content path.

### 3.2. Next.js Page Generation (`src/pages/[...slug].tsx`)

- **`getStaticPaths`:**
  - Will call `getStaticJSONPaths()` once.
  - The keys of the returned record will be transformed into the `paths` array required by Next.js.
- **`getStaticProps`:**
  - Will call `getStaticJSONPaths()` once.
  - The `slug` from `params` will be used to look up the canonical content file path from the record returned by `getStaticJSONPaths`.
  - If the requested path is not found as a key in the map, it implies a 404 (though Next.js handles this if not in `getStaticPaths`).
  - The resolved canonical path will be used to fetch the markdown content.

### 3.3. Scripting (`scripts/common.ts`)

- **`getNginxRedirects`:** This function will be updated to use `getStaticJSONPaths` or a similar underlying filtered redirect list to ensure Nginx redirect rules are consistent with the application's path resolution.
- **`getRedirectsNotToAliases`:** This utility will help in pre-filtering redirects before they are consumed by `getStaticJSONPaths` to avoid conflicts where a redirect source might also be an alias target.
- **`getReversedAliasPaths`:** This utility provides the `target -> alias` mapping crucial for `getStaticJSONPaths`.

## 4. Path Resolution Examples

Assume `public/content/blog/my-article.md` exists.
Assume `aliases.json`: `{ "/latest-post": "/blog/my-article" }`
Assume `redirects.json`: `{ "/old-post-url": "/latest-post" }`

`getStaticJSONPaths` would produce (among others):

- `"/blog/my-article": "/blog/my-article"`
- `"/latest-post": "/blog/my-article"` (from reversed alias)
- `"/old-post-url": "/blog/my-article"` (redirect resolves through alias to canonical)

## 5. UI Changes

- The changelog link in `src/components/layout/Sidebar.tsx` will be updated from `/updates/changelog` to `/changelog` to reflect a cleaner URL structure, which should be a path resolvable by the new system.

## 6. Non-Goals

- Dynamic server-side redirects beyond what Nginx handles.
- Client-side redirect logic (Next.js handles this based on `getStaticPaths`).

## 7. Future Considerations

- Performance of `getStaticJSONPaths` if the number of files, aliases, or redirects becomes extremely large.
- More sophisticated conflict resolution strategies for paths if needed.
