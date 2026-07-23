# CF-N.9 + CF-N.10: comments + search, usage-evidence decisions

Sub-goal 09 of the memo-track (M4) mega-goal. No infra was built; this records
two evidence-based decisions and the two doc-drift lines they surfaced.

## CF-N.9: comments

**Finding: there is no comments Worker.** The roadmap row assumed a "dormant
comments worker" to export or rebuild; grepping the repo (`comment`, `giscus`,
`utterances`) found no Cloudflare Worker at all. Comments are a third-party
client-side widget:

- `src/components/layout/GiscusComments.tsx`, rendered unconditionally on
  every content page (`src/pages/[...slug].tsx:597`).
- It injects `https://giscus.app/client.js`, which talks directly to GitHub
  Discussions on the public repo `dwarvesf/memo-comments`. No backend of ours
  is in the request path; Cloudflare was never involved.
- `docs/specs/0001-contributor-mdx-profiles.md` still references an older
  `UtterancComments` component (Utterances instead of Giscus). That component
  no longer exists in `src/` (confirmed via `find`), so the widget was already
  swapped once before with zero infra impact either time. The spec reference
  is a stale plan doc, not dead source code; left alone (not this sub-goal's
  scope).

**Usage evidence** (GitHub GraphQL against `dwarvesf/memo-comments`, 2026-07-23):

| Metric | Value |
|---|---|
| Discussions (1 per page Giscus has touched) | 16, spanning 2025-07 to 2025-12 |
| Total comments across all 16 | 3 |
| Total reactions across all 16 | 19 |

Giscus auto-creates a discussion the first time a page is viewed with the
widget mounted, so 16 discussions is a page-visit count, not an engagement
count. Actual engagement (someone typing a comment) is 3 comments over ~10
months across the whole site.

**Decision: no migration work, leave as-is.** There is nothing to export,
retire, or rebuild as a Worker+D1 backend, because nothing here was ever on
Cloudflare's plate. Building a Worker+D1 comments backend is explicitly
usage-gated per the roadmap contract ("only if usage evidence says wanted");
3 comments in 10 months does not clear that bar. `GiscusComments.tsx` stays
exactly as it is: it costs zero Cloudflare infra today and needs zero changes
to keep working once the site is on Pages (it's a client-side script tag
pointed at an external host).

## CF-N.10: search

**Finding: search is fully client-side MiniSearch, already zero-infra.**

- `src/components/search/SearchProvider.tsx` loads a static
  `public/content/search-index.json` (falls back to a fetch of the same path)
  and runs all querying in the browser via the `minisearch` package. No
  server round-trip, no Worker.
- The index is produced at build time by `scripts/generate-search-index.ts`
  from `db/vault.parquet`, confirmed live in `docs/cf-migration/build-inventory.md`
  (PR #302): 1518 docs, MiniSearch, "no gap" against a Pages deploy.
- Semantic embeddings (`embeddings_gemini`, `embeddings_spr_custom`) already
  exist in the committed `db/vault.parquet` (per #302), which is what would
  back a Vectorize upgrade. But per that same finding they are **~9 months
  stale** (last regenerated 2025-10-22, via a manually-triggered Elixir GH
  Action, no scheduled refresh).

**Weighing MiniSearch vs. Vectorize:**

| | MiniSearch (current) | Vectorize |
|---|---|---|
| Infra | None (static JSON, client-side) | New Worker route + provisioned Vectorize index |
| Data freshness | Rebuilt every content build | Would index the current 9mo-stale embeddings; needs the refresh pipeline fixed first or it ships stale semantic search |
| Works today | Yes | No, needs building |
| Usage signal for upgrading | None found (no "search is broken" / "we need semantic search" evidence) | n/a |

**Decision: keep MiniSearch.** Per minimum-infra-first, the default holds:
nothing here regresses on Pages, and no usage evidence calls for semantic
search. A future Vectorize upgrade is gated on making the embeddings-refresh
pipeline reliable first (today it's manual-dispatch-only and already stale);
doing Vectorize on top of stale embeddings would make search worse, not
better. No code change for search beyond the doc-drift fix below.

## What changed

Two one-line doc corrections only (surfaced while verifying the search
finding above), no product code:

- `CLAUDE.md`: "Client-side search uses Fuse.js" corrected to MiniSearch,
  the actual dependency (`src/components/search/SearchProvider.tsx` imports
  `minisearch`; `Fuse.js` does not appear anywhere else in the repo). Pure
  doc-accuracy fix, in-scope because it's the exact fact this sub-goal had
  to verify.

No comments/search source code changed: both implementations are already the
minimum-infra shape the roadmap's default calls for.

## Notes

- Evidence for CF-N.9 came from a public GitHub GraphQL query
  (`repository(owner: "dwarvesf", name: "memo-comments") { discussions }`),
  read-only, no secrets involved.
- If Han later wants semantic search, the actual blocker is the embeddings
  refresh pipeline (dispatch-only, 9mo stale per PR #302), not a missing
  Vectorize Worker; that's a separate decision from this sub-goal.
