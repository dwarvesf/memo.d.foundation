#!/usr/bin/env bash

# Pull and rebase
yes | git pull origin --rebase --autostash

# Loop over the submodules and update them if they're not initialized
echo "Updating submodules..."
yes | git submodule update --init --recursive --remote --progress --merge --filter=blob:none

# Loop over the submodules and checkout them to the specified branch if they're not set
echo "Checking out submodules..."
git submodule foreach --recursive 'branch=$(git rev-parse --abbrev-ref HEAD); if [ "$(git config --get branch.$branch.remote)" = "" ]; then git checkout $(git config -f $toplevel/.gitmodules submodule.$name.branch || echo main); fi'
