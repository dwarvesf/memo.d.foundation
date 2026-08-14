#!/usr/bin/env bash
# Reindex the vault, build the site, publish it to Cloudflare Pages, then push
# the derived artifacts to R2 and the rollups to D1.
#
# Runner-agnostic on purpose: every knob is an environment variable and nothing
# here reads a GitHub Actions expression. .github/workflows/publish-pages.yml
# provisions the toolchain and calls this script; any machine with the same
# toolchain (Node, pnpm, jq, git) can call it directly. No Elixir and no DuckDB
# CLI: both compilers are TypeScript and reach DuckDB through @duckdb/node-api.
#
# Stages: vault -> deps -> reindex -> compile -> build -> Pages -> R2 -> D1.
#
# Required:
#   CLOUDFLARE_API_TOKEN        Pages deploy, R2 put, D1 write
#   CLOUDFLARE_ACCOUNT_ID
#
# Optional (default):
#   SKIP_REINDEX (0)            1 keeps the existing db/vault.parquet
#   GIT_FORCE_HTTPS (0)         1 rewrites git@github.com: to https, for tokened CI
#   DEPLOY_COMMIT_SHA (HEAD)    recorded on the Pages deploy and the R2 prefix
#   PAGES_PROJECT (memo-d-foundation)
#   PAGES_BRANCH (main)
#   R2_BUCKET (memo-derived)
#   D1_DATABASE_NAME (dwarves-prod)
#   PLAUSIBLE_API_TOKEN         generate-pageviews degrades without it
#
# The reindex stage reads its own credentials straight from the environment:
# OPENCODE_GO_API_KEY for SPR and keyword generation, and MEMO_EMBEDDINGS to opt
# into embedding regeneration (off by default). This script only passes the
# environment through.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

PAGES_PROJECT="${PAGES_PROJECT:-memo-d-foundation}"
PAGES_BRANCH="${PAGES_BRANCH:-main}"
R2_BUCKET="${R2_BUCKET:-memo-derived}"
D1_DATABASE_NAME="${D1_DATABASE_NAME:-dwarves-prod}"
DEPLOY_COMMIT_SHA="${DEPLOY_COMMIT_SHA:-$(git rev-parse HEAD)}"

posts_generator="${repo_root}/.ci-gen-posts.mts"
trap 'rm -f "$posts_generator"' EXIT

stage() {
  echo "=== $* ==="
}

# The Cloudflare API returns transient 5xx. A single 502 on one R2 put reds a
# 15-minute run whose Pages deploy already succeeded, so retry the idempotent
# single-shot calls instead of paying for a full rebuild.
retry() {
  local attempt=1 max=3
  while true; do
    if "$@"; then
      return 0
    fi
    if [ "$attempt" -ge "$max" ]; then
      echo "ERROR: '$*' failed after ${max} attempts." >&2
      return 1
    fi
    echo "attempt ${attempt}/${max} failed, retrying in $((attempt * 10))s: $*" >&2
    sleep $((attempt * 10))
    attempt=$((attempt + 1))
  done
}

require_env() {
  local name
  for name in "$@"; do
    if [ -z "${!name:-}" ]; then
      echo "ERROR: ${name} is required." >&2
      exit 1
    fi
  done
}

# Railway parity: the retired Dockerfile always built against the vault's latest
# origin/main, not the superproject pin. Without the advance, content freezes at
# the pin and only moves when someone bumps it by hand.
ensure_vault() {
  if [ "${GIT_FORCE_HTTPS:-0}" = "1" ]; then
    export GIT_CONFIG_COUNT=1
    export GIT_CONFIG_KEY_0='url.https://github.com/.insteadOf'
    export GIT_CONFIG_VALUE_0='git@github.com:'
  fi
  git submodule update --init --recursive --depth 1
  bash scripts/verify-submodules.sh
  git -C vault fetch --depth 1 --no-tags origin main
  git -C vault checkout --detach FETCH_HEAD
  git -C vault submodule update --init --recursive --depth 1
  git -C vault submodule status --recursive | bash scripts/verify-submodules.sh
  echo "vault at $(git -C vault rev-parse --short HEAD)"
}

install_deps() {
  pnpm install --no-frozen-lockfile
}

# Incremental by design: duckdb-export.ts regenerates text only for the notes
# whose content changed, so a normal run is cheap. Never add --ignore-filter or
# --ignore-embeddings-check here; both force a full regeneration against paid
# providers.
reindex() {
  if [ "${SKIP_REINDEX:-0}" = "1" ]; then
    echo "SKIP_REINDEX=1, keeping the existing db/vault.parquet."
    return
  fi
  make duckdb-export
}

# db/vault.parquet is no longer git-tracked (see .gitignore) and is served from
# R2 at the public URL. A full reindex regenerates it, but a SKIP_REINDEX build
# or a clean checkout has no local copy, so fetch the served one. Fail loudly:
# the build must never proceed without the content DB.
ensure_parquet() {
  if [ -f db/vault.parquet ]; then
    return 0
  fi
  echo "db/vault.parquet not present; fetching from the served R2 copy..."
  mkdir -p db
  if curl -fsSL -o db/vault.parquet https://memo.d.foundation/db/vault.parquet; then
    echo "Fetched db/vault.parquet from https://memo.d.foundation/db/vault.parquet"
  else
    echo "ERROR: failed to fetch db/vault.parquet from https://memo.d.foundation/db/vault.parquet" >&2
    exit 1
  fi
}

compile_markdown() {
  pnpm exec tsx scripts/export-markdown.ts --vault vault --output public/content --db db
}

# Pages hard-rejects the whole upload if any single file exceeds 25 MiB. Sweep
# generically by size, not by a filename list. Before stripping, verify every
# oversize file already has an R2 proxy entry; an unmapped file fails loudly
# instead of silently deploying without it (a 404 for readers).
drop_oversize_files() {
  local over file
  over=$(find out -type f -size +25M)
  if [ -z "$over" ]; then
    echo "No files over 25 MiB."
    return
  fi
  echo "Excluding from deploy (Pages rejects files > 25 MiB):"
  while IFS= read -r file; do
    ls -lh "$file"
  done <<< "$over"
  echo "$over" | pnpm exec tsx scripts/verify-oversize-assets.ts out
  while IFS= read -r file; do
    rm -f -- "$file"
  done <<< "$over"
}

build_site() {
  pnpm run build
  pnpm run generate-nginx-conf
  pnpm run build-ci-lint
  cp -r db out/
  pnpm run generate-cf-redirects
  pnpm run verify-cf-redirects
  drop_oversize_files
}

deploy_pages() {
  npx wrangler@4 pages deploy out \
    --project-name "$PAGES_PROJECT" \
    --branch "$PAGES_BRANCH" \
    --commit-hash "$DEPLOY_COMMIT_SHA" \
    --commit-dirty=true
}

r2_put() {
  local src="$1" key="$2" content_type="$3" prefix
  for prefix in "derived/${DEPLOY_COMMIT_SHA}" "derived/latest"; do
    retry npx wrangler@4 r2 object put "${R2_BUCKET}/${prefix}/${key}" \
      --file "$src" --content-type "$content_type" --remote
  done
}

upload_derived_to_r2() {
  # posts.json is generated, not scanned off disk (same rows as the memo_posts
  # D1 table; see scripts/upload-to-r2.ts header). The generator sits in the
  # repo root so its relative import resolves.
  cat > "$posts_generator" <<'EOF'
import fs from 'fs';
import { extractMemoPosts } from './scripts/extract-memo-posts';
const rows = await extractMemoPosts('db/vault.parquet');
fs.writeFileSync('/tmp/posts.json', JSON.stringify(rows));
console.log(`posts.json: ${rows.length} rows`);
EOF
  pnpm exec tsx "$posts_generator"

  r2_put db/vault.parquet                 db/vault.parquet  application/octet-stream
  r2_put public/content/search-index.json search-index.json application/json
  r2_put /tmp/posts.json                  posts.json        application/json
}

# The database id is resolved from the name, so no extra variable is needed.
upload_to_d1() {
  local database_id
  database_id=$(retry npx wrangler@4 d1 info "$D1_DATABASE_NAME" --json | jq -r '.uuid')
  if [ -z "$database_id" ] || [ "$database_id" = "null" ]; then
    echo "ERROR: could not resolve the D1 database id for ${D1_DATABASE_NAME}." >&2
    exit 1
  fi
  export D1_DATABASE_ID="$database_id"
  export D1_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID"
  export D1_API_TOKEN="$CLOUDFLARE_API_TOKEN"
  pnpm exec tsx scripts/upload-rollups-to-d1.ts
  pnpm exec tsx scripts/upload-memo-posts-to-d1.ts
}

main() {
  require_env CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
  stage "Advance vault submodule to latest main"
  ensure_vault
  stage "Install dependencies"
  install_deps
  stage "Reindex vault into db/vault.parquet"
  reindex
  stage "Ensure db/vault.parquet present"
  ensure_parquet
  stage "Compile markdown from vault"
  compile_markdown
  stage "Build static site"
  build_site
  stage "Deploy to Cloudflare Pages"
  deploy_pages
  stage "Upload derived objects to R2"
  upload_derived_to_r2
  stage "Upload rollups and memo_posts to D1"
  upload_to_d1
  stage "Done, deployed ${DEPLOY_COMMIT_SHA}"
}

# Sourced (by test/build-and-deploy.test.ts) the file only defines functions.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
