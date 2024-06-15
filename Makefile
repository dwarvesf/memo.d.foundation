setup:
	@if ! command -v devbox >/dev/null 2>&1; then curl -fsSL https://get.jetpack.io/devbox | bash; fi
	@devbox install
	@mkdir -p ./content

fetch:
	@if [ $$(ps -ef | grep '[h]ugo' | wc -l) -eq 0 ] || [ $$(ps -ef | grep '[p]ython scripts/watch_run.py' | wc -l) -eq 0 ]; then \
		python scripts/update_git_settings.py; \
		./git-fetch.sh; \
	else \
		echo "A build process is currently running. Skipping fetch."; \
	fi

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
	@python scripts/export_duckdb.py vault --format parquet