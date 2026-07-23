# memo.d.foundation build-artifact inventory

Validation run for CF-N.3 (memo-track sub-goal 03). Produced by actually running the
pipeline against a real `vault` submodule snapshot (commit `bc8945d9`) on 2026-07-23,
not by reading code cold. See `## Confirmation run` for the exact commands and output.

## Corrected premise (read this first)

The megagoal brief this sub-goal was dispatched from states memo.d.foundation is "fully
TypeScript, zero Elixir" and that CF-N.2 (an Elixir -> TS compiler rewrite) is already
done. **That is not accurate.** Running the real build surfaced an Elixir application
still in the repo, still wired into production:

- `lib/obsidian-compiler/` is a live Mix (Elixir 1.17/1.18) project, last touched
  2025-08-08, with its own `mix.exs`, `mix.lock`, and Elixir test suite.
- The production `Dockerfile` (`FROM elixir:1.18.4-otp-26`, used by the Railway build,
  cache-mount IDs are literally the Railway service id) compiles it and the production
  build target `make build-static` runs `cd lib/obsidian-compiler && mix export_markdown`
  as its first content step.
- The repo's own `CLAUDE.md` documents this as the intended architecture ("Content
  Processing: Elixir application (`lib/obsidian-compiler`) for markdown compilation").

What IS fully TypeScript, and is the part this sub-goal was actually able to validate
end-to-end with zero Elixir involved, is the **downstream artifact layer**:
`scripts/memo-build.ts` + `scripts/generate-*.ts` + `next build`. That layer consumes
what the Elixir compiler already produced (`public/content/*` markdown/assets and
`db/vault.parquet`) and turns it into the site's navigation/search/feed/rendered
artifacts. It does not touch `vault/` and does not run Elixir.

**Net effect on the megagoal:** CF-N.2 is not "already done", it is "half done" (the
derived-artifact half is TS; the vault-compilation half is still Elixir and still
production-critical). This sub-goal does not rewrite it (out of scope, see the goal
contract's Scope edges), it documents the real boundary so N.4/N.5 know exactly which
artifacts they can depend on today and which ones still have an Elixir/manual-trigger
dependency upstream of them.

## Pipeline, as it actually runs

```
vault/ (git submodule, Obsidian markdown, dwarvesf/brainery)
   |
   |  mix export_markdown   <- ELIXIR, lib/obsidian-compiler
   |  (production: make build-static / make run; NOT part of `pnpm run build`)
   v
public/content/*.md + assets + public/content/db/{vault,processing_metadata*}.parquet
   |
   |  (db/vault.parquet itself is a git-committed binary artifact; the ONLY thing that
   |   regenerates its rows/embeddings from source is a SEPARATE Elixir task:
   |   `mix duckdb.export`, invoked only by .github/workflows/dispatch.yml on manual
   |   workflow_dispatch. It is NOT run by `make build-static` or `pnpm run build`.)
   v
db/vault.parquet  (read-only input to every generate-*.ts script below)
   |
   |  scripts/memo-build.ts  <- TYPESCRIPT, tsx, zero Elixir from here down
   |  runs generate-menu, generate-menu-path-sorted, generate-backlinks,
   |  generate-redirects-map, generate-shorten-map, generate-pageviews,
   |  fetch-prompts, fetch-contributors, generate-static-paths,
   |  generate-search-index, next build, generate-rss, copy-404
   v
public/content/*.json + *.conf  (menu/search/backlinks/redirects/tags/etc.)
   +
out/  (next build, output:'export' -> static HTML site + RSS/Atom feeds)
```

## Confirmation run (2026-07-23, worktree `feat/cfm-n3-compiler-validate`)

Environment: git worktree off `origin/main` (086b7a2), `vault` submodule at `bc8945d9`
(568M checked out), `pnpm install --frozen-lockfile`, local Elixir 1.17/OTP29 + local
`mix deps.get && mix compile` for `lib/obsidian-compiler` (warnings only, pre-existing,
not touched).

| Step                                                                      | Command                                            | Result          | Output                                                                                                                                                                                                         |
| ------------------------------------------------------------------------- | -------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Elixir export                                                             | `mix export_markdown` (in `lib/obsidian-compiler`) | PASS            | `public/content/`, 1883 files, 558M (markdown + assets + copied `db/*.parquet`)                                                                                                                                |
| Menu/pinned/tags                                                          | `pnpm run generate-menu`                           | PASS            | `public/content/menu.json` (1493 rows), `pinned-notes.json`, `tags.json`                                                                                                                                       |
| Menu (path-sorted)                                                        | `pnpm run generate-menu-path-sorted`               | PASS            | `public/content/menu-sorted.json`                                                                                                                                                                              |
| Backlinks                                                                 | `pnpm run generate-backlinks`                      | PASS            | `public/content/backlinks.json` (1643 rows)                                                                                                                                                                    |
| Redirects/aliases                                                         | `pnpm run generate-redirects-map`                  | PASS            | `public/content/redirects.json` (4287), `aliases.json`                                                                                                                                                         |
| Shorten map                                                               | `pnpm run generate-shorten-map`                    | PASS            | `public/content/shorten-redirects.json`                                                                                                                                                                        |
| Static paths                                                              | `pnpm run generate-static-paths`                   | PASS            | `public/content/static-paths.json`                                                                                                                                                                             |
| Search index                                                              | `pnpm run generate-search-index`                   | PASS            | `public/content/search-index.json` (1518 docs, MiniSearch)                                                                                                                                                     |
| Nginx redirect conf                                                       | `pnpm run generate-nginx-conf`                     | PASS            | `public/content/nginx_redirect_map.conf`                                                                                                                                                                       |
| RSS/Atom feeds                                                            | `pnpm run generate-rss`                            | PASS            | `out/*.xml` (rss/atom/feed/index, per-limit variants)                                                                                                                                                          |
| Pageviews                                                                 | `pnpm run generate-pageviews`                      | FAIL (expected) | needs `PLAUSIBLE_API_TOKEN`; live 401 confirms the dependency, not a code bug                                                                                                                                  |
| Prompts fetch                                                             | `pnpm run fetch-prompts`                           | NOT RUN         | reads from a remote `StorageUtil` (bucket creds not available to this session)                                                                                                                                 |
| Contributors fetch                                                        | `pnpm run fetch-contributors`                      | NOT RUN         | same remote `StorageUtil` dependency                                                                                                                                                                           |
| Vitest suite                                                              | `pnpm exec vitest run`                             | PASS            | 44/44 tests, 3 files (`monitor-vault-parquet`, `draft-filter`, `memo-nft-report`), 2.1s, no creds needed                                                                                                       |
| Static export                                                             | `next build` (`output:'export'`)                   | PARTIAL         | compiled clean, began generating 4181 static pages, then hit `ENOSPC` (host disk full, 154Mi free on this machine), an environment limit, not a code defect. Did not reach a complete `out/` tree in this run. |
| `mix duckdb.export` (regenerate `vault.parquet` + embeddings from source) | not run                                            | NOT RUN         | needs `GEMINI_API_KEY` / `JINA_API_KEY` / `INFINITY_API_KEY` (paid embedding providers); out of scope for validate-only. Confirmed instead by inspecting the already-committed parquet (see below).            |

Embeddings check on the committed `db/vault.parquet` (no regeneration needed to confirm
this, it's already in the file):

```
$ duckdb -c "SELECT COUNT(*) total, COUNT(embeddings_gemini) has_gemini,
             COUNT(embeddings_spr_custom) has_spr FROM 'db/vault.parquet';"
┌───────┬────────────┬─────────┐
│ total │ has_gemini │ has_spr │
├───────┼────────────┼─────────┤
│  2031 │       1987 │    1987 │
└───────┴────────────┴─────────┘
```

## Artifact paths (source of truth for N.4/N.5)

| Artifact                                 | Path                                                                                   | Produced by                                                                                                                   | Load-bearing for a static/edge deploy?                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Vault DB (rows + both embedding columns) | `db/vault.parquet` (also copied to `public/content/db/vault.parquet`)                  | git-committed binary; refreshed only by `mix duckdb.export` via manual `workflow_dispatch` (`.github/workflows/dispatch.yml`) | Yes, every `generate-*.ts` script reads it directly                           |
| Processing metadata                      | `db/processing_metadata*.parquet`                                                      | same Elixir export path                                                                                                       | Only used by the Elixir incremental-export cache, not by the TS/Next layer    |
| Standardized markdown + assets           | `public/content/**/*.md`, `public/content/**/assets/**`                                | `mix export_markdown`                                                                                                         | Yes, Next.js pages read these at build/runtime                                |
| Menu / pinned / tags                     | `public/content/{menu,menu-sorted,pinned-notes,tags}.json`                             | TS (`generate-menu*`)                                                                                                         | Yes, site navigation                                                          |
| Backlinks                                | `public/content/backlinks.json`                                                        | TS (`generate-backlinks`)                                                                                                     | Yes                                                                           |
| Redirects / aliases / shorten map        | `public/content/{redirects,aliases,shorten-redirects}.json`, `nginx_redirect_map.conf` | TS                                                                                                                            | Yes, URL routing                                                              |
| Search index                             | `public/content/search-index.json`                                                     | TS (`generate-search-index`)                                                                                                  | Yes, client-side search                                                       |
| Static paths                             | `public/content/static-paths.json`                                                     | TS                                                                                                                            | Yes, Next.js `getStaticPaths`                                                 |
| RSS/Atom feeds                           | `out/{rss,atom,feed,index}*.xml`                                                       | TS (`generate-rss`)                                                                                                           | Only if the deploy still serves feeds                                         |
| Prompts / contributors                   | `public/content/prompts.parquet`, `contributors.json`                                  | TS, but sourced from an external `StorageUtil` bucket (creds not in this session)                                             | Optional, build degrades gracefully (logged ENOENT/error) without them        |
| Pageviews                                | `public/content/pageviews.json`                                                        | TS (`generate-pageviews`), needs `PLAUSIBLE_API_TOKEN`                                                                        | Optional, same graceful-degrade                                               |
| Rendered static site                     | `out/**` (HTML + assets, `next build` with `output:'export'`)                          | `next build`                                                                                                                  | Yes, if the target is a static host/R2+CDN rather than a Node/Railway runtime |

## N.4/N.5-needed vs produced-today

| Needed by N.4/N.5                                         | Exists today?                                                                                                                                                                                                                                         | Gap, named                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `vault.parquet` (rows + metadata)                         | Yes, git-committed, structurally correct                                                                                                                                                                                                              | **Freshness/automation gap**: only regenerated by a manually-triggered Elixir GitHub Action (`dispatch.yml`), last run 2025-10-22, ~9 months stale relative to current `main` (086b7a2, 2026-07-19). N.4/N.5 either uploads the stale committed file as-is, or must also trigger/automate `mix duckdb.export` (which still needs Elixir + `GEMINI_API_KEY`/`JINA_API_KEY`/`INFINITY_API_KEY`) before upload. |
| Embeddings (`embeddings_gemini`, `embeddings_spr_custom`) | Yes, **already produced today**, 1987/2031 rows populated in the committed parquet. This directly contradicts the megagoal's "if embeddings aren't built today, name that gap" framing: they ARE built, just not by TypeScript and not on a schedule. | **Not an existence gap. It's the same freshness/automation gap above**, embeddings are only as fresh as the last manual Elixir reindex.                                                                                                                                                                                                                                                                      |
| Rendered `out/` (static HTML)                             | Mechanism confirmed (`next build`, `output:'export'`, compiles clean, started generating 4181 pages) but **not fully produced in this validation run**                                                                                                | **Environment gap, not a code gap**: this run's host ran out of disk (154Mi free) mid-export. Needs a re-run with disk headroom (or in CI/Railway, which already does this successfully today) to capture a complete `out/` tree before N.5 wires it to R2.                                                                                                                                                  |
| Search/menu/backlinks/redirects JSON                      | Yes, all confirmed produced this run, pure TS, no creds                                                                                                                                                                                               | No gap.                                                                                                                                                                                                                                                                                                                                                                                                      |
| Prompts/contributors/pageviews                            | Only with external creds (bucket + Plausible token) not available to this validation session                                                                                                                                                          | **Scope gap for N.4/N.5 to decide, not name as broken**: these three are optional/best-effort in the existing build (it logs and continues without them), so R2 upload should treat them the same way, nice-to-have, not blocking.                                                                                                                                                                           |

## Notes

- Elixir/Erlang and DuckDB were available locally (`/opt/homebrew/bin/{mix,elixir,erl,duckdb}`)
  so both halves of the pipeline could actually be run, not just read.
- `vault` submodule's own `.gitmodules` URLs are SSH (`git@github.com:...`); the initial
  `git submodule update --init` hung indefinitely on that (no TTY for host-key/agent
  auth). Overriding to `git config submodule.vault.url https://github.com/dwarvesf/brainery.git`
  in this worktree unblocked it in seconds. Left as a local worktree-only config change,
  not committed.
- No deploy, no Railway/Pages config, no rewrite of `lib/obsidian-compiler` or the TS
  scripts was made. This branch only adds this document.
