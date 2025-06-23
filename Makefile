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
	@cd lib/obsidian-compiler-go/ && ./obsidian-compiler export-markdown --vault=../../vault --export=../../public/content
	@cd lib/obsidian-compiler && mix duckdb.export
	@pnpm run build
	@pnpm run generate-nginx-conf
	@cp -r db/ out/

build-static:
	@pnpm install --no-frozen-lockfile
	@cd lib/obsidian-compiler-go/ && ./obsidian-compiler export-markdown --vault=../../vault --export=../../public/content
	@pnpm run build
	@pnpm run generate-nginx-conf
	@cp -r db/ out/

run:
	@cd lib/obsidian-compiler-go/ && ./obsidian-compiler export-markdown --vault=../../vault --export=../../public/content
	@cd lib/obsidian-compiler && mix duckdb.export
	@pnpm run generate-menu
	@pnpm run generate-menu-path-sorted
	@pnpm run generate-backlinks
	@pnpm run generate-search-index
	@pnpm run generate-redirects-map
	@pnpm run generate-shorten-map
	@pnpm run generate-pageviews
	@pnpm run fetch-prompts
	@pnpm run fetch-contributor-stats
	@pnpm run dev

duckdb-export:
	@rm -f lib/obsidian-compiler/vault.duckdb
	@cd lib/obsidian-compiler && mix duckdb.export

duckdb-export-pattern:
	@rm -f vault.duckdb
	@cd lib/obsidian-compiler && mix duckdb.export_pattern --pattern "$(pattern)"

sync-hashnode:
	@cd lib/obsidian-compiler && mix sync_hashnode
