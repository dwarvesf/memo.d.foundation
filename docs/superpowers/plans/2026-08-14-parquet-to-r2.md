# Evacuate vault.parquet to R2 Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Execute task-by-task via subagent-driven development. Each task ends in a testable deliverable and a commit.

**Goal:** Stop git-tracking `db/*.parquet` (esp. the 22MB `db/vault.parquet`) in `dwarvesf/memo.d.foundation`, and make the build plus the three downstream workflows consume the parquet from Cloudflare R2 / the served `/db/vault.parquet` URL instead of the repo tree.

**Architecture:** The pipeline (scripts/build-and-deploy.sh) already regenerates `db/vault.parquet` fresh at reindex and uploads it to R2 `memo-derived` (`derived/latest/`, `derived/<sha>/`) and serves it at `https://memo.d.foundation/db/vault.parquet` from Pages `out/db`. We untrack the git blob, make the build fetch the parquet when it isn't regenerated (SKIP_REINDEX / clean checkout), and re-point the three downstream workflows to fetch from the public URL instead of the checked-out file. The post-cutover pipeline is git-read-only, so the committed parquet is already stale and the three workflows already only run manually; this change makes them read the fresh R2/served copy.

**Tech Stack:** Bash (build-and-deploy.sh), TypeScript (DuckDB via @duckdb/node-api), GitHub Actions.

**Spec:** `docs/superpowers/plans/2026-08-14-parquet-to-r2.md` (this file).

## Global Constraints

- Never break the live Pages deploy or the served `/db/vault.parquet`.
- Do NOT rewrite git history / force-push. Untracking is `git rm --cached`; the 22MB blob stays in history.
- Keep `.gitignore` addition + `db/*.sql` tracked; only the `*.parquet` binaries are untracked.
- All fetch fallbacks use the public URL `https://memo.d.foundation/db/vault.parquet` (no new secrets).
- Preserve existing behavior of the three downstream workflows (their query output), only change their *source* of the parquet and their trigger.
- Do not run project-wide lint; run the repo's Vitest suite (`pnpm vitest run`) and the build-and-deploy test.

---

## Task 1: Untrack parquet binaries and ignore them

**Files:**
- Modify: `.gitignore` (append ignore for `db/*.parquet`)
- Modify: run `git rm --cached db/vault.parquet db/processing_metadata.parquet db/processing_metadata_backup.parquet`

**Interfaces:**
- Produces: repo no longer tracks parquet binaries; `.gitignore` has `db/*.parquet`.

- [ ] **Step 1:** Read `.gitignore` tail to confirm no existing `db/*.parquet` ignore.
- [ ] **Step 2:** Append to `.gitignore`:
  ```gitignore
  # Derived DuckDB content DB. Regenerated at publish; served from R2. Not committed.
  db/*.parquet
  ```
- [ ] **Step 3:** `git rm --cached db/vault.parquet db/processing_metadata.parquet db/processing_metadata_backup.parquet` (keep `db/*.sql`).
- [ ] **Step 4:** Verify `git status` shows the three parquets as deleted-from-index only (files remain on disk), and `db/load.sql`/`schema.sql` still tracked.
- [ ] **Step 5:** Commit: `git commit -m "chore: stop tracking duckdb parquet binaries"`

## Task 2: Build fetches parquet from R2 when not regenerated

**Files:**
- Modify: `scripts/build-and-deploy.sh` (reindex stage; add a `ensure_parquet` fallback before `compile_markdown`)

**Interfaces:**
- Consumes: `SKIP_REINDEX` env (1 = skip reindex).
- Produces: an `ensure_parquet()` that guarantees `db/vault.parquet` exists before the build, fetching from the public URL otherwise.

- [ ] **Step 1:** Write the failing test (in `test/build-and-deploy.test.ts` if pattern supports it, else a plain script assertion) that `ensure_parquet` with no local file fetches and produces `db/vault.parquet`.
- [ ] **Step 2:** Add an `ensure_parquet()` function in build-and-deploy.sh: if `db/vault.parquet` is missing, `wget -q https://memo.d.foundation/db/vault.parquet -O db/vault.parquet`; fail loudly if the fetch fails.
- [ ] **Step 3:** Call `ensure_parquet` right after the reindex stage (so SKIP_REINDEX with no committed file still builds).
- [ ] **Step 4:** Run `bash scripts/build-and-deploy.test.ts`-backed test / a manual dry check: with no local parquet and `SKIP_REINDEX=1`, the fetch path is taken and the file exists.
- [ ] **Step 5:** Commit: `git commit -m "feat: fetch vault.parquet from R2 when not regenerated"`

## Task 3: Re-point the three downstream workflows to the served parquet

**Files:**
- Modify: `.github/workflows/add-mint-post.yml`
- Modify: `.github/workflows/deploy-arweave.yml`
- Modify: `.github/workflows/generate-redirects.yml`

**Interfaces:**
- Consumes: public URL `https://memo.d.foundation/db/vault.parquet`.
- Produces: workflows that download the parquet before their DuckDB query and no longer require `db/vault.parquet` in the checkout.

For each of the three workflows:
- [ ] **Step 1:** Change the `on.push.paths` trigger from `'db/vault.parquet'` to nothing (keep `workflow_dispatch`); optionally add a `workflow_run`-style trigger keyed off publish-pages success if desired (note: skip to avoid recursion; manual dispatch is the safe default).
- [ ] **Step 2:** After checkout, add a download step before the DuckDB step:
  ```yaml
  - name: Fetch vault.parquet from public site
    run: |
      mkdir -p db
      curl -fsSL -o db/vault.parquet https://memo.d.foundation/db/vault.parquet
  ```
- [ ] **Step 3:** Keep the rest (duckdb query + mint/arweave/redirect logic) unchanged; remove or neutralize the `git-commit-push` of `db/vault.parquet` (it no longer applies to an untracked file) unless commit-back of other state is needed.
- [ ] **Step 4:** Lint/validate the YAML (`actionlint` if present) and verify the workflow files parse.
- [ ] **Step 5:** Commit: `git commit -m "ci: read vault.parquet from R2/served URL in downstream workflows"`

## Task 4: Tests + negative control

- [ ] **Step 1:** Run the repo Vitest suite: `pnpm vitest run`, all pass.
- [ ] **Step 2:** Confirm `git ls-files db/` shows only `*.sql` (no parquet), and `.gitignore` matches.
- [ ] **Step 3:** Negative control: in a worktree with the committed parquet removed and `SKIP_REINDEX=1`, run the fetch path and confirm `db/vault.parquet` is produced and `scripts/export-markdown.ts`/a generate script can read it.
- [ ] **Step 4:** Open a PR to `dwarvesf/memo.d.foundation` main; add reviewers; do not auto-merge (publish/mint-adjacent change needs the team's sign-off).

## Risks / notes

- The three downstream workflows are already manual-only post-cutover (pipeline never pushes `db/vault.parquet`), so pointing them at the fresh served copy is a strict improvement and no silent break.
- Mint/Arweave state (minted_at/token_id) now lives in the R2/served parquet (`derived/latest`), which the workflows read at run time; fetch-before-query keeps it current.
- Serving `/db/vault.parquet` is unchanged (Pages `out/db` static copy from the regenerated file).
