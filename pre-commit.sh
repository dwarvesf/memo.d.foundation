#!/bin/bash

# Update submodules recursively (in case they're not up-to-date)
git submodule update --init --recursive

# Set the GIT_INDEX_FILE environment variable to the index file of the main repository
GIT_INDEX_FILE=$(pwd)/$(git rev-parse --git-dir)/index

# Function to switch a submodule to either 'main' or 'master'
function switch_submodule_branch() {
  pushd $1  # Navigate into the submodule directory
  current_branch=$(git rev-parse --abbrev-ref HEAD)

  if [[ "$current_branch" != "main" && "$current_branch" != "master" ]]; then
    # Attempt to switch to 'main' first
    if git checkout main > /dev/null; then
      echo "Submodule '$submodule' switched to 'main'"
    else 
      # If 'main' doesn't exist, try 'master'
      if git checkout master > /dev/null; then
         echo "Submodule '$submodule' switched to 'master'"
      else 
        echo "Error: Submodule '$submodule' could not be switched to 'main' or 'master'"
      fi
    fi
  fi

  popd  # Navigate back to the main repository
}

# Iterate over submodules and switch branches if necessary
for submodule in $(git submodule status | awk '{ print $2 }'); do
  switch_submodule_branch $submodule
done
