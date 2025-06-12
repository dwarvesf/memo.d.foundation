# Fix: Improved Contributor Profile Memoization with Promise Caching

## Problem Solved

The previous contributor profile memoization implementation had a critical race condition issue. When multiple asynchronous requests were made for the same contributor simultaneously, they could all bypass the cache and hit the API before any completed, defeating the purpose of memoization.

**Race Condition Example:**

```
Time 1: fetchContributorProfile("john") starts - cache miss, API call begins
Time 2: fetchContributorProfile("john") starts - cache still empty, second API call begins
Time 3: Both API calls complete, both cache results separately
```

This led to:

- Multiple API calls for the same contributor
- Potential API overload during builds
- Ineffective rate limiting protection

## Solution Implemented

Switched from **result memoization** to **promise memoization**:

### Before (Result Memoization)

```typescript
// Cache only stored resolved values
const cache = new Map<string, MochiUserProfile | string>();

// Race condition: multiple calls could bypass empty cache
if (cache.has(key)) return cache.get(key);
const result = await fetchFromAPI();
cache.set(key, result);
```

### After (Promise Memoization)

```typescript
// Cache stores both promises and resolved values
const cache = new Map<
  string,
  Promise<MochiUserProfile | string> | MochiUserProfile | string
>();

// Immediate promise caching prevents race conditions
const cached = cache.get(key);
if (cached) return cached instanceof Promise ? await cached : cached;

const promise = fetchFromAPI();
cache.set(key, promise); // Cached immediately!
```

## Key Improvements

1. **Race Condition Eliminated**: Promise is cached immediately, ensuring concurrent requests share the same API call
2. **Dual Caching Strategy**:
   - Initially caches the Promise (prevents races)
   - Later replaces with resolved value (optimizes subsequent calls)
3. **Error Handling**: Failed promises are removed from cache to allow retries
4. **API Protection**: Guarantees only one API call per unique contributor during build

## Technical Details

The implementation uses a hybrid approach:

- **Phase 1**: Cache the Promise immediately when first requested
- **Phase 2**: Replace Promise with resolved value after completion
- **Concurrent Access**: Multiple callers await the same cached Promise
- **Error Recovery**: Failed requests are removed from cache for retry capability

## Impact

- **Reduced API Load**: Eliminates duplicate concurrent requests
- **Better Build Reliability**: Prevents API overload during contributor page builds
- **Improved Performance**: Faster resolution for concurrent requests
- **Maintained Flexibility**: Still allows retries on failed requests

This fix ensures the contributor profile fetching is both efficient and reliable during static site generation.
