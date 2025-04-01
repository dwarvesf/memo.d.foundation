#!/usr/bin/env bash

# Define cache file and update interval (e.g., 1 day in seconds)
CACHE_FILE=".submodule_update_cache"
UPDATE_INTERVAL=$((60 * 60))  # 1 hour

# Function to check if update is needed
should_update() {
    if [ ! -f "$CACHE_FILE" ]; then
        return 0  # Cache doesn't exist, update needed
    fi

    local last_update=$(cat "$CACHE_FILE")
    local current_time=$(date +%s)
    local time_diff=$((current_time - last_update))

    if [ "$time_diff" -ge "$UPDATE_INTERVAL" ]; then
        return 0  # Time to update
    fi
    return 1  # No update needed
}

# Main logic
if should_update || [ "$1" == "--force" ]; then
    echo "Updating repository and submodules..."

    # Pull and rebase
    yes | git pull origin --rebase --autostash

    # Your existing try_https_fallback function here
    try_https_fallback() {
        local repo_path=$1
        cd "$repo_path"
        local ssh_url=$(git remote get-url origin)
        if [[ $ssh_url == git@* ]]; then
            local https_url="https://github.com/${ssh_url#git@github.com:}"
            echo "SSH failed, trying HTTPS: $https_url"
            git remote set-url origin "$https_url"
            if ! git pull origin --rebase; then
                git remote set-url origin "$ssh_url"
                return 1
            fi
        fi
    }

    # Update submodules
    echo "Updating submodules..."
    if ! yes | git submodule update --init --recursive --remote --progress --merge --filter=blob:none; then
        echo "SSH failed for some submodules, trying HTTPS..."
        git submodule foreach 'try_https_fallback "$PWD"'
    fi

    # Checkout submodules
    echo "Checking out submodules..."
    git submodule foreach --recursive 'branch=$(git rev-parse --abbrev-ref HEAD); if [ "$(git config --get branch.$branch.remote)" = "" ]; then git checkout $(git config -f $toplevel/.gitmodules submodule.$name.branch || echo main); fi'

    # Update cache file with current timestamp
    date +%s > "$CACHE_FILE"
else
    echo "Submodules are up-to-date (last updated: $(date -r "$CACHE_FILE")). Use --force to update anyway."
fi
