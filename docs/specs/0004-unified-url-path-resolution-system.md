# Specification: Unified URL Path Resolution System

## 1. Introduction

This document outlines the requirements and design for a unified URL path resolution system. The goal is to ensure consistent URL handling across client-side navigation, server-side rendering, markdown link processing, and backlink generation, particularly in the context of content aliases and redirects.

## 2. Goals

- Establish a single source of truth for URL redirects (aliases).
- Ensure all internal links, regardless of origin (user navigation, markdown content, programmatic generation), resolve to the canonical URL.
- Improve SEO by consistently serving content under a single, canonical URL.
- Enhance user experience by providing faster and more reliable navigation, especially for aliased content.
- Simplify developer experience by centralizing path resolution logic.

## 3. Requirements

### 3.1. Functional Requirements

- **Redirect Map**: A global redirect map (aliases.json) will define all source-to-target URL mappings.
- **Client-Side Resolution**: The client-side router and any path generation utilities must use the redirect map to resolve final URLs before navigation or display.
- **Server-Side Resolution (Build Time)**: During static site generation, all paths (markdown links, menu items, sitemap entries) must be resolved to their canonical forms using the redirect map.
- **Server-Side Resolution (Runtime - if applicable)**: Any server-rendered pages or API routes generating URLs must use the redirect map.
- **Path Normalization**: All paths must be normalized (e.g., consistent trailing slashes, case sensitivity if applicable, encoding) before lookup in the redirect map and before being used for navigation or linking.
- **Backlink Integrity**: Backlinks must be generated based on the canonical URLs of the linking and linked-to pages.

### 3.2. Non-Functional Requirements

- **Performance**: Client-side resolution should be performant to not degrade navigation speed. The redirect map should be efficiently loaded and accessed.
- **Maintainability**: The system should be easy to understand, maintain, and extend.
- **Accuracy**: The system must accurately resolve all paths according to the defined redirects.

## 4. Design

### 4.1. Redirect Map (`public/content/aliases.json`)

- A JSON file mapping source paths (aliases) to target canonical paths.
- Example: `{"old/path": "/new/canonical/path", "shortlink": "/full/path/to/content"}`
- Paths in this map should be relative to the domain root (e.g., `/my/page`).

### 4.2. Client-Side Implementation

- **Global Redirect Object**: On application load, `aliases.json` is fetched (or embedded at build time) and transformed into a JavaScript object accessible globally (e.g., `window._app_unified_redirects`). This map will store `target: source` for efficient lookup if needed, but primarily `source: target`.
- **`getClientSideRedirectPath(url)` function** (`src/lib/utils/path-utils.ts`):
  - Takes a raw URL string.
  - Normalizes the URL (e.g., ensures leading slash, removes trailing slash, handles encoding).
  - Looks up the normalized URL in `window._app_unified_redirects`.
  - Returns the target URL if a redirect exists, otherwise returns the normalized original URL.
- **Integration**: This function will be used in:
  - `CommandPalette.tsx` for navigation.
  - `formatContentPath` to ensure generated URLs from file paths are canonical.
  - Potentially other UI components that perform navigation.

### 4.3. Server-Side (Build-Time) Implementation

- **`getStaticJSONPaths()` function** (`src/lib/content/paths.ts`):
  - Reads `aliases.json` during build.
- **`getServerSideRedirectPath(url, staticJSONPaths)` function** (`src/lib/content/utils.ts`):
  - Takes a raw URL string and the pre-loaded `staticJSONPaths`.
  - Normalizes the URL.
  - Looks up the normalized URL in `staticJSONPaths`.
  - Returns the target URL if a redirect exists, otherwise returns the normalized original URL.
- **Markdown Processing (`src/lib/content/markdown.ts`)**:
  - The `remarkProcessLinks` plugin will use `getServerSideRedirectPath` to resolve all `<a>` href attributes within markdown content to their canonical forms.
- **Static Page Generation (`src/pages/[...slug].tsx`)**:
  - `getStaticProps` will use `getServerSideRedirectPath` to ensure the page is generated for the canonical slug if an alias is requested.
  - It will also use this function when determining folder paths for metadata.
- **Backlink Generation (`scripts/generate-backlinks.ts` and `src/lib/content/paths.ts`)**:
  - The `getRedirectsBackLinks` function will ensure that backlinks are mapped from and to canonical URLs, using the `staticJSONPaths`.

### 4.4. Path Normalization

- **`normalizePathWithSlash(pathString)`**: Ensures path starts with `/` and does not end with `/` (unless it's the root `/`). Also removes redundant symbols like quotes.
- This utility will be used consistently before any redirect lookup or path comparison.

## 5. Affected Files (Summary from Commit)

- `src/components/layout/CommandPalette.tsx`: Uses `getClientSideRedirectPath`.
- `src/lib/content/markdown.ts`: `remarkProcessLinks` uses `getServerSideRedirectPath` and `aliasJSONPaths`.
- `src/lib/content/paths.ts`: Introduces `getRedirectsBackLinks` and modifies `getStaticJSONPaths`.
- `src/lib/content/utils.ts`: Introduces `getServerSideRedirectPath` and uses it in `transformMenuDataToDirectoryTree`.
- `src/lib/utils/path-utils.ts`: Introduces `getClientSideRedirectPath`, `normalizePathWithSlash` and uses client-side redirect in `formatContentPath`.
- `src/pages/[...slug].tsx`: Uses `getServerSideRedirectPath` and `getRedirectsBackLinks`.
- `src/pages/_document.tsx`: Injects `_app_unified_redirects` into the `window` object.

## 6. Testing Considerations

- Test navigation from various sources (direct URL, command palette, internal links) for aliased and non-aliased paths.
- Verify markdown links resolve correctly to canonical URLs.
- Check backlink accuracy for pages involved in redirects.
- Ensure server-side rendering and static generation use canonical paths.
- Performance testing for client-side redirect map loading and lookup.
