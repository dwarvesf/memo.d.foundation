setup:
	@if ! command -v devbox >/dev/null 2>&1; then curl -fsSL https://get.jetpack.io/devbox | bash; fi
	@devbox install
	@mkdir -p ./content

fetch:
	@elixir scripts/update_git_settings.exs
	@./git-fetch.sh

build:
	@make clear-build
	@elixir scripts/export_media.exs --vaultpath vault
	@elixir scripts/export_markdown.exs --vaultpath vault
	@hugo -DEF --minify

clear-build:
	@rm -rf public
	@git checkout -- public
	@rm -rf content

run:
	@make clear-build
	@elixir scripts/export_media.exs --vaultpath vault
	@elixir scripts/export_markdown.exs --vaultpath vault
	@hugo -DEF --poll 2s --logLevel error server
	
watch-run:
	@make clear-build
	@elixir scripts/watch_run.exs --vaultpath vault

duckdb-export:
	@elixir scripts/export_duckdb.exs vault --format parquet