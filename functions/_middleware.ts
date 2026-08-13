// Cloudflare Pages Function: runs for every request to the site. Carries over
// two behaviors from nginx/nginx.custom.conf that a static Pages deploy can't
// do on its own (see docs/cf-migration/pages-deploy.md for the full mapping):
//
//  1. 301 redirects for the FULL alias/redirect/shorten-link map. No rule-count
//     cap here, unlike out/_redirects, which Cloudflare limits to 2,000 static
//     rules; this Function is what actually guarantees no redirect rule is
//     dropped on cutover.
//  2. The `?limit=N` query param on /rss.xml, /atom.xml, /feed.xml,
//     /index.xml, and /feed/index.xml: nginx served one of the pre-generated
//     `{type}_N.xml` static files (scripts/generate-rss.ts generates every N
//     from 10 to 100 in steps of 5, plus the unlimited feed) instead of
//     rendering anything dynamically. This Function reproduces the exact
//     same file selection, still against pre-generated static files, so
//     it's a request rewrite, not a runtime RSS render. `rss`/`index` are
//     aliases of `feed`: generate-rss.ts only writes the `feed`/`atom`
//     files now (see scripts/feed-config.ts), so a request to /rss.xml or
//     /index.xml resolves against the `feed` file here, in-Function,
//     instead of redirecting, since Cloudflare Pages' `_redirects` doesn't
//     document whether it forwards an incoming `?limit=` to the
//     destination and dropping it would silently serve the wrong item
//     count. The literal pre-generated filenames (`/rss_N.xml`,
//     `/index_N.xml`, no query string involved) DO redirect to `/feed_N.xml`
//     via REDIRECT_MAP/`_redirects` instead of keeping a byte-identical
//     copy on disk.
//
// REDIRECT_MAP is generated at build time by scripts/generate-cf-redirects.ts
// (gitignored, not hand-edited).
//
// No @cloudflare/workers-types devDependency is wired in yet, this worktree
// borrows node_modules read-only and cannot pnpm install to add one. The
// loose `any` context/env typing below is a placeholder; add the package and
// tighten these types before the first real deploy.
import { REDIRECT_MAP } from './_generated-redirect-map.js';
import { feedLimitFilename } from './lib/feed-limit.js';
import { OVERSIZE_ASSET_MAP } from './lib/oversize-assets.js';

// `rss` and `index` are aliases of `feed` (scripts/feed-config.ts); only
// `feed`/`atom` are written to disk, so both basenames resolve to the same
// physical `feed_N.xml` file here.
const FEED_BASENAME_ALIASES: Record<string, string> = {
  rss: 'feed',
  index: 'feed',
  feed: 'feed',
  atom: 'atom',
};

async function serveWithFallback(
  assets: { fetch: (req: Request) => Promise<Response> },
  origin: string,
  primaryPath: string,
  fallbackPath: string,
  request: Request,
): Promise<Response> {
  const primary = await assets.fetch(
    new Request(new URL(primaryPath, origin), request),
  );
  if (primary.status !== 404) return primary;
  return assets.fetch(new Request(new URL(fallbackPath, origin), request));
}

export const onRequest = async (context: any): Promise<Response> => {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const { pathname } = url;

  // 5 vault assets exceed Pages' 25 MiB per-file upload limit and are
  // excluded from `out/` at build time (see M4-02-PAGES-CUTOVER-RECORD.md).
  // They were uploaded once to the memo-derived R2 bucket; proxy them
  // through here instead of a redirect, so the bucket can stay private.
  const oversizeKey = OVERSIZE_ASSET_MAP[pathname];
  if (oversizeKey) {
    const object = await env.MEMO_DERIVED.get(oversizeKey);
    if (object === null) return next();
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    return new Response(object.body, { headers });
  }

  const redirectTarget = REDIRECT_MAP[pathname];
  if (redirectTarget && redirectTarget !== pathname) {
    const destination = new URL(redirectTarget, url.origin);
    destination.search = url.search;
    // Same no-cache headers nginx.custom.conf adds on the 301, so clients
    // don't pin a stale redirect if the map changes later.
    return new Response(null, {
      status: 301,
      headers: {
        Location: destination.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  }

  const feedMatch = pathname.match(/^\/(rss|atom|feed|index)\.xml$/);
  if (feedMatch) {
    const canonicalBasename = FEED_BASENAME_ALIASES[feedMatch[1]];
    const limitedPath = feedLimitFilename(
      canonicalBasename,
      url.searchParams.get('limit'),
    );
    return serveWithFallback(
      env.ASSETS,
      url.origin,
      limitedPath,
      `/${canonicalBasename}.xml`,
      request,
    );
  }
  if (pathname === '/feed/index.xml') {
    const limitedPath = feedLimitFilename(
      'feed',
      url.searchParams.get('limit'),
    );
    return serveWithFallback(
      env.ASSETS,
      url.origin,
      limitedPath,
      '/feed.xml',
      request,
    );
  }

  return next();
};
