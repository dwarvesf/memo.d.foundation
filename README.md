<p align="center">
  <img src="./public/assets/img/LOGO.png" width="200px" align="center" style="border-radius: 8px;" />
  <h1 align="center">Dwarves Memo</h1>
  <p align="center">
    ✍ <a href="https://memo.d.foundation">https://memo.d.foundation</a> ✍
    <br/>
    The vault of knowledge where we keep our internal notes from everything related to our engineering practices, new tech we are learning, and as well as business and hiring notices
  </p>
</p>
<p align="center">
<a href="https://deepwiki.com/dwarvesf/memo.d.foundation"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
<a href="https://jetpack.io/devbox/docs/contributor-quickstart"><img src="https://www.jetpack.io/img/devbox/shield_galaxy.svg" /></a>
<a href="https://twitter.com/dwarvesf"><img src="https://img.shields.io/badge/dwarvesf-blue?logo=X"></a>
<a href="https://discord.com/invite/dwarvesv"><img src="https://img.shields.io/badge/Discord-dwarvesv-blue?logo=Discord"></a>
<a href="https://www.facebook.com/dwarvesf"><img src="https://img.shields.io/badge/Facebook-dwarvesf-blue?logo=Facebook"></a>
<a href="https://d.foundation"><img src="https://img.shields.io/badge/Website-orange"></a>
</p>

## About this project

This is the repository where we keep our internal notes. We use this repo to share our knowledge, insights, and experiences with each other before we make it generally available to our community.

<img src="./home.jpeg" align="center" style="border-radius: 8px;" />

## Getting Started

We welcome contributions from anyone who is interested in our topics. You can contribute by creating a new note, editing an existing note, or commenting on a note. To do so, you need to follow these steps:

1. Fork this repo and clone it to your local machine.
2. Install [Devbox](^9^), a command-line tool that lets you easily create isolated shells and containers for development. Devbox will help you set up a consistent and reproducible environment for this repo, with all the necessary tools and dependencies installed.
3. Run `devbox shell` in the root directory of the repo to enter an isolated shell.

To run the server, you can run our Makefile command:

```sh
make run
```

or through devbox:

```sh
devbox run run
```

### Search Index

The app uses client-side search with Fuse.js. To improve build performance and reduce page size, we generate a separate search index file during the build process:

```sh
pnpm run generate-search-index
```

This script creates a static JSON file at `public/content/search-index.json` that's loaded dynamically by the client when needed, instead of being included in every page's props.

## Git Submodule Hook Manager

Our Git Submodule Hook Manager (`scripts/git-shell-hook.ts`) automates git hooks and GitHub Actions workflows across submodules with features for:

- Automated hook installation across all submodules
- GitHub Actions workflow creation for markdown linting
- Recursive submodule discovery
- Dynamic script execution on git operations
- Complete hook management (install/remove/status)

### Quick Start

#### Build the Linting Script

```bash
# Generate linting script and host it in `/public/tools/ci-lint.js` to be used by the git hooks
pnpm run build-ci-lint
```

#### Setup Git Hooks for All Submodules

```bash
# Setup pre-commit hooks for markdown linting across all submodules
pnpm run setup-hook-local
```

#### Create GitHub Actions Workflows

```bash
# Create GitHub Actions workflows for markdown linting in all submodules
pnpm run setup-gh-lint

# Setup hooks only for specific submodules
npx -y tsx scripts/git-shell-hook.ts setup --modules vault,research,playbook
```

#### Check Hook Status

```bash
# View hook status across all submodules
npx -y tsx scripts/git-shell-hook.ts status

# Create custom workflow with specific triggers
npx -y tsx scripts/git-shell-hook.ts github-actions \
  --workflow-name custom-quality-check \
  --trigger-events push,pull_request,schedule \
  --modules vault,research
```

### Individual Submodule Management

After running the setup command, each submodule will have its own hook management script:

```bash
# In any submodule directory
./pre-commit-hook.sh install  # Install hook
./pre-commit-hook.sh remove   # Remove hook
./pre-commit-hook.sh status   # Check status
```

For detailed documentation and troubleshooting, see the generated README files in each submodule after running the setup commands.

## Code of conduct

We expect all contributors to adhere to our [code of conduct](^15^), which is based on the [Contributor Covenant](https://www.contributor-covenant.org/). By participating in this project, you agree to abide by its terms. Please report any unacceptable behavior to [team@d.foundation](mailto:team@d.foundation).

## Credits

A big thank to all who contributed to this project!

If you'd like to contribute, please check out the the above Code of conduct guide.

<a href="https://github.com/dwarvesf/note.d.foundation/graphs/contributors">
<img src="https://contrib.rocks/image?repo=dwarvesf/note.d.foundation" />
</a>
