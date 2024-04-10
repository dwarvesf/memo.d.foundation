#!/usr/bin/env bash

# Function to checkout the submodule to the specified branch if it's not set
checkout_submodule() {
	submodule=$1
	branch=$(git rev-parse --abbrev-ref HEAD)
	if [ "$(git config --get "branch.${branch}.remote")" = "" ] || [ "${branch}" = "" ]; then
		git checkout "$(git config -f "${toplevel}/.gitmodules" submodule."${name}".branch || echo main)"
	fi
}

# Function to fetch new changes for the submodule
fetch_submodule() {
	submodule=$1
	if [ -d "${submodule}" ]; then
		pushd "${submodule}" || exit
		git stash
		git pull --all
		git stash pop
		popd
	fi
}

# Function to fetch new changes for the current project
fetch_project() {
	git stash
	git pull --all
	git stash pop
}

# Get the list of submodules
submodules=$(git submodule status --recursive | awk '{print $2}')

# Fetch new changes for the current project
fetch_project

# Loop over the submodules and update them if they're not initialized
git submodule update --init --recursive --filter=blob:none

# Loop over the submodules and checkout them to the specified branch if they're not set
for submodule in $submodules; do
	checkout_submodule "${submodule}"
done

# Loop over the submodules and fetch new changes for each submodule
for submodule in $submodules; do
	fetch_submodule "${submodule}"
done
