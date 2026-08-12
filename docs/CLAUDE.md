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
- **Prefer adding over modifying.** The oracle's output is diffed byte-for-byte against the TypeScript ports, so a small behaviour change here turns every parity run red.
- **`mix export_markdown` and `mix duckdb.export` are verification oracles, not build steps.** `scripts/export-markdown.ts` and `scripts/duckdb-export.ts` are the production paths. Change the Elixir tasks only to keep the oracles usable for diffing; the TypeScript ports are where real fixes go. The DuckDB port already diverges deliberately on `keywords` retention (see the root `CLAUDE.md`).
- **`mix fetch`, `mix sync_hashnode`, and `mix duckdb.export_pattern` are still production.** They were never ported, so the Elixir toolchain is still a real dependency for those targets.
- **`Memo.Common.AIUtils` generates text through opencode-go**, not Google. The Elixir and TypeScript implementations must stay in step or the oracle diff becomes meaningless.
