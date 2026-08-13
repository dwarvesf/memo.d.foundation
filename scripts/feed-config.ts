// Shared feed-file naming between scripts/generate-rss.ts (writes the
// physical files) and scripts/generate-cf-redirects.ts (writes the alias
// redirects that point at them). One source of truth so a STEP/MIN/MAX
// change can't silently desync the redirect rules from the generated files.
//
// `rss.xml`/`index.xml` used to be separate, byte-identical copies of
// `feed.xml` (a leftover of the old nginx try_files design, see
// docs/adr/0009-handle-limited-feeds.md). generate-rss.ts now writes only
// the canonical `feed`/`atom` files; generate-cf-redirects.ts resolves the
// alias basenames to the canonical one via a 301.

export const FEED_LIMITS = {
  MIN: 10, // Minimum number of items for limited feeds
  MAX: 100, // Maximum number of items for limited feeds
  STEP: 5, // Step for generating different limited feed sizes
};

export const RSS_LIMIT_VARIANTS: number[] = (() => {
  const variants: number[] = [];
  for (let i = FEED_LIMITS.MIN; i <= FEED_LIMITS.MAX; i += FEED_LIMITS.STEP) {
    variants.push(i);
  }
  return variants;
})();

export const RSS_CANONICAL_BASENAME = 'feed';
export const RSS_ALIAS_BASENAMES = ['rss', 'index'] as const;
export const ATOM_BASENAME = 'atom';
