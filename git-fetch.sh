#!/usr/bin/env bash

# Define cache file and update interval (e.g., 1 day in seconds)
CACHE_FILE=".submodule_update_cache"
UPDATE_INTERVAL=$((60 * 60))  # 1 hour
export MAX_DEPTH=2  # Maximum submodule recursion depth

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

    # Update submodules
    echo "Updating submodules (max depth: $MAX_DEPTH)..."
    export DEPTH=0
    if ! yes | git submodule update --init --remote --progress --merge --filter=blob:none; then
        echo "SSH failed for some submodules, trying HTTPS..."
        git submodule foreach '
            cd "$PWD"
            ssh_url=$(git remote get-url origin)
            if [[ $ssh_url == git@* ]]; then
                https_url="https://github.com/${ssh_url#git@github.com:}"
                echo "SSH failed, trying HTTPS: $https_url"
                git remote set-url origin "$https_url"
                if ! git pull origin --rebase; then
                    git remote set-url origin "$ssh_url"
                fi
            fi
        '
    fi

    # Checkout and update submodules with depth tracking
    echo "Checking out and updating submodules (max depth: $MAX_DEPTH)..."
    export process_submodule='
        try_https_fallback() {
            local repo_path=$1
            cd "$repo_path"
            local ssh_url=$(git remote get-url origin)
            if [[ $ssh_url == git@* ]]; then
                local https_url="https://github.com/${ssh_url#git@github.com:}"
                echo "SSH failed, trying HTTPS: $https_url"
                git remote set-url origin "$https_url"
                if ! git pull origin --rebase --autostash; then
                    git remote set-url origin "$ssh_url"
                    return 1
                fi
            fi
        }

        CURRENT_DEPTH=${DEPTH:-0}
        MAX_DEPTH_VAL=${MAX_DEPTH:-2}
        if [ "$CURRENT_DEPTH" -lt "$MAX_DEPTH_VAL" ]; then
            # First checkout the correct branch
            branch=$(git rev-parse --abbrev-ref HEAD)
            if [ "$(git config --get branch.$branch.remote)" = "" ]; then
                default_branch=$(git config -f $toplevel/.gitmodules submodule.$name.branch || echo master)
                if ! git checkout $default_branch; then
                    echo "Failed to checkout $default_branch for $name, trying main..."
                    git checkout main || echo "Failed to checkout main for $name"
                fi
            fi
            
            # Get current branch and pull latest changes
            current_branch=$(git rev-parse --abbrev-ref HEAD)
            echo "Pulling updates for $name..."
            if ! git pull --rebase --autostash origin $current_branch; then
                # If rebase fails, abort it and force reset to remote
                git rebase --abort || true
                git fetch origin $current_branch
                git reset --hard origin/$current_branch
                
                # If that fails, try HTTPS
                if [ $? -ne 0 ]; then
                    try_https_fallback "$PWD"
                fi
            fi
            
            # Process nested submodules at next level level
            if [ -f .gitmodules ]; then
                # Initialize and update submodules at this level
                if ! yes | git submodule update --init --remote --progress --merge --filter=blob:none; then
                    echo "SSH failed for submodules in $name, trying HTTPS..."
                    git submodule foreach "try_https_fallback \"$PWD\""
                fi
                
                # Process next level
                export DEPTH=$((CURRENT_DEPTH + 1))
                git submodule foreach "$process_submodule"
            fi
        fi
    '
    git submodule foreach "$process_submodule"

    # Update cache file with current timestamp
    date +%s > "$CACHE_FILE"
else
    echo "Submodules are up-to-date (last updated: $(date -r "$CACHE_FILE")). Use --force to update anyway."
fi
