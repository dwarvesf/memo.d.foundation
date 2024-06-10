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
	@python scripts/batch_image_processor.py vault
	@python scripts/batch_export_markdown.py vault content
	@hugo -DEF --minify

clear-build:
	@rm -rf public
	@git checkout -- public
	@rm -rf content
	@rm .git/hooks/pre-commit 2> /dev/null || true

run:
	@make clear-build
	@python scripts/batch_image_processor.py vault
	@python scripts/batch_export_markdown.py vault content
	@hugo -DEF --logLevel error server
	
watch-run:
	@make clear-build
	@python scripts/batch_image_processor.py vault
	@python scripts/batch_export_markdown.py vault content
	@python scripts/watch_run.py vault content

build-target:
	@mkdir -p vault content
	@rsync -avh $(path) ./vault/ --delete
	@obsidian-export --hard-linebreaks ./vault/ ./content/
	@hugo -DEF --minify

run-target:
	@mkdir -p vault content
	@rsync -avh $(path) ./vault/ --delete
	@obsidian-export --hard-linebreaks ./vault/ ./content/
	@hugo -DEF --logLevel error server

duckdb-export:
	@python scripts/export_duckdb.py vault --format parquet