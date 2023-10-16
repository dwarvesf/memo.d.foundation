setup:
	@brew install rust
	@brew install hugo
	@cargo install obsidian-export
	@if [ ! -d "./vault" ]; then git clone git@github.com:dwarvesf/content.git vault; \
	else pushd vault && git pull && popd; fi
	@mkdir -p ./content

build:
	@cd vault && git pull
	@obsidian-export ./vault ./content
	@hugo --minify

run:
	hugo server

build-target:
	@mkdir -p vault content
	@rsync -avh $(path) ./vault/ --delete
	@obsidian-export ./vault/ ./content/
	@hugo --minify

run-target:
	@mkdir -p vault content
	@rsync -avh $(path) ./vault/ --delete
	@obsidian-export ./vault/ ./content/
	@hugo server
