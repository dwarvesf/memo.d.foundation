#!/usr/bin/env bash

git submodule status | awk '{print $2}' | xargs -I{} bash -c 'if [ ! -f .git/modules/{}/HEAD ]; then git submodule update --init --recursive --filter=blob:none {}; fi'
git submodule foreach --recursive 'branch=$(git rev-parse --abbrev-ref HEAD); if [ "$(git config --get branch.$branch.remote)" = "" ] || [ "$branch" = "" ]; then git checkout $(git config -f $toplevel/.gitmodules submodule.$name.branch || echo main); fi'