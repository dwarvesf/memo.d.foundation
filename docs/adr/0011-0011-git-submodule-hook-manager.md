# 0011 - Git Submodule Hook Manager

## Status

Accepted

## Context

Managing Git hooks across multiple submodules in a monorepository or a project with many submodules can be challenging. Traditional Git hooks are stored directly in `.git/hooks/` and are not version-controlled, making it difficult to standardize and distribute hooks across a team or multiple repositories. This often leads to inconsistent development environments and missed pre-commit/pre-push checks.

## Decision

To address the challenges of managing Git hooks in submodules, a centralized Git Submodule Hook Manager has been implemented. This system allows for the dynamic installation and management of Git hooks (pre-commit, pre-push, post-commit) within submodules, specifically targeting those belonging to the `dwarvesf` organization.

The core of this solution involves:

1.  **Dynamic Hook Installation**: A TypeScript script (`scripts/git-shell-hook.ts`) is provided to automate the setup of Git hooks in submodules. This script generates a small shell script in each submodule's `.git/hooks/` directory.
2.  **Remote Script Execution**: The generated shell script in the submodule's `.git/hooks/` directory does not contain the full hook logic. Instead, it dynamically fetches and executes the latest version of a specified remote script (e.g., from a GitHub raw URL) at the time of the Git operation (commit, push).
3.  **Submodule Scope**: The manager automatically detects and processes submodules defined in `.gitmodules`, with a filter to only apply to submodules from the `dwarvesf` organization.
4.  **User Interface**: A CLI interface is provided for easy setup, removal, and status checking of hooks across all or specific submodules.
5.  **Documentation**: A `README.md` file is generated within each submodule's root directory, providing clear instructions for managing the installed hooks.

## Consequences

### Positive

- **Centralized Hook Management**: Git hooks can be managed and updated from a single source (the remote script URL), ensuring consistency across all relevant submodules.
- **Version Control**: The actual hook logic is version-controlled remotely, allowing for easy updates and rollbacks without requiring developers to manually update their local hooks.
- **Ease of Setup**: Developers can quickly set up standardized hooks across all submodules with a single command.
- **Improved Code Quality**: Enforces consistent code quality checks (e.g., linting, formatting) before commits or pushes, reducing the likelihood of issues reaching the main repository.
- **Reduced Configuration Drift**: Minimizes discrepancies in development environments related to Git hooks.

### Negative

- **Network Dependency**: The hooks require an internet connection to fetch the remote script. If the network is unavailable, the hook will fail.
- **Security Considerations**: Executing remote scripts introduces a security risk if the script source is compromised. Trust in the `scriptUrl` source is paramount.
- **Initial Setup Complexity**: While simplified for end-users, the initial setup and understanding of the dynamic execution mechanism might be complex for new contributors.
- **Performance Overhead**: A slight overhead is introduced due to fetching the script on each Git operation, though this is generally negligible for typical hook operations.

## Alternatives Considered

- **Git Hooks in Main Repository**: Storing hooks in the main repository and symlinking them. This approach is less flexible for submodules as symlinks can be problematic across different OS and Git versions, and still requires manual setup per developer.
- **Git `core.hooksPath`**: Configuring `core.hooksPath` to point to a version-controlled directory. This is a good option for a single repository but doesn't scale well for managing distinct hooks across multiple submodules with different requirements.
- **Pre-built Binaries**: Distributing pre-built binaries for hooks. This adds complexity in terms of cross-platform compatibility and build processes.

## Conclusion

The chosen approach provides a robust and scalable solution for managing Git hooks in a submodule-heavy repository, prioritizing ease of use and consistency while acknowledging the inherent trade-offs.
