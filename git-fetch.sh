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

# Function to handle HTTPS fallback
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
export -f try_https_fallback # Export the function for subshells

# Main logic
if should_update || [ "$1" == "--force" ]; then
    echo "Updating repository and submodules..."

    # Pull and rebase
    yes | git pull origin --rebase --autostash

    # First level submodules
    echo "Updating first level submodules..."
    # Removed --depth 1 to fetch full history
    if ! git submodule update --init --depth $MAX_DEPTH; then
        echo "SSH failed for some submodules, trying HTTPS..."
        git submodule foreach 'try_https_fallback "$PWD"'
    fi

    # Process level 2 submodules manually
    echo "Updating second level submodules..."
    git submodule foreach '
        if [ -f .gitmodules ]; then
            echo "Processing submodules in $name..."
            # Removed --depth 1 to fetch full history
            if ! git submodule update --init --depth $MAX_DEPTH; then
                echo "SSH failed for submodules in $name, trying HTTPS..."
                git submodule foreach "try_https_fallback \"$PWD\""
            fi
        fi
    '

    # Checkout submodules with error handling - first level
    echo "Checking out first level submodules..."
    git submodule foreach '
        branch=$(git rev-parse --abbrev-ref HEAD)
        if [ "$(git config --get branch.$branch.remote)" = "" ]; then
            default_branch=$(git config -f $toplevel/.gitmodules submodule.$name.branch || echo master)
            if ! git checkout $default_branch; then
                echo "Failed to checkout $default_branch for $name, trying main..."
                git checkout main || echo "Failed to checkout main for $name"
            fi
        fi
        
        # Pull latest changes
        echo "Pulling updates for $name..."
        git pull --rebase --autostash origin $(git rev-parse --abbrev-ref HEAD) || true
    '

    # Checkout submodules with error handling - second level
    echo "Checking out second level submodules..."
    git submodule foreach '
        if [ -f .gitmodules ]; then
            git submodule foreach "
                branch=\$(git rev-parse --abbrev-ref HEAD)
                if [ \"\$(git config --get branch.\$branch.remote)\" = \"\" ]; then
                    default_branch=\$(git config -f \$toplevel/.gitmodules submodule.\$name.branch || echo master)
                    if ! git checkout \$default_branch; then
                        echo \"Failed to checkout \$default_branch for \$name, trying main...\"
                        git checkout main || echo \"Failed to checkout main for \$name\"
                    fi
                fi
                
                # Pull latest changes
                echo \"Pulling updates for \$name...\"
                git pull --rebase --autostash origin \$(git rev-parse --abbrev-ref HEAD) || true
            "
        fi
    '

    # Ensure we don't proceed deeper
    git config submodule.recurse false

    # Update cache file with current timestamp
    date +%s > "$CACHE_FILE"
else
    echo "Submodules are up-to-date (last updated: $(date -r "$CACHE_FILE")). Use --force to update anyway."
fi
