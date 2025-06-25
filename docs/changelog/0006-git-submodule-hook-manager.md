# Git Submodule Hook Manager

## Overview

Introduced a new Git Submodule Hook Manager to streamline the management and enforcement of Git hooks across submodules within the repository. This feature significantly improves consistency and code quality by centralizing hook logic and automating its deployment.

## Key Features

- **Centralized Hook Logic**: Git hooks (pre-commit, pre-push, post-commit) are now managed from a single, version-controlled remote script, ensuring all developers use the latest and most consistent checks.
- **Dynamic Installation**: A new CLI tool (`scripts/git-shell-hook.ts`) automates the installation of lightweight shell scripts in each submodule's `.git/hooks/` directory. These shell scripts dynamically fetch and execute the latest remote hook logic.
- **Submodule Filtering**: The system intelligently identifies and applies hooks only to `dwarvesf` organization submodules, preventing unintended interference with external repositories.
- **Simplified Management**: Provides commands for easy setup, removal, and status checking of hooks across all or specific submodules.
- **Comprehensive Documentation**: Each configured submodule now includes a dedicated `README.md` file (`<HOOK_TYPE>_HOOK_README.md`) detailing how the hooks work, setup instructions, troubleshooting, and security considerations.

## How to Use

### Initial Setup (from the root of the main repository)

To set up pre-commit hooks for all `dwarvesf` submodules, run:

```bash
npx -y tsx scripts/git-shell-hook.ts setup --script-url <YOUR_REMOTE_SCRIPT_URL> --hook-type pre-commit
```

Replace `<YOUR_REMOTE_SCRIPT_URL>` with the raw URL of your desired hook script (e.g., a script hosted on GitHub).

### Managing Hooks in a Specific Submodule

After initial setup, you can manage hooks directly within each submodule:

**Install/Reinstall Hook:**
`bash
cd <submodule-path> && ./pre-commit-hook.sh install
`

**Remove Hook:**
`bash
cd <submodule-path> && ./pre-commit-hook.sh remove
`

**Check Hook Status:**
`bash
cd <submodule-path> && ./pre-commit-hook.sh status
`

_(Note: Replace `pre-commit-hook.sh` with `pre-push-hook.sh` or `post-commit-hook.sh` as appropriate for the hook type.)_

## Impact

This feature significantly enhances our development workflow by:

- **Enforcing Standards**: Ensures consistent application of linting, formatting, and other quality checks across all relevant codebases.
- **Reducing Manual Overhead**: Automates a previously manual and error-prone process of hook distribution.
- **Improving Collaboration**: Provides a standardized environment for all contributors, reducing "it works on my machine" issues related to Git hooks.

## Security Note

Be aware that the installed hooks dynamically fetch and execute scripts from a remote URL. Ensure that the `scriptUrl` points to a trusted source to mitigate security risks.
