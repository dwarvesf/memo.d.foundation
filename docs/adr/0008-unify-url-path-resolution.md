# Unify URL Path Resolution System

## Status

Accepted

## Context

The application uses multiple path resolution mechanisms for handling URLs in different contexts (client-side navigation, server-side rendering, backlinks). This led to inconsistencies where the same content could be accessed through different URLs, potentially causing SEO issues and user confusion.

Problems identified:

1. Different path resolution logic between client and server side
2. Inconsistent handling of redirects across different parts of the application
3. Backlinks not properly resolving to canonical URLs
4. Redundant path normalization code scattered across the codebase

## Decision

Create a unified path resolution system that handles URL transformations consistently across all parts of the application.

Key components:

1. Server-side redirect path resolution

   - Centralized function `getServerSideRedirectPath` to handle URL transformations during build time
   - Uses static JSON paths mapping to resolve canonical URLs

2. Client-side redirect path resolution

   - New function `getClientSideRedirectPath` to handle URL transformations during runtime
   - Unified redirects map injected into global window object during initial page load

3. Path normalization utilities

   - Standardized functions for path manipulation (removing trailing slashes, handling special characters)
   - Consistent slash normalization across the application

4. Backlinks resolution enhancement
   - New `getRedirectsBackLinks` function to ensure backlinks point to canonical URLs
   - Memoized implementation for performance optimization

## Consequences

### Positive

1. Consistent URL handling across the entire application
2. Improved SEO by ensuring content is accessible through canonical URLs
3. Better developer experience with centralized path resolution logic
4. Reduced code duplication in path handling
5. More reliable backlinks that respect URL redirects

### Negative

1. Additional complexity in initial page load with injected redirects map
2. Slightly increased bundle size due to client-side redirect handling
3. Need to maintain two separate path resolution systems (client/server)

### Neutral

1. Requires careful testing of URL handling in all application contexts
2. May need periodic review of redirect maps for optimization

## Implementation Notes

1. Server-side path resolution implemented in `src/lib/content/utils.ts`
2. Client-side handling in `src/lib/utils/path-utils.ts`
3. Global redirects map injected via `_document.tsx`
4. Backlinks enhancement in `src/lib/content/paths.ts`
