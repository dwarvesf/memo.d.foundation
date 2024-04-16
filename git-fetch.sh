#!/usr/bin/env bash

# Stash all unstaged changes and pull
echo "Stashing unstaged changes and pulling..."
git stash -u
yes | git pull origin
git stash pop

# Loop over the submodules and update them if they're not initialized
echo "Updating submodules..."
yes | git submodule update --init --recursive --remote --progress --merge --filter=blob:none

# Loop over the submodules and checkout them to the specified branch if they're not set
echo "Checking out submodules..."
git submodule foreach --recursive 'branch=$(git rev-parse --abbrev-ref HEAD); if [ "$(git config --get branch.$branch.remote)" = "" ]; then git checkout $(git config -f $toplevel/.gitmodules submodule.$name.branch || echo main); fi'
