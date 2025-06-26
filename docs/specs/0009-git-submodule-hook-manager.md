# Git Submodule Hook Manager Specification

## 1. Introduction

This document specifies the design and implementation of a Git Submodule Hook Manager. The primary goal is to provide a robust, centralized, and automated mechanism for managing Git hooks within submodules, particularly for projects utilizing a monorepository structure or multiple submodules from the `dwarvesf` organization. This addresses the limitations of traditional Git hooks, which are not version-controlled and are difficult to distribute consistently across development environments.

## 2. Goals

- Enable centralized management and distribution of Git hook logic.
- Automate the installation and removal of Git hooks in submodules.
- Ensure consistency of pre-commit, pre-push, and post-commit checks across all relevant submodules.
- Provide a user-friendly CLI for hook management.
- Generate clear documentation for each installed hook within its respective submodule.
- Support dynamic fetching of hook scripts from a remote URL.

## 3. Non-Goals

- Managing Git hooks for the main repository (this system is specifically for submodules).
- Providing a full-fledged Git hook framework with complex rule definitions (focus is on simple remote script execution).
- Offline hook execution (requires network connectivity for script fetching).

## 4. Architecture

### 4.1. Components

- **`GitSubmoduleHookManager` Class**: A TypeScript class (`scripts/git-shell-hook.ts`) responsible for:
  - Parsing `.gitmodules` to discover submodules.
  - Filtering submodules to include only those from the `dwarvesf` organization.
  - Generating and installing lightweight shell scripts (`<hook-type>-hook.sh`) in each target submodule's `.git/hooks/` directory.
  - Generating `README.md` documentation for each installed hook.
  - Providing methods for removing hooks and listing their status.
- **Generated Shell Script (`<hook-type>-hook.sh`)**: A small, executable shell script created in each submodule's `.git/hooks/` directory. This script is responsible for:
  - Determining the correct Git directory (for both regular repos and submodules).
  - Fetching the latest hook logic from a specified `scriptUrl` using `curl` or `wget`.
  - Executing the downloaded script using `tsx` (for TypeScript) or `node` (for JavaScript), or directly executing if it's a generic shell script.
  - Handling temporary file cleanup.
  - Providing install, remove, and status commands for individual submodule management.
- **Remote Hook Script**: The actual Git hook logic (e.g., linting, formatting, testing) hosted at a `scriptUrl`. This script is fetched and executed by the generated shell script.

### 4.2. Data Flow

1.  User runs `npx -y tsx scripts/git-shell-hook.ts setup --script-url <URL> --hook-type <TYPE>` from the main repository root.
2.  `GitSubmoduleHookManager` identifies relevant submodules.
3.  For each relevant submodule:
    a. A `<hook-type>-hook.sh` script is generated and placed in the submodule's `.git/hooks/` directory.
    b. A `<HOOK_TYPE>_HOOK_README.md` is generated in the submodule's root.
4.  When a Git operation (e.g., `git commit`, `git push`) triggers the installed hook in a submodule:
    a. The `<hook-type>-hook.sh` script executes.
    b. It fetches the remote hook script from the provided `scriptUrl`.
    c. The fetched script is executed (e.g., `tsx <script>`).
    d. The result of the remote script determines the success or failure of the Git operation.

## 5. Detailed Design

### 5.1. `GitSubmoduleHookManager` Class

- **Constructor**: Takes `rootDir` (defaults to `process.cwd()`).
- **`parseGitmodulesFile(gitmodulesPath, basePath)`**: Recursively parses `.gitmodules` files. Filters submodules to only include those whose URLs belong to the `dwarvesf` organization (checks both HTTPS and SSH formats).
- **`isDwarvesfSubmodule(url)`**: Helper to check if a submodule URL is from `dwarvesf`.
- **`findSubmodules(currentPath)`**: Recursively finds all submodules by traversing `.gitmodules` files.
- **`setupSubmodulesHooks(scriptUrl, hookType, modules)`**: Main setup function.
  - Iterates through discovered submodules.
  - For each target submodule, calls `createHookScript` and `createSubmoduleReadme`.
- **`removeHooksFromSubmodules(hookType, modules)`**: Removes hooks from specified or all submodules.
- **`listHookStatus()`**: Lists the installation status of hooks for all submodules.
- **`createHookScript(submodulePath, submoduleName, scriptUrl, hookType)`**: Generates the shell script for the submodule's `.git/hooks/` directory. This script includes logic for:
  - Determining the correct `.git` directory for submodules.
  - Downloading the remote script using `curl` or `wget`.
  - Executing the script with `tsx` (if `.ts` and `tsx` is available), `node` (if `.js` or `tsx` not available), or direct execution (for other types).
  - Error handling for download and execution.
  - Includes `install`, `remove`, `status` commands for local management.
- **`createSubmoduleReadme(submodulePath, submoduleName, scriptUrl, hookType)`**: Generates a detailed `README.md` for the hook in the submodule, explaining its purpose, setup, troubleshooting, and security.

### 5.2. CLI Interface

- **`main()` function**: Parses command-line arguments (`setup`, `remove`, `status`).
- **Options**: `--script-url`, `--hook-type`, `--modules`.
- **Usage**: Provides clear instructions and examples.

### 5.3. Shell Script Logic (`<hook-type>-hook.sh`)

- **`get_git_dir` function**: Robustly determines the `.git` directory, handling both main repositories and submodules (where `.git` might be a file pointing to the actual gitdir).
- **`install_hook` function**: Writes the dynamic hook content to `.git/hooks/<hook-type>` and makes it executable.
- **`remove_hook` function**: Deletes the hook file.
- **`show_status` function**: Checks if the hook file exists and is executable.
- **Main Case Statement**: Handles `install`, `remove`, `status` commands.

## 6. Security Considerations

- **Trusted `scriptUrl`**: It is critical that the `scriptUrl` points to a trusted and secure source. Malicious scripts executed via this mechanism could compromise the developer's environment.
- **Temporary Files**: The system uses temporary files for downloaded scripts and ensures their secure cleanup.
- **Permissions**: Generated hook scripts are made executable (`chmod +x`).

## 7. Future Work

- **Configuration File**: Allow hook configurations (script URL, type, modules) to be defined in a central configuration file (e.g., `.git-hook-config.json`) instead of CLI arguments.
- **Hook Versioning**: Implement a mechanism to pin or suggest specific versions of remote hook scripts.
- **Offline Mode**: Cache downloaded scripts to allow for offline execution, with a mechanism to refresh when online.
- **More Hook Types**: Extend support for other Git hook types as needed.
- **Error Reporting**: Enhance error reporting and logging for failed hook executions.

## 8. Testing

- Unit tests for `GitSubmoduleHookManager` class methods (e.g., `parseGitmodulesFile`, `isDwarvesfSubmodule`).
- Integration tests for the CLI commands (`setup`, `remove`, `status`) in a test repository with submodules.
- End-to-end tests verifying that installed hooks correctly fetch and execute remote scripts during Git operations.
