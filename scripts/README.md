# Obsidian to Hugo Deployment

This repository contains scripts and workflows to manage and deploy content from Obsidian notes to a Hugo-based website. Below is an overview of the main components and how to use them.

## Table of Contents

1. [Setup and Installation](#setup-and-installation)
2. [Available Commands](#available-commands)
3. [Detailed Script Descriptions](#detailed-script-descriptions)
4. [GitHub Actions Workflows](#github-actions-workflows)
5. [Additional Notes](#additional-notes)

## Setup and Installation

Before running any scripts, ensure you have the necessary dependencies installed:

```bash
make setup
```

This command will install `devbox` if it's not already present and set up the required environment.

## Available Commands

Here are the main commands available via the Makefile:

### Fetching Content

```bash
make fetch
```

This runs `scripts/update_git_settings.exs` and `git-fetch.sh`.

### Building the Site

```bash
make build
```

This command clears the previous build, exports media and markdown from the vault, and builds the Hugo site.

### Running the Site Locally

```bash
make run
```

This builds the site and starts a Hugo server with live reloading.

### Watch and Run

```bash
make watch-run
```

This uses `scripts/watch_run.exs` to watch for file changes and rebuild as necessary.

### DuckDB Export

```bash
make duckdb-export
```

This runs `scripts/export_duckdb.py` to export vault data in Parquet format.

## Detailed Script Descriptions

### 1. export_duckdb.py

A Python script for exporting data to DuckDB format.

Usage:
```bash
python scripts/export_duckdb.py vault --format parquet
```

- Processes data from the `vault` directory.
- Output is in Parquet format.
- Typically run via `make duckdb-export`

### 2. export_markdown.exs

An Elixir script for exporting markdown files.

Usage:
```bash
elixir scripts/export_markdown.exs --vaultpath vault
```

- Processes markdown files from the specified vault path.
- Used in the build and run processes.

### 3. export_media.exs

An Elixir script for exporting media files.

Usage:
```bash
elixir scripts/export_media.exs --vaultpath vault
```

- Handles the export of media files from the specified vault path.
- Used in the build and run processes.

### 4. update_git_settings.exs

An Elixir script for updating git settings.

Usage:
```bash
elixir scripts/update_git_settings.exs
```

- Run as part of the `make fetch` command.
- Updates git configurations or settings before fetching content.

### 5. watch_run.exs

An Elixir script for watching file changes and running the project.

Usage:
```bash
elixir scripts/watch_run.exs --vaultpath vault
```

- Sets up a file watcher on the specified vault path.
- Monitors for file changes and triggers rebuilds as necessary.
- Starts a Hugo server for live previewing.
- Used in the `make watch-run` command for development.

Key features:
- Uses the `file_system` Elixir package for file watching.
- Implements a locking mechanism to prevent multiple simultaneous builds.
- Runs the `export_media.exs` and `export_markdown.exs` scripts when files change.
- Starts a Hugo server for live previewing.

## GitHub Actions Workflows

### Main Deployment Workflow

The repository uses a GitHub Actions workflow (`.github/workflows/main.yml`) to automatically deploy the site when changes are pushed to the `main` or `build-test` branches. This workflow:

1. Checks out the repository
2. Installs devbox
3. Runs the build process
4. Deploys to GitHub Pages
5. Sends a notification to Discord

### Manual Submodule Update

There's also a manual workflow (`.github/workflows/dispatch.yml`) that can be triggered to update submodules, export the database, and push changes.

## Additional Notes

- Make sure to set up the necessary secrets in your GitHub repository for the workflows to function correctly.
- The `Makefile` contains shortcuts for common tasks. Refer to it for more details on available commands.
- For more detailed information about specific scripts or workflows, please refer to the comments within each file.
