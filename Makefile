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

build:
	@pnpm install --no-frozen-lockfile
	@cd lib/obsidian-compiler && mix export_markdown
	@cd lib/obsidian-compiler && mix duckdb.export
	@pnpm run build
	@cp -r db/ out/

run:
	@cd lib/obsidian-compiler && mix export_markdown
	@cd lib/obsidian-compiler && mix duckdb.export
	@pnpm run generate-menu
	@pnpm run generate-backlinks
	@pnpm run generate-search-index
	@pnpm run generate-redirects-map
	@pnpm run generate-user-profiles
	@pnpm run dev

duckdb-export:
	@rm -f lib/obsidian-compiler/vault.duckdb
	@cd lib/obsidian-compiler && mix duckdb.export

duckdb-export-all:
	@echo "Removing old database file..."
	@rm -f lib/obsidian-compiler/vault.db lib/obsidian-compiler/vault.db.wal # Remove DB and WAL file if it exists
	@echo "Running DuckDB export..."
	@cd lib/obsidian-compiler && mix duckdb.export_all

duckdb-export-pattern:
	@rm -f vault.duckdb
	@cd lib/obsidian-compiler && mix duckdb.export_pattern --pattern "$(pattern)"

sync-hashnode:
	@cd lib/obsidian-compiler && mix sync_hashnode
