# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands

- `make build`: Full production build (`tsx scripts/export-markdown.ts` + `make duckdb-export` + `pnpm run build` + nginx conf + lint + copy `db/`). Regenerates `db/vault.parquet` locally. No Elixir toolchain needed.
- `make build-static`: Same as `make build` minus the DuckDB export (uses the `db/vault.parquet` already checked out). This is the build CI actually runs (`publish-pages.yml` inlines these same steps).
- `pnpm run dev`: Run the Next.js dev server (`make run` sets up content first; see below).
- `pnpm run build`: `tsx scripts/memo-build.ts`, the TypeScript pre-build/generation step Next.js needs before `next build` runs internally.
- `pnpm run lint`: ESLint.
- `pnpm run format`: Prettier over `src/`.
- `pnpm test`: Vitest.
- `bash scripts/build-and-deploy.sh`: The whole publish pipeline (vault advance, DuckDB reindex, markdown compile, site build, Cloudflare Pages deploy, R2 + D1 upload). Runner-agnostic, configured by environment variables; the header comment lists them. `SKIP_REINDEX=1` skips the reindex for a docs-only redeploy.

### Content Generation Scripts

- `pnpm run generate-menu` / `generate-menu-path-sorted`: navigation menu structure.
- `pnpm run generate-search-index`: client-side MiniSearch index.
- `pnpm run generate-backlinks`: backlink relationships between notes.
- `pnpm run generate-redirects-map` / `generate-shorten-map`: URL redirect and short-link maps.
- `pnpm run generate-cf-redirects` / `verify-cf-redirects`: builds `out/_redirects` for Cloudflare Pages and checks it against the full redirect map for silent drops (Pages caps `_redirects` at 2,000 rules; anything over that cap is handled instead by `functions/_middleware.ts`, not this file).
- `pnpm run generate-rss`: pre-generates `{rss,atom,feed,index}_N.xml` for every N from 10 to 100 in steps of 5, plus the unlimited feed.
- `pnpm run generate-pageviews`: pulls Plausible stats (degrades gracefully if `PLAUSIBLE_API_TOKEN` is unset).
- `pnpm run fetch-prompts` / `fetch-contributors`: external data fetches.
- `pnpm run upload-rollups-to-d1`: push the content rollup to D1.
- `pnpm run upload-to-r2`: pushes derived build artifacts (parquet, search index, posts.json) to R2, but needs S3-style R2 keys the account does not have. CI does not use it; see the credential hazards noted under CI Workflows.

### DuckDB Export (TypeScript)

`scripts/duckdb-export.ts` rebuilds `db/vault.parquet` from the vault. It is the TypeScript port of the Elixir `mix duckdb.export` and it is the wired-in production path.

- `make duckdb-export`: the normal run (`tsx scripts/duckdb-export.ts`).
- `make duckdb-export-force`: adds `--ignore-filter --ignore-embeddings-check`.
- `make duckdb-export-ignore-filter`: adds `--ignore-filter` only.
- `make duckdb-export-pattern pattern=<glob>`: **still Elixir** (`mix duckdb.export_pattern`); the pattern variant was not ported.

### Elixir Commands (Obsidian Compiler)

- `cd lib/obsidian-compiler && mix export_markdown`: the retained **verification oracle** for the TypeScript markdown compiler. Nothing in the build calls it (see "Content compilers" below).
- `cd lib/obsidian-compiler && mix duckdb.export`: the retained **verification oracle** for the TypeScript exporter. Nothing in the build calls it. Run it when you need to prove a `duckdb-export.ts` change still matches the reference implementation.
- `cd lib/obsidian-compiler && mix fetch`: still production, pulls the vault submodule content (`make fetch`).
- `cd lib/obsidian-compiler && mix sync_hashnode`: still production (`make sync-hashnode`); never ported.
- `cd lib/obsidian-compiler && mix test`: run Elixir tests for markdown processing and `AIUtils`.

## Architecture Overview

### Stack

- **Frontend**: Next.js 16.2.9 (React 19.2.7), Pages Router (`src/pages/`, file-based routing; no App Router), TypeScript.
- **Rendering mode**: `next.config.ts` sets `output: 'export'` (`images.unoptimized: true`). This is a **static export**: no SSR, no ISR, no Next.js server at runtime. Every route is pre-rendered to `out/` at build time.
- **Content processing**: TypeScript. Markdown compilation runs `scripts/export-markdown.ts`; the DuckDB export runs `scripts/duckdb-export.ts`. The Elixir application in `lib/obsidian-compiler/` is kept as the parity oracle for both, plus `mix fetch` and `mix sync_hashnode`.
- **Content source**: git submodule `vault/` → `dwarvesf/brainery` (see `.gitmodules`), which itself has further nested submodules (not re-derived here; check `vault/.gitmodules` if you need the full graph).
- **Database**: DuckDB, exported to `db/vault.parquet` (content + `embeddings_gemini`/`embeddings_spr_custom` columns), copied to `out/db/` at build time (`cp -r db out/`) and served at `/db/vault.parquet`. Read at **build time only**, through `@duckdb/node-api` in Node scripts. There is no browser-side DuckDB: `@duckdb/duckdb-wasm` was removed as a dependency and no client code queries the parquet.
- **Deployment**: **Cloudflare Pages** (project `memo-d-foundation`), fronted by Cloudflare Pages Functions, with derived data pushed to Cloudflare R2 and Cloudflare D1. `memo.d.foundation` DNS was cut over from Railway to the Pages project on 2026-07-23 (`docs/cf-migration/M4-02-PAGES-CUTOVER-RECORD.md`); Railway is zero-traffic and pending teardown, not the live target. **Railway/`make build` Docker deploy is retired, not current.**

### Cloudflare Pages layer

- `wrangler.toml`: Pages project `memo-d-foundation`, build output `out`. Declares the `MEMO_DERIVED` R2 binding (bucket `memo-derived`) used only by the Pages Function below, kept private (not exposed via `r2.dev`).
- `functions/_middleware.ts` (Cloudflare Pages Function, runs on every request). Three jobs a pure static export can't do on its own:
  1. Serves the redirect/alias/shorten-link map with no rule-count cap (works around the 2,000-row static `_redirects` limit; `REDIRECT_MAP` is generated by `scripts/generate-cf-redirects.ts`, gitignored).
  2. Handles `?limit=N` on `/rss.xml`, `/atom.xml`, `/feed.xml`, `/index.xml`, `/feed/index.xml` by rewriting to the matching pre-generated static file (request rewrite, not a dynamic render).
  3. Proxies the handful of vault assets that exceed Pages' 25 MiB per-file upload limit out of the private `memo-derived` R2 bucket (`functions/lib/oversize-assets.ts`; those files are excluded from `out/` at build time and were uploaded to R2 once).
- D1: the `dwarves-prod` database (shared, resolved by name via `wrangler d1 info`) receives a content rollup and per-post rows (`scripts/upload-rollups-to-d1.ts`, `scripts/upload-memo-posts-to-d1.ts`).

### Content compilers: both ported, Elixir kept as the oracle

`lib/obsidian-compiler/` holds two compiler Mix tasks. Both have been replaced in the build by a TypeScript port; the Elixir side survives only as the reference implementation to diff against.

```
 vault/ (Obsidian markdown submodule)
   |
   |-- markdown compilation ------> public/content/**
   |     PRODUCTION: scripts/export-markdown.ts (TypeScript, Makefile + publish-pages.yml)
   |     ORACLE ONLY: mix export_markdown       (Elixir, nothing in the build calls it)
   |
   '-- parquet reindex ------------> db/vault.parquet
         PRODUCTION: scripts/duckdb-export.ts   (TypeScript, via make duckdb-export)
         ORACLE ONLY: mix duckdb.export         (Elixir, nothing calls it)
```

- **Markdown compilation is TypeScript.** `Makefile` and CI (`publish-pages.yml`) both run `tsx scripts/export-markdown.ts --vault vault --output public/content --db db`. The port was cut over at 100% byte-parity against the Elixir oracle. Detail: `docs/cf-migration/compiler-rewrite.md`.
- **The DuckDB export is TypeScript.** `make duckdb-export` runs `scripts/duckdb-export.ts`. The Elixir `mix duckdb.export` is retained purely as a verification oracle, so a port change can be diffed against the reference implementation. Decision record: `docs/adr/0016-port-duckdb-export-to-typescript.md`.
- **Not ported:** `mix fetch`, `mix sync_hashnode`, and `mix duckdb.export_pattern`. Those are still the production path for their Make targets, so the Elixir toolchain remains a real dependency for them.
- The TypeScript exporter carries one **deliberate divergence** from the oracle: it keeps `keywords` on the frontmatter-only upsert path, where the Elixir blanks them. `keywords` is a MiniSearch-weighted field, so the Elixir behaviour silently degraded site search on every incremental run. The oracle was not corrected because it is on the way out.

### AI generation and embeddings

- **Text generation** (SPR summaries + the `keywords` list) runs on **opencode-go**, an OpenAI-compatible endpoint at `https://opencode.ai/zen/go/v1/chat/completions`, model `deepseek-v4-flash`, flat-rate tier. Key: `OPENCODE_GO_API_KEY`. Override with `OPENCODE_GO_BASE_URL` / `OPENCODE_GO_MODEL`. Implemented twice, in `scripts/duckdb-export.ts` and in `Memo.Common.AIUtils`, because the oracle has to match. A missing key degrades to an empty result rather than failing the export.
- **Embeddings are off by default.** Both the vector columns are carried forward from the existing row unless `MEMO_EMBEDDINGS` is set to `1` or `true`. The Elixir oracle can regenerate them (Gemini for `embeddings_gemini`, Jina for `embeddings_spr_custom`); the TypeScript exporter does not implement live generation and throws if the gate is set.
- **Nothing consumes the vectors.** Site search is MiniSearch, purely lexical (`scripts/generate-search-index.ts`). No app or Pages Function code reads either embedding column, and the D1 rollup carries only a `missing_embeddings` health count, not the vectors. Treat the columns as dormant schema, not a live feature.
- Credentials no longer come from HashiCorp Vault; see "Credentials" below.

### Credentials

HashiCorp Vault is decommissioned and fully removed from this repo. `node-vault` is gone, `Dockerfile` and `Dockerfile.legacy` dropped their Vault build args, and the Elixir Gemini-key Vault fallback is deleted.

- GCS access (`src/lib/storage.ts`) uses Google **Application Default Credentials**: `GOOGLE_APPLICATION_CREDENTIALS`, `gcloud auth`, or host workload identity. The bucket name comes from `LANDING_ZONE_GCS_BUCKET`.
- Every other credential is a plain environment variable, supplied in CI as a repo secret.
- The five `VAULT_*` repo secrets still exist but are dead; nothing reads them. `ENCRYPTED_WALLET_PRIVATE_KEY` is also retained and permanently undecryptable, because the Vault Transit key that could unseal it died with the Vault instance. Do not write code that depends on either.

### Key Directories

- `src/`: Next.js application source.
  - `pages/`: Pages Router routes (file-based routing).
  - `components/`: reusable React components by feature.
  - `lib/`: content processing, MDX handling.
  - `hooks/`, `contexts/`, `styles/`, `types/`, `analytics/`, `constants/`.
- `lib/obsidian-compiler/`: Elixir application. Still production for markdown processing; the DuckDB export half is now oracle-only.
- `vault/`: git submodule (Obsidian vault content), avoid modifying during development.
- `scripts/`: TypeScript scripts for content generation, redirects, R2/D1 upload, and the NFT report.
- `functions/`: Cloudflare Pages Functions (`_middleware.ts` and its helpers).
- `db/`: `vault.parquet` (DuckDB content export, regenerated via `make duckdb-export`, dispatched by the `dispatch.yml` "Update submodules" workflow), `processing_metadata*.parquet`, `schema.sql`, `load.sql`.
- `public/content/`: generated JSON/content files for search, navigation, and metadata. The parquet is not copied here; `db/` is copied to `out/db/` at build time.
- `docs/adr/`: numbered architecture decision records. The recent ones covering the current build shape are `0016` (DuckDB export ported to TypeScript, Elixir kept as oracle), `0017` (opencode-go generation, embeddings gated off), and `0018` (HashiCorp Vault decommissioned).
- `docs/cf-migration/`: the Railway → Cloudflare Pages migration record. Read here for full history/detail instead of duplicating it in this file: `pages-deploy.md` (config-only prep, redirect + RSS mapping), `build-inventory.md` (build-artifact validation run), `compiler-rewrite.md` (Elixir → TS parity report), `content-sot.md` (submodule ingest + Notion-authoring fingerprint), `comments-search-decision.md` (comments/search evidence decisions), `M4-02-PAGES-CUTOVER-RECORD.md` (the actual cutover + DNS flip record).

### Content Processing Pipeline

1. Obsidian markdown files in the `vault/` submodule.
2. `scripts/export-markdown.ts` processes markdown → standardized format in `public/content/`; `make duckdb-export` produces `db/vault.parquet`. The parquet regen is a separate, manually dispatched job, not part of the per-push deploy build.
3. TypeScript scripts (`scripts/`) generate navigation, search indices, redirects, and metadata.
4. Next.js statically exports the site (`output: 'export'`) to `out/`.
5. `pnpm run generate-cf-redirects` builds `out/_redirects`; oversize files (>25 MiB) are stripped from `out/` before deploy.
6. `wrangler pages deploy out` ships to Cloudflare Pages; derived artifacts (`db/vault.parquet`, search index, `posts.json`) are pushed to R2, and a rollup to D1.

### CI Workflows (`.github/workflows/`)

| Workflow | Trigger | Does |
|---|---|---|
| `publish-pages.yml` | push to `main` (content/build paths), daily cron, manual | The live deploy pipeline: builds (via `tsx scripts/export-markdown.ts`, no Elixir setup step), deploys to Cloudflare Pages, uploads derived artifacts to R2, and a rollup to D1. Gated on repo var `PAGES_PUBLISH_ENABLED`, which is now `true`, so the job runs rather than skipping. |
| `dispatch.yml` ("Update submodules") | manual only | Bumps the `vault` submodule to latest, regenerates AI summaries, runs the DuckDB export (`devbox run duckdb-export`, the TypeScript path), commits `db/`. |
| `backup.yml` | daily cron, manual | Backs up the DB. |
| `add-mint-post.yml` | push to `db/vault.parquet`, manual | Adds new posts to the mint contract. |
| `deploy-arweave.yml` | push to `db/vault.parquet`, manual | Deploys markdown to Arweave. |
| `generate-redirects.yml` | push to `db/vault.parquet`, manual | Regenerates the redirect map. |
| `memo-nft-report.yml` | daily cron, manual | Sends the NFT report to Discord. |
| `monitor-vault-parquet.yml` | daily cron, manual | Monitors `db/vault.parquet` health, reports to Discord. |

`derived-to-r2.yml` was deleted; its R2 and D1 upload is now inline in `publish-pages.yml`, driven by `wrangler` on the Cloudflare API token rather than the S3-style `R2_*`/`D1_*` key set the old workflow used. The `test-discord-notifications.yml` and `test-git-action.yml` throwaway harnesses were deleted too.

Cloudflare credentials are provisioned as repo **secrets**: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The four `AWS_*` secrets were deleted.

Two credential hazards follow from that deletion, both still live:

- `backup.yml` still reads `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION`. Those secrets no longer exist, so the daily backup runs with empty credentials.
- `pnpm run upload-to-r2` requires `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`, which the account does not have. `publish-pages.yml` deliberately bypasses that script and calls `wrangler r2 object put` instead. Treat the script as unwired.

### Important Technical Notes

- The `vault/` directory is a git submodule containing pure content; avoid modifying during development.
- Content generation scripts must run before the Next.js static export for proper output.
- Client-side search uses MiniSearch with pre-generated indices for performance.
- MDX rendering supports mathematical expressions (KaTeX), code highlighting, and custom components.
- Web3 integration (wagmi/viem/ethers) for NFT minting and contributor rewards.
- No Next.js server runs in production; anything that looks like it needs server-side logic at request time belongs in `functions/_middleware.ts` (Cloudflare Pages Functions), not a Next.js API route.

### Development Workflow

1. Run `make run` for full local dev setup (compiles markdown + starts the dev server with all generation scripts).
2. Content changes require re-running the markdown export: `pnpm exec tsx scripts/export-markdown.ts --vault vault --output public/content --db db`.
3. Navigation/search changes require regenerating indices before seeing updates.
4. Use `make build-static` to reproduce the CI build locally (Node only, no Elixir toolchain); `make build` additionally regenerates `db/vault.parquet` via `make duckdb-export`.

### Key Libraries and Frameworks

- **Next.js 16.2.9 / React 19.2.7**: Pages Router, static export (`output: 'export'`).
- **MDX**: Markdown with React components for rich content.
- **TailwindCSS 4**: utility-first CSS.
- **Elixir/Mix** (`lib/obsidian-compiler/`): the parity oracle for both TypeScript compilers, plus the still-production `mix fetch`, `mix sync_hashnode`, and `mix duckdb.export_pattern` (see "Content compilers" above).
- **DuckDB** (`@duckdb/node-api`): embedded analytical database for content queries at build time, exported to `db/vault.parquet`. Node-side only; there is no WASM/browser DuckDB.
- **MiniSearch**: the site's search engine, lexical, over a pre-generated index.
- **TypeScript**: throughout the stack (scripts, functions, Next.js app).
- **Cloudflare Workers/Pages types**: not yet added as a dependency; `functions/_middleware.ts` currently types its Pages Function context loosely as `any` pending that.
