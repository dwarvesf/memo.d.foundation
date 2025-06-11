import { MochiUserProfile } from '@/types/user';

// In-memory cache for contributor profiles (stores both promises and resolved values)
const profileCache = new Map<
  string,
  Promise<MochiUserProfile | null> | MochiUserProfile | null
>();

const MOCHI_PROFILE_API = process.env.MOCHI_PROFILE_API;

/**
 * Internal function to fetch profile from API
 */
async function fetchProfileFromAPI(
  contributorSlug: string,
): Promise<MochiUserProfile | null> {
  try {
    const response = await fetch(`${MOCHI_PROFILE_API}/${contributorSlug}`, {
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch profile for GitHub user ${contributorSlug}: ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.warn((error as Error).message);
    return null;
  }
}

/**
 * Fetches the contributor's profile from their GitHub username with promise memoization
 * @param contributorSlug GitHub username
 * @returns Promise<MochiUserProfile | string> - Returns profile object on success, username string on failure
 */
export async function fetchContributorProfile(
  contributorSlug: string,
): Promise<MochiUserProfile | null> {
  const cacheKey = contributorSlug.toLowerCase();

  // Check if we have a cached result (either resolved value or promise)
  const cached = profileCache.get(cacheKey);
  if (cached) {
    // If it's already a resolved value, return it
    if (!(cached instanceof Promise)) {
      return cached;
    }
    // If it's a promise, await it
    return cached;
  }

  // Create and cache the promise immediately to prevent race conditions
  const promise = fetchProfileFromAPI(contributorSlug);
  profileCache.set(cacheKey, promise);

  // Await the result and replace the promise with the resolved value
  try {
    const result = await promise;
    profileCache.set(cacheKey, result);
    return result;
  } catch (error) {
    // Remove failed promise from cache to allow retries
    profileCache.delete(cacheKey);
    throw error;
  }
}

/**
 * Fetches multiple contributor profiles concurrently with memoization
 * @param contributorSlugs Array of GitHub usernames
 * @returns Promise<Array<ContributorProfile | string>>
 */
export async function fetchContributorProfiles(
  contributorSlugs: string[],
): Promise<Array<MochiUserProfile | null>> {
  return Promise.all(
    contributorSlugs.map(slug => fetchContributorProfile(slug)),
  );
}

/**
 * Clears the contributor profile cache
 */
export function clearContributorProfileCache(): void {
  profileCache.clear();
}

/**
 * Gets the current cache size
 */
export function getProfileCacheSize(): number {
  return profileCache.size;
}
