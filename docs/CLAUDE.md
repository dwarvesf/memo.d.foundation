# Memo.d.foundation Development Guide

Scope note: the Elixir conventions below apply to `lib/obsidian-compiler/` only. The rest of the repo is TypeScript and Next.js; the root `CLAUDE.md` is authoritative for it.

## Commands

- `make setup`: Install dependencies and initialize project
- `make build`: Build the complete site
- `make run`: Run development server with live reload
- `make duckdb-export`: Rebuild `db/vault.parquet` (TypeScript, `scripts/duckdb-export.ts`)

From `lib/obsidian-compiler/`:

- `mix test`: Run all Elixir tests
- `mix test test/path/to/test_file.exs`: Run a specific test file
- `mix test test/path/to/test_file.exs:42`: Run test on line 42

## Code Style & Conventions

- **Naming**: snake_case for variables/functions, PascalCase for modules
- **Modules**: Use Memo.\* namespace, group related functionality
- **Documentation**: Document functions with @doc and use markdown formatting
- **Types**: Leverage Elixir's typespecs for function definitions
- **Error Handling**: Use pattern matching and proper error tuples (`{:ok, result}` or `{:error, reason}`)
- **Imports**: Keep imports minimal and explicit, no wildcard imports
- **Formatting**: Follow standard Elixir formatting (run `mix format` before committing)
- **Function Length**: Keep functions small and focused on a single responsibility

## Important Notes

- **The `vault` submodule is purely content, when doing any thing Claude doesn't need to look inside this directory in order to save time/tokens**
- **Prefer adding over modifying.** The markdown compiler's output is consumed byte-for-byte by the downstream TypeScript layer, so a small behaviour change here can silently shift the whole site.
- **`mix duckdb.export` is now a verification oracle, not a build step.** `scripts/duckdb-export.ts` is the production path. Change the Elixir task only to keep the oracle usable for diffing; the TypeScript port is where real fixes go. The port already diverges deliberately on `keywords` retention (see the root `CLAUDE.md`).
- **`Memo.Common.AIUtils` generates text through opencode-go**, not Google. The Elixir and TypeScript implementations must stay in step or the oracle diff becomes meaningless.
