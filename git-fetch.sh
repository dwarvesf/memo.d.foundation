#!/usr/bin/env bash

# Pull and rebase
yes | git pull origin --rebase --autostash

# Function to try HTTPS if SSH fails
try_https_fallback() {
    local repo_path=$1
    cd "$repo_path"
    
    # Get the current remote URL
    local ssh_url=$(git remote get-url origin)
    
    # Only proceed if it's an SSH URL
    if [[ $ssh_url == git@* ]]; then
        # Convert SSH to HTTPS URL
        local https_url="https://github.com/${ssh_url#git@github.com:}"
        
        echo "SSH failed, trying HTTPS: $https_url"
        git remote set-url origin "$https_url"
        
        # Try pulling with HTTPS
        if ! git pull origin --rebase; then
            # If HTTPS also fails, revert to SSH
            git remote set-url origin "$ssh_url"
            return 1
        fi
    fi
}

# Loop over the submodules and update them if they're not initialized
echo "Updating submodules..."
if ! yes | git submodule update --init --recursive --remote --progress --merge --filter=blob:none; then
    echo "SSH failed for some submodules, trying HTTPS..."
    git submodule foreach 'try_https_fallback "$PWD"'
fi

# Loop over the submodules and checkout them to the specified branch if they're not set
echo "Checking out submodules..."
git submodule foreach --recursive 'branch=$(git rev-parse --abbrev-ref HEAD); if [ "$(git config --get branch.$branch.remote)" = "" ]; then git checkout $(git config -f $toplevel/.gitmodules submodule.$name.branch || echo main); fi'
