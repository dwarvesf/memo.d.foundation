setup:
	@brew install rust
	@brew install hugo
	@cargo install obsidian-export
	@git clone git@github.com:dwarvesf/content.git vault
	@mkdir -p ./content

build:
	@obsidian-export --hard-linebreaks ./vault ./content
	@hugo -DEF --minify

run:
	@obsidian-export --hard-linebreaks ./vault ./content
	hugo -DEF server

watch-run:
	@sudo rm -rf ./content
	@mkdir -p content
	@obsidian-export --hard-linebreaks ./vault ./content
	@fswatch -o ./vault | xargs -n1 -I{} obsidian-export --hard-linebreaks ./vault ./content &
	@hugo -DEF server

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
