# M4-02 Pages cutover record (+ M4-05 derived-data go-live)

Executed 2026-07-23 from Han's local clone, `main` at `a156e7f` (PR #309 build
fix). This record covers everything up to, but NOT including, the DNS flip:
the site is live and verified on the `*.pages.dev` URL; `memo.d.foundation`
DNS still points at Railway, which is untouched and still serving production.

## Deploy details

| Item            | Value                                                                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pages project   | `memo-d-foundation` (production branch `main`), created via `wrangler pages project create`                                                                                 |
| Production URL  | <https://memo-d-foundation.pages.dev> (deployment `82ee0a88`)                                                                                                               |
| Built from      | `main` @ `a156e7f9b8bb6c8643fdef7aee228f879678c48d`, vault submodule @ `dbe5b17` (local checkout, newer than the last Railway build)                                        |
| Build           | `pnpm install --frozen-lockfile` → `mix export_markdown` → `pnpm run build` → `generate-nginx-conf` → `build-ci-lint` → `db/` copied to `out/db/` → `generate-cf-redirects` |
| Uploaded        | 14,431 files (263s) + `_redirects` (2,000 rules) + Functions bundle (`functions/_middleware.ts` with the full 4,287-rule map)                                               |
| Redirect parity | `verify-cf-redirects`: 4,287/4,287 nginx rules present, 0 missing, 0 target mismatches                                                                                      |
| R2 bucket       | `memo-derived` (created this run via `wrangler r2 bucket create`)                                                                                                           |
| D1              | shared prod `dwarves-prod` database, tables `content_rollups` + `memo_posts` created + populated                                                                            |

## Verification (all against `memo-d-foundation.pages.dev`, DNS untouched)

Canonical pages, pages.dev vs live `https://memo.d.foundation` (HTTP status /
`<title>` / sha of the `<main>` content block):

| Path                    | pages.dev | live | title | main content     |
| ----------------------- | --------- | ---- | ----- | ---------------- |
| `/`                     | 200       | 200  | same  | same             |
| `/about`                | 200       | 200  | same  | same             |
| `/careers`              | 200       | 200  | same  | same             |
| `/handbook`             | 200       | 200  | same  | same             |
| `/consulting`           | 200       | 200  | same  | same             |
| `/playbook/engineering` | 200       | 200  | same  | same             |
| `/culture/red-flags`    | 200       | 200  | same  | same             |
| `/updates`              | 200       | 200  | same  | DIFF (see below) |
| `/tags`                 | 200       | 200  | same  | DIFF (see below) |
| `/contributor`          | 200       | 200  | same  | same             |

The two DIFFs are build-vintage, not regressions: the Pages build (current
`main` + current vault) server-renders the `/updates` listing (50 links in the
HTML) where the live Railway build (older commit/vault) renders none
server-side. New build has strictly more static content on those two index
pages.

Redirects (3 from the static `_redirects` fast path, 2 beyond the 2,000-rule
cap so they prove the middleware's full-map path):

| Source                      | Expected target                         | Result       |
| --------------------------- | --------------------------------------- | ------------ |
| `/03Ifkg`                   | `/handbook/guides/check-in-at-office`   | 301, correct |
| `/0b6YVA`                   | `/culture/red-flags`                    | 301, correct |
| `/QTAEhQ`                   | `/culture/high-performing-team`         | 301, correct |
| `/vjyp9A` (middleware-only) | `/careers/archived/community-executive` | 301, correct |
| `/ye0BtQ` (middleware-only) | `/ux/mixed-methods/falsifiability`      | 301, correct |

RSS + 404 (the `feed-limit` Function behavior):

| Check                                  | Result                                                                |
| -------------------------------------- | --------------------------------------------------------------------- |
| `/rss.xml` (no limit)                  | 200, well-formed XML, 20 items (middleware default-20, matches nginx) |
| `/rss.xml?limit=10`                    | 200, 10 items (serves pre-generated `rss_10.xml`)                     |
| `/rss.xml?limit=7` (not pre-generated) | 200, 1,401 items (falls back to unlimited `rss.xml`, matches spec)    |
| `/feed/index.xml`                      | 200                                                                   |
| `/zzz-garbage-path-xyz`                | 404 with the site's 404 page                                          |

D1 (`wrangler d1 execute dwarves-prod --remote`):

| Table             | Rows                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------ |
| `content_rollups` | 1 (commit `a156e7f9`, total_records 2031, drafts 11, pinned 8, missing_embeddings 0) |
| `memo_posts`      | 1,654                                                                                |

R2 (`memo-derived` bucket, both `derived/a156e7f9.../` and `derived/latest/`
key prefixes, sizes verified by re-download):

| Object                    | Size (bytes) |
| ------------------------- | ------------ |
| `db/vault.parquet`        | 21,997,296   |
| `search-index.json`       | 5,892,662    |
| `posts.json` (1,654 rows) | 388,838      |

## Deviations and known gaps

1. **R2 `out/` mirror not uploaded.** `scripts/upload-to-r2.ts` needs S3-API
   access keys (`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`) for the Dwarves
   account; the keys available to this session belong to a different account
   (S3 HEAD returned 401). The three load-bearing objects above (what
   foundation-workers' `D1MemoAnalyticsReader` and the M4-06 repoint consume)
   were uploaded via `wrangler r2 object put` instead. To complete the
   rendered-`out/` mirror: mint an R2 API token for the Dwarves account, set
   the four `R2_*` secrets, re-run `pnpm run upload-to-r2` (idempotent,
   HEAD-before-PUT resumes cleanly). Nothing currently consumes the `out/`
   mirror.
2. **5 asset files exceed Pages' 25 MiB per-file limit** and were excluded
   from the deploy (Pages hard-rejects them): the same PDF is physically
   duplicated at 3 paths under `public/content/` (34,491,168 bytes each) and
   the same GIF at 2 paths (29,778,758 bytes each), the vault export copies
   an asset into every category tree (`research/`, `playground/`) that
   references it, so one underlying file becomes several identical build
   outputs.

   **Fixed** (`fix/oversize-assets-r2`, PR #TODO, 2026-07-23): each distinct
   file (2 total) uploaded once to `memo-derived` R2 at
   `assets/oversize/<filename>` via `wrangler r2 object put`, verified
   byte-identical by re-download + SHA-256. `functions/_middleware.ts` gained
   a small hand-maintained map (`functions/lib/oversize-assets.ts`, 5 paths →
   2 R2 keys) checked before the redirect/feed logic: a hit fetches the
   object via a private R2 binding (`wrangler.toml` `[[r2_buckets]]`,
   `MEMO_DERIVED`) and streams it back with `Content-Type`/`ETag` from R2
   metadata plus a 1-year immutable `Cache-Control`. The bucket stays
   private; nothing is exposed via R2's public r2.dev domain. Redeployed via
   `wrangler pages deploy out/ --branch main` (no site rebuild needed, only
   the Functions bundle + `wrangler.toml` binding changed).

   All 5 paths verified 200 on the live `memo.d.foundation` domain with
   correct `Content-Length` (34,491,168 / 29,778,758) and, for one sampled
   path, a byte-identical SHA-256 against the source file. Root, `/rss.xml`,
   a garbage-path 404, and an existing small PDF at the same directory shape
   (`singleton-design-pattern.pdf`) re-verified 200/404 as expected, no
   regression.

   | Path                                                                                         | Status | Content-Length |
   | -------------------------------------------------------------------------------------------- | ------ | -------------- |
   | `/content/research/assets/builder-design-pattern.pdf`                                        | 200    | 34,491,168     |
   | `/content/research/topics/architecture/assets/builder-design-pattern.pdf`                    | 200    | 34,491,168     |
   | `/content/playground/topics/architecture/assets/builder-design-pattern.pdf`                  | 200    | 34,491,168     |
   | `/content/research/topics/blockchain/assets/build_custom_ai_agent_with_elizaos_result.gif`   | 200    | 29,778,758     |
   | `/content/playground/topics/blockchain/assets/build_custom_ai_agent_with_elizaos_result.gif` | 200    | 29,778,758     |

3. **BSD vs GNU `cp`:** the Makefile's `cp -r db/ out/` puts files at
   `out/db/` on Linux but at `out/` on macOS; fixed by hand this run. Only
   matters for local macOS builds; the Pages CI build command should run on
   Linux.
4. `fetch-prompts`, `fetch-contributors`, `generate-pageviews` degraded
   gracefully (no bucket/Plausible creds locally), same as documented in
   `build-inventory.md`. Optional artifacts, non-blocking.

## Left for the conductor: DNS flip

Current: `memo.d.foundation` (zone `d.foundation`) points at Railway.

1. Add the custom domain to the Pages project:
   `npx wrangler pages domain add memo.d.foundation --project-name memo-d-foundation`
   (or dashboard → Pages → memo-d-foundation → Custom domains).
2. Update the `memo` DNS record in the `d.foundation` zone to a proxied CNAME
   → `memo-d-foundation.pages.dev`.
3. Verify the production domain serves the Pages deployment (same checks as
   the table above, against `https://memo.d.foundation`).

## Rollback

Repoint the `memo` DNS record back at the current Railway target. The Railway
deployment is live, untouched, and was never disabled; no data migration is
involved (D1/R2 derived data is additive and unused by the Railway path).

## DNS flip — EXECUTED (conductor, 2026-07-23)

- Custom domain `memo.d.foundation` attached to the Pages project (validation: pending → active in ~60s).
- The `memo` CNAME in the `d.foundation` zone flipped: `mkdwtxbw.up.railway.app` (DNS-only) → `memo-d-foundation.pages.dev` (proxied).
- Post-flip verification on the production domain: root 200, `/rss.xml` 200 with 20 items, garbage path 404, `/updates` + `/playbook` byte-parity with the verified pages.dev deployment.
- **Rollback:** repoint the `memo` CNAME to `mkdwtxbw.up.railway.app` (DNS-only) and detach the custom domain. Railway deployment still live and untouched.
- Railway is now zero-traffic; its teardown follows the M5-04 runbook after a rollback buffer.
