#!/usr/bin/env bash

# Stash all unstaged changes and pull
echo "Stashing unstaged changes and pulling..."
oldsha=$(git rev-parse -q --verify refs/stash)
git stash -u
newsha=$(git rev-parse -q --verify refs/stash)
if [ "$oldsha" = "$newsha" ]; then
    made_stash_entry=false
else
    made_stash_entry=true
fi

yes | git pull origin

if $made_stash_entry; then git stash pop; fi

# Loop over the submodules and update them if they're not initialized
echo "Updating submodules..."
yes | git submodule update --init --recursive --remote --progress --merge --filter=blob:none

# Loop over the submodules and checkout them to the specified branch if they're not set
echo "Checking out submodules..."
git submodule foreach --recursive 'branch=$(git rev-parse --abbrev-ref HEAD); if [ "$(git config --get branch.$branch.remote)" = "" ]; then git checkout $(git config -f $toplevel/.gitmodules submodule.$name.branch || echo main); fi'
