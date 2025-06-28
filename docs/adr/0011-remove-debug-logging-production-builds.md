# Remove Debug Logging from Production Builds

## Status

Accepted

## Context

During investigation of build time optimization for the CI/CD pipeline, we discovered that the `pnpm next-build` command was producing extremely verbose output that was impacting build performance and log readability.

**Problem Identified:**

- Build logs were showing massive amounts of contributor data during static site generation
- Output included thousands of lines of JSON containing contributor profiles, GitHub URLs, avatars, company information, and contribution counts
- This verbose logging was contributing to slower CI/CD pipelines and making build monitoring difficult

**Root Cause Analysis:**
Investigation using systematic debugging revealed the source was a `console.log` statement in `src/pages/contributor/index.tsx` at lines 134-138:

```typescript
console.log({
  contributorLatestWork,
  contributors,
  contributionCount,
});
```

This debug statement executes during Next.js static site generation and outputs large datasets containing detailed contributor information.

## Decision

Remove debug logging statements from production builds, specifically:

1. Comment out the verbose `console.log` statement in the contributor index page
2. Establish principle of avoiding debug logging in production code paths
3. Use conditional logging when debug information is needed during development

## Rationale

- **Build Performance**: Reduces I/O overhead during build process
- **Log Clarity**: Makes build logs more readable and easier to monitor
- **CI/CD Efficiency**: Potentially reduces build time and log storage requirements
- **Debugging Efficiency**: Eliminates noise when investigating actual build issues

## Consequences

### Positive

- Cleaner, more readable build logs
- Reduced I/O overhead during static site generation
- Easier build monitoring and debugging
- Improved CI/CD pipeline efficiency

### Negative

- Loss of debug information that might have been useful for development
- Need to implement proper conditional logging for future debugging needs

### Neutral

- Establishes precedent for production code hygiene
- May require review of other components for similar issues

## Implementation

- Modified `src/pages/contributor/index.tsx` to comment out the verbose logging
- Added explanatory comment about verbosity reduction
- Change is immediately effective for all subsequent builds

## Future Considerations

- Implement environment-based conditional logging for development debugging
- Review other components for similar verbose logging patterns
- Consider build-time optimization strategies for the underlying performance bottleneck (3,228 static pages taking 50% of build time)
