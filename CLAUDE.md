# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands

- `make run`: Start development server with markdown compilation and generation scripts
- `make build`: Full production build including all generation scripts and static assets
- `pnpm run dev`: Run Next.js development server (after running make run once)
- `pnpm run build`: Build Next.js application with all pre-build scripts
- `pnpm run lint`: Run ESLint for code quality checks
- `pnpm run format`: Format code using Prettier

### Content Generation Scripts

- `pnpm run generate-menu`: Generate navigation menu structure
- `pnpm run generate-search-index`: Generate client-side search index
- `pnpm run generate-backlinks`: Generate backlink relationships between notes
- `pnpm run generate-redirects-map`: Generate URL redirect mappings
- `pnpm run generate-user-profiles`: Generate contributor profile data
- `pnpm run fetch-prompts`: Fetch external prompt data
- `pnpm run fetch-contributor-stats`: Update contributor statistics

### Elixir Commands (Obsidian Compiler)

- `cd lib/obsidian-compiler && mix export_markdown`: Convert Obsidian vault to markdown
- `cd lib/obsidian-compiler && mix duckdb.export`: Export content to DuckDB database
- `cd lib/obsidian-compiler && mix test`: Run Elixir tests for markdown processing

## Architecture Overview

### Hybrid Stack Architecture

This is a unique hybrid system combining:

- **Frontend**: Next.js (React) with TypeScript for the web application
- **Content Processing**: Elixir application (`lib/obsidian-compiler`) for markdown compilation
- **Content Source**: Git submodule (`vault/`) containing Obsidian markdown files
- **Database**: DuckDB for content indexing and search
- **Deployment**: Static site generation with dynamic features

### Key Directories

- `src/`: Next.js application source code
  - `components/`: Reusable React components organized by feature
  - `pages/`: Next.js page components with file-based routing
  - `lib/`: Utility libraries for content processing, MDX handling
  - `hooks/`: Custom React hooks
  - `styles/`: CSS and styling files
- `lib/obsidian-compiler/`: Elixir application for markdown processing
- `vault/`: Git submodule containing all markdown content (Obsidian vault)
- `scripts/`: TypeScript scripts for content generation and processing
- `public/content/`: Generated JSON files for search, navigation, and metadata

### Content Processing Pipeline

1. Obsidian markdown files in `vault/` submodule
2. Elixir compiler processes markdown → standardized format + DuckDB export
3. TypeScript scripts generate navigation, search indices, and metadata
4. Next.js builds static site with client-side search and dynamic features

### Important Technical Notes

- The `vault/` directory is a git submodule containing pure content - avoid modifying during development
- Content generation scripts must run before Next.js build for proper static generation
- Client-side search uses Fuse.js with pre-generated indices for performance
- MDX rendering supports mathematical expressions (KaTeX), code highlighting, and custom components
- Web3 integration for NFT minting and contributor rewards

### Development Workflow

1. Run `make run` for full development setup (compiles markdown + starts dev server)
2. Content changes require re-running Elixir export: `cd lib/obsidian-compiler && mix export_markdown`
3. Navigation/search changes require regenerating indices before seeing updates
4. Use `make build` for production builds that include all generation steps

### Key Libraries and Frameworks

- **Next.js 15**: React framework with static site generation
- **MDX**: Markdown with React components for rich content
- **TailwindCSS**: Utility-first CSS framework
- **Elixir/Mix**: Functional language for robust markdown processing
- **DuckDB**: Embedded analytical database for content queries
- **TypeScript**: Type-safe JavaScript throughout the stack
