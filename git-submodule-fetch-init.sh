#!/usr/bin/env bash

# Check for uninitialized submodules
uninitialized_submodules=$(git submodule status --cached | grep '^-')

# Only proceed if uninitialized submodules exist 
if [[ -n "$uninitialized_submodules" ]]; then
    echo "Uninitialized submodules found."

	git submodule update --init --recursive
	git submodule update --recursive --remote
	git submodule foreach --recursive 'git checkout $(git config -f $toplevel/.gitmodules submodule.$name.branch || echo main)'
	git pull --recurse-submodules

    echo "All uninitialized submodules initialized."
else
    echo "All submodules are already initialized."
fi