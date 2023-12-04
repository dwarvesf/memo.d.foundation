setup:
	@if ! command -v devbox >/dev/null 2>&1; then curl -fsSL https://get.jetpack.io/devbox | bash; fi
	@devbox install
	@mkdir -p ./content

fetch:
	@git submodule update --init --recursive
	@git submodule update --recursive --remote
	@git pull --recurse-submodules

build:
	@obsidian-export --hard-linebreaks ./vault ./content
	@hugo -DEF --minify

run:
	@obsidian-export --hard-linebreaks ./vault ./content
	hugo -DEF --logLevel error server --poll 250ms

watch-run:
	@trash -f ./content
	@mkdir -p content
	@obsidian-export --hard-linebreaks ./vault ./content 2>/dev/null
	@fswatch -o ./vault | xargs -n1 -I{} obsidian-export --hard-linebreaks ./vault ./content &
	@hugo -DEF --logLevel error server --poll 250ms
	@trap 'killall -9 $$' SIGINT

build-target:
	@mkdir -p vault content
	@rsync -avh $(path) ./vault/ --delete
	@obsidian-export --hard-linebreaks ./vault/ ./content/
	@hugo -DEF --minify

run-target:
	@mkdir -p vault content
	@rsync -avh $(path) ./vault/ --delete
	@obsidian-export --hard-linebreaks ./vault/ ./content/
	@hugo -DEF --logLevel error server --poll 250ms
