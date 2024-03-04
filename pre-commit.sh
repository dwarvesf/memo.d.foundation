#!/bin/bash

# Update submodules recursively (in case they're not up-to-date)
git submodule update --init --recursive

# Function to check if the submodule is on 'main' or 'master' 
function is_on_main_or_master() {
  cd $1  # Navigate into the submodule directory
  current_branch=$(git rev-parse --abbrev-ref HEAD)
  if [[ "$current_branch" == "main" || "$current_branch" == "master" ]]; then
    return 0  # Success  
  else
    return 1  # Failure
  fi
  cd ..  # Navigate back to the main repository
}

# Iterate over submodules and check their branches
for submodule in $(git submodule status | awk '{ print $2 }'); do
  if ! is_on_main_or_master $submodule; then
    echo "Error: Submodule '$submodule' is not on 'main' or 'master'. Please switch branches."
    exit 1
  fi
done

echo "All submodules are on 'main' or 'master'. Ready to commit."
