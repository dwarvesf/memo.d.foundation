---
title: "Serve vault.parquet from R2, stop git-tracking the 22MB parquet"
status: VALIDATED
lane: full
type: migration
slug: parquet-to-r2
related_pr: dwarvesf/memo.d.foundation#341
---

# SPEC-001: Evacuate vault.parquet from git to Cloudflare R2

**Status:** VALIDATED (implemented + tested in PR #341)
**Lane:** full (touches an external provider (Cloudflare R2), a data migration of where the content DB lives, and downstream API/workflow contracts: mint, Arweave, redirects)
**Classified type:** migration

## 1. Done scenario (phase-0 contract)

The 22MB `db/vault.parquet` is no longer git-tracked in `dwarvesf/memo.d.foundation`. The publish pipeline and the three downstream workflows obtain the parquet from Cloudflare R2 / the served `/db/vault.parquet` URL instead of a committed blob. Done = the two checks in `## Verification` run and pass: (a) `git ls-files db/` shows only `*.sql`, and (b) from a clean checkout with `SKIP_REINDEX=1`, the build fetches `db/vault.parquet` from the public URL and a generate script reads it.

## 2. Problem

- `db/vault.parquet` (21.99 MB) is git-tracked. Post-Cloudflare cutover the publish pipeline (publish-pages) is git-read-only, so the committed parquet is no longer the fresh source; the pipeline regenerates it each deploy and pushes the fresh copy to R2 (`memo-derived`, `derived/latest/`) and serves it at `/db/vault.parquet`.
- The repo-root committed copy exists only to feed build-time `generate-*.ts` scripts (menu/search/backlinks/RSS/posts) via `@duckdb/node-api`, and to act as the trigger + working-tree input for `add-mint-post`, `deploy-arweave`, and `generate-redirects`. Because the pipeline never pushes it back, those triggers are effectively dormant (manual-only) and the committed copy is stale.
- Keeping a 22MB binary in git is pure cost with no freshness benefit.

## 3. Technical design

1. **Stop tracking:** append `db/*.parquet` to `.gitignore`; `git rm --cached db/*.parquet`. Keep `db/*.sql`. History is not rewritten.
2. **Build fetch fallback:** in `scripts/build-and-deploy.sh`, add `ensure_parquet()`, called after the reindex stage: if `db/vault.parquet` is absent (e.g. `SKIP_REINDEX=1` or a clean checkout), fetch it from `https://memo.d.foundation/db/vault.parquet` (`curl -fsSL`), failing loudly on error. The build keeps serving `/db/vault.parquet` from `out/db` (the regenerated file) unchanged.
3. **Downstream workflows:** in `add-mint-post.yml`, `deploy-arweave.yml`, `generate-redirects.yml`, drop the `push → 'db/vault.parquet'` path trigger (keep `workflow_dispatch`) and add a pre-query step that downloads the parquet from the served URL, so their DuckDB logic reads the fresh copy. The post-cutover pipeline never pushed the parquet, so these were already manual-only; this changes their *source* (fresh, from R2/served) without changing their output.

## 4. Source of truth / consumer map

- Build-time readers of repo-root `db/vault.parquet`: `generate-menu.ts`, `generate-backlinks.ts`, `generate-redirects-map.ts`, `generate-search-index.ts`, `extract-memo-posts.ts`, `upload-to-r2.ts`, `upload-memo-posts-to-d1.ts`, `upload-rollups-to-d1.ts`, `monitor-vault-parquet.ts`.
- Remote fetcher (precedent): `memo-nft-report.ts` already reads `https://memo.d.foundation/db/vault.parquet`.
- R2: `upload_derived_to_r2` in `build-and-deploy.sh` pushes `db/vault.parquet` to `memo-derived` (`derived/latest/`, `derived/<sha>/`).

## 5. Verification

- `git ls-files db/` → only `db/load.sql`, `db/schema.sql` (no `*.parquet`).
- Negative control: clean worktree (no committed parquet) + `SKIP_REINDEX=1` → `ensure_parquet` fetches `db/vault.parquet` from `https://memo.d.foundation/db/vault.parquet` and a `generate-*.ts` script reads it via `@duckdb/node-api`.
- `pnpm vitest run` passes (132 tests).
- Workflow YAMLs parse (actionlint clean; pre-existing shellcheck warnings only).

## 6. After state

- `db/vault.parquet` is an untracked, gitignored build artifact. The pipeline and downstream workflows read the fresh copy from R2 / `/db/vault.parquet`. No 22MB blob growth in git.

## 7. Test plan

- Unit: Vitest suite (build-and-deploy + parquet monitor tests).
- Integration: reindex + a `generate-*.ts` read against an R2-fetched parquet (negative control above).
- Acceptance: `git ls-files db/` has no parquet; the three workflow YAMLs parse.

## 8. Review

- Reviewer: dwarves team (@zlatanpham, @monotykamary on PR #341). Gate: `/kit:review`.

## 9. Known gaps / follow-ups

- This SPEC lives on a repo that is not fully dwarves-kit-adopted; the phase gates (`/kit:spec` → `/kit:ship`) are recorded here as the contract, but the enforcement hooks (ship-gate, gate-ledger) are not installed in `dwarvesf/memo.d.foundation`. Adopting the kit in that repo (to turn these advisory gates into enforced ones) is a separate, optional `migration`-lane item.
