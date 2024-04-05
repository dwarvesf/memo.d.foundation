#!/usr/bin/env bash

# Set the GIT_INDEX_FILE environment variable to the index file of the main repository
GIT_INDEX_FILE=$(pwd)/$(git rev-parse --git-dir)/index

# Check each submodule
for i in $(git submodule status | awk '{ print $2 }'); do
    pushd $i > /dev/null
    # Fetch the latest from origin
    git fetch
    # Check if the branch is behind the origin
    UPSTREAM=${1:-'@{u}'}
    LOCAL=$(git rev-parse @ 2>/dev/null)
    REMOTE=$(git rev-parse "$UPSTREAM" 2>/dev/null)
    BASE=$(git merge-base @ "$UPSTREAM" 2>/dev/null)
    if [ -z "$LOCAL" ] || [ -z "$REMOTE" ] || [ -z "$BASE" ]; then
        echo "Unable to compare with upstream. Is your upstream set?"
        popd > /dev/null
        # Unstage the submodule
        git reset HEAD $i
    else
        if [ "$LOCAL" = "$REMOTE" ]; then
            echo "Up-to-date"
        elif [ "$LOCAL" = "$BASE" ]; then
            echo "Need to pull"
            echo "Submodule $i is not up to date with origin. Please pull the latest changes."
            # Unstage the submodule
            git reset HEAD $i
        elif [ "$REMOTE" = "$BASE" ]; then
            echo "Need to push"
        else
            echo "Diverged"
        fi
    fi
    popd 2> /dev/null
done
