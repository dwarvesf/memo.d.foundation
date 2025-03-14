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
	@cd lib/obsidian-compiler && mix run -e 'Memo.ExportMarkdown.run("../../vault", "../../public/content")'
	@pnpm run build

run:
	@cd lib/obsidian-compiler && mix run -e 'Memo.ExportMarkdown.run("../../vault", "../../public/content")'
	@pnpm run dev

watch-run:
	@cd lib/obsidian-compiler && mix run -e 'Memo.Application.watch_run("../../vault", "../../public/content")'

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
