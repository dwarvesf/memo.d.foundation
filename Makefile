setup:
	@if ! command -v devbox >/dev/null 2>&1; then curl -fsSL https://get.jetpack.io/devbox | bash; fi
	@devbox install
	@mkdir -p ./content

lib-setup:
	@cd lib/obsidian-compiler && mix local.hex --force && mix local.rebar --force && mix deps.get

fetch:
	@cd lib/obsidian-compiler && mix run -e 'Memo.UpdateGitSettings.run()'
	@./git-fetch.sh

fetch-force:
	@cd lib/obsidian-compiler && mix run -e 'Memo.UpdateGitSettings.run()'
	@./git-fetch.sh --force

build:
	@pnpm install --no-frozen-lockfile
	@cd lib/obsidian-compiler && mix run -e 'Memo.ExportMarkdown.run("../../vault", "../../public/content")'
	@pnpm run build

run:
	@cd lib/obsidian-compiler && mix run -e 'Memo.ExportMarkdown.run("../../vault", "../../public/content")'
	@pnpm run generate-search-index
	@pnpm run dev

duckdb-export:
	@rm -f vault.duckdb
	@cd lib/obsidian-compiler && mix run -e 'Memo.Application.export_duckdb("../../vault", "parquet", "HEAD~2")'

duckdb-export-all:
	@rm -f vault.duckdb
	@cd lib/obsidian-compiler && mix run -e 'Memo.Application.export_duckdb("../../vault", "parquet", :all)'

duckdb-export-pattern:
	@rm -f vault.duckdb
	@cd lib/obsidian-compiler && mix run -e 'Memo.Application.export_duckdb("../../vault", "parquet", :all, "$(pattern)")'

sync-hashnode:
	@cd lib/obsidian-compiler && mix run -e 'Memo.Application.sync_hashnode("../../vault")'
