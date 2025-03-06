# Memo.d.foundation Development Guide

## Commands

- `make setup`: Install dependencies and initialize project
- `make build`: Build the complete site
- `make run`: Run development server with live reload
- `make watch-run`: Run server with file watcher
- `mix test`: Run all tests
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
- **Prioritize making changes as new addition instead of modification, this codebase is written with Hugo templates so it's very easy to trip over and introduce bugs if not careful**
