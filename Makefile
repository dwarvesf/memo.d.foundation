.PHONY: setup lib-setup fetch fetch-force update-submodule build build-static run duckdb-export duckdb-export-pattern sync-hashnode test

setup:
	@if ! command -v devbox >/dev/null 2>&1; then curl -fsSL https://get.jetpack.io/devbox | bash; fi
	@devbox install
	@mkdir -p ./content

lib-setup:
	@cd lib/obsidian-compiler && mix local.hex --force && mix local.rebar --force && mix deps.get
	@pnpm install --no-frozen-lockfile

fetch:
	@cd lib/obsidian-compiler && mix fetch
	@./git-fetch.sh

fetch-force:
	@cd lib/obsidian-compiler && mix fetch
	@./git-fetch.sh --force

update-submodule:
	@echo "Updating submodules..."
	@git submodule update --init --recursive --depth 1

build:
	@pnpm install --no-frozen-lockfile
	@cd lib/obsidian-compiler && mix export_markdown
	@cd lib/obsidian-compiler && mix duckdb.export
	@pnpm run build
	@pnpm run generate-nginx-conf
	@pnpm run build-ci-lint
	@cp -r db/ out/

build-static:
	@pnpm install --no-frozen-lockfile
	@cd lib/obsidian-compiler && mix export_markdown
	@pnpm run build
	@pnpm run generate-nginx-conf
	@pnpm run build-ci-lint
	@cp -r db/ out/

run:
	@cd lib/obsidian-compiler && mix export_markdown
	@cd lib/obsidian-compiler && mix duckdb.export
	@pnpm run generate-menu
	@pnpm run generate-menu-path-sorted
	@pnpm run generate-backlinks
	@pnpm run generate-search-index
	@pnpm run generate-redirects-map
	@pnpm run generate-shorten-map
	@pnpm run generate-pageviews
	@pnpm run fetch-prompts
	@pnpm run fetch-contributors
	@pnpm run dev

duckdb-export:
	@rm -f lib/obsidian-compiler/vault.duckdb
	@cd lib/obsidian-compiler && mix duckdb.export

duckdb-export-pattern:
	@rm -f vault.duckdb
	@cd lib/obsidian-compiler && mix duckdb.export_pattern --pattern "$(pattern)"

sync-hashnode:
	@cd lib/obsidian-compiler && mix sync_hashnode


test:
	pnpm test

# NFT Report Commands
nft-report-test:
	@echo "🧪 Running NFT Report Test Suite..."
	@pnpm test:nft

nft-report-dry:
	@echo "🔍 Running NFT Report (Dry Run - Verbose Output)..."
	@pnpm exec tsx scripts/memo-nft-report.ts --verbose

nft-report-test-parquet:
	@echo "🧪 Testing NFT Report Parquet Queries..."
	@pnpm exec tsx scripts/memo-nft-report.ts --test-parquet

nft-report-send:
	@echo "📊 Running NFT Report and Sending to Discord..."
	@pnpm exec tsx scripts/memo-nft-report.ts --send