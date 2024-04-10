#!/usr/bin/env bash

# Loop over the submodules and update them if they're not initialized
git submodule update --init --recursive --filter=blob:none

# Loop over the submodules and checkout them to the specified branch if they're not set
git submodule foreach --recursive 'branch=$(git rev-parse --abbrev-ref HEAD); if [ "$(git config --get branch.$branch.remote)" = "" ]; then git checkout $(git config -f $toplevel/.gitmodules submodule.$name.branch || echo main); fi'


# Loop over the submodules and fetch new changes for each submodule
git fetch --recurse-submodules
