setup:
	@if ! command -v devbox >/dev/null 2>&1; then curl -fsSL https://get.jetpack.io/devbox | bash; fi
	@devbox install
	@mkdir -p ./content

fetch:
	@git submodule update --recursive --init --filter=blob:none
	@git submodule foreach --recursive 'git checkout $(git config -f $toplevel/.gitmodules submodule.$name.branch || echo main)'

build:
	@rm -rf public
	@git checkout -- public
	@python scripts/batch_export_markdown.py vault content
	@hugo -DEF --minify

clear-build:
	@rm -rf public
	@git checkout -- public
	@rm -rf content

run:
	@python scripts/batch_image_processor.py vault
	@python scripts/batch_export_markdown.py vault content
	@hugo -DEF --logLevel error server
	
watch-run:
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

backup-all:
	@python ./scripts/export.py vault/memo
	@python ./scripts/export.py vault/earn
	@python ./scripts/export.py vault/playbook
	@python ./scripts/export.py vault/members
	@python ./scripts/export.py vault/hiring
	@python ./scripts/export.py vault/newsletter
	@python ./scripts/export.py vault/radar