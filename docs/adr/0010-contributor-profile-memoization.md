# ADR: Contributor Profile Fetching with Memoization

## Status

Accepted

## Context

The application fetches contributor profiles from the Mochi API endpoint during build time. This API can become overloaded and respond with 500 errors when receiving too many concurrent requests, which happens when building the contributor pages.

The original implementation had duplicate `fetchContributorProfile` functions across different pages, leading to:

- Code duplication
- No caching mechanism
- Potential API overload during builds
- Risk of hitting rate limits

## Decision

We will create a centralized utility (`src/lib/contributor-profile.ts`) that:

1. **Centralizes profile fetching logic**: Single source of truth for contributor profile fetching
2. **Implements in-memory memoization**: Cache profiles during build process to avoid repeated API calls
3. **Provides batch fetching**: `fetchContributorProfiles()` function for concurrent operations
4. **Handles errors gracefully**: Falls back to username string on API failures
5. **Includes cache management**: Functions to clear cache and monitor cache size

## Implementation Details

### Cache Strategy

- **Storage**: In-memory Map for build-time caching
- **Key**: Lowercase username for case-insensitive caching
- **Persistence**: Cache persists only during the build process
- **Fallback caching**: Even failed requests are cached to prevent repeated failures

### API Interface

```typescript
// Single profile fetch with memoization
fetchContributorProfile(contributorSlug: string): Promise<ContributorProfile | string>

// Batch profile fetch
fetchContributorProfiles(contributorSlugs: string[]): Promise<Array<ContributorProfile | string>>

// Cache management
clearContributorProfileCache(): void
getProfileCacheSize(): number
```

## Consequences

### Positive

- **Reduced API load**: Memoization prevents duplicate requests during builds
- **Better reliability**: Cached failed requests prevent retry storms
- **Code reusability**: Single utility can be used across all pages
- **Performance**: Faster subsequent builds due to caching
- **Maintainability**: Centralized error handling and retry logic

### Negative

- **Memory usage**: Cache consumes memory during build process
- **Build-time only**: Cache doesn't persist between separate build processes

### Neutral

- **Migration effort**: Required updating existing pages to use new utility
- **Simplified caching**: Simple in-memory cache without time-based expiry

## Alternatives Considered

1. **Database caching**: Too complex for build-time scenario
2. **File-based caching**: Would require disk I/O and cleanup logic
3. **External caching service**: Overkill for this use case
4. **Rate limiting**: Would slow down builds significantly

## Monitoring

- Cache hit rates can be monitored via `getProfileCacheSize()`
- API errors are logged with original error context
- Failed requests are cached to prevent repeated failures
