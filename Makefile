setup:
	@brew install rust
	@brew install hugo
	@cargo install obsidian-export
	@git clone git@github.com:dwarvesf/content.git vault
	@mkdir -p ./content

build:
	@obsidian-export ./vault ./content
	@hugo --minify

run:
	@obsidian-export ./vault ./content
	hugo server

watch-run:
	@rm -rf ./content
	@mkdir -p content
	@obsidian-export ./vault ./content
	@./inotify.sh ./vault obsidian-export ./vault ./content &
	@hugo server

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
