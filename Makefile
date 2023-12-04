setup:
	@brew install rust
	@brew install hugo
	@cargo install obsidian-export
	@git clone git@github.com:dwarvesf/content.git vault
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
	hugo -DEF server

watch-run:
	@trash -f ./content
	@mkdir -p content
	@obsidian-export --hard-linebreaks ./vault ./content 2>/dev/null
	@fswatch ./vault | awk -F 'vault' '{ system("obsidian-export --hard-linebreaks ./vault" $2 " ./content" $2 " 2>/dev/null") }' &
	@hugo -DEF server
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
	@hugo -DEF server
