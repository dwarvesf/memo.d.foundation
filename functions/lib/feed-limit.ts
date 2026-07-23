// Pure logic split out of functions/_middleware.ts so it's unit-testable
// without needing the CF Pages runtime or the build-generated redirect map.
//
// Mirrors nginx.custom.conf's $general_limited_feed_path /
// $feed_index_limited_feed_path maps exactly: a valid positive-integer
// `limit` selects that exact pre-generated `{basename}_{limit}.xml` file
// (scripts/generate-rss.ts generates every multiple of 5 from 10 to 100, plus
// the unlimited feed); anything else, missing, zero, negative, or
// non-numeric, defaults to 20, matching the current site's default when no
// `?limit=` is given.
export const FEED_LIMIT_DEFAULT = 20;
const POSITIVE_INT = /^[1-9]\d*$/;

export function feedLimitFilename(
  basename: string,
  limitParam: string | null,
): string {
  const limit =
    limitParam && POSITIVE_INT.test(limitParam)
      ? limitParam
      : String(FEED_LIMIT_DEFAULT);
  return `/${basename}_${limit}.xml`;
}
