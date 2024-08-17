setup:
	@if ! command -v devbox >/dev/null 2>&1; then curl -fsSL https://get.jetpack.io/devbox | bash; fi
	@devbox install
	@mkdir -p ./content

fetch:
	@mix run -e 'Memo.UpdateGitSettings.run()'
	@./git-fetch.sh

build:
	@make clear-build
	@mix run -e 'Memo.ExportMedia.run("vault")'
	@mix run -e 'Memo.ExportMarkdown.run("vault", "content")'
	@hugo -DEF --minify

clear-build:
	@rm -rf public
	@git checkout -- public
	@rm -rf content

run:
	@make clear-build
	@mix run -e 'Memo.ExportMedia.run("vault")'
	@mix run -e 'Memo.ExportMarkdown.run("vault", "content")'
	@hugo -DEF --poll 2s --logLevel error server
	
watch-run:
	@make clear-build
	@mix run -e 'Memo.Application.watch_run("vault", "content")'

duckdb-export:
	@mix run -e 'Memo.Application.export_duckdb("vault", "parquet")'