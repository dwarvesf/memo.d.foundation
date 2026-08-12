# Project Configuration: Memo.d.Foundation

## Tech Stack

- Framework: Next.js (Pages Router)
- Language: TypeScript
- UI Components: Shadcn UI
- Styling: Tailwind CSS
- Validation: Zod (for various schemas, if used)
- Form Handling: React Hook Form (validation with Zod, UI with Shadcn form components)
- Database: DuckDB (via `@duckdb/node-api`)
- Authentication: RainbowKit, Wagmi (for Web3 authentication)
- Search: MiniSearch (client-side, lexical, over a pre-generated index)
- AI text generation: opencode-go (`deepseek-v4-flash`), OpenAI-compatible endpoint
- Deployment: Cloudflare Pages (static export, `output: 'export'`), with Pages Functions, R2 and D1
- Version Control: Git (GitHub)

## Project Structure

```
.
├── .github/              # GitHub Actions/workflows (optional)
├── .vscode/              # VSCode settings (optional)
├── db/                   # Database related files (e.g., SQL schemas, parquet data)
│   ├── load.sql          # SQL for loading data
│   ├── processing_metadata.parquet # Parquet metadata
│   └── schema.sql        # Database schema
├── functions/            # Cloudflare Pages Functions (_middleware.ts and helpers)
├── lib/
│   └── obsidian-compiler/ # Elixir compiler: parity oracle for both TS compilers, plus mix fetch / sync_hashnode
├── public/               # Static assets (images, fonts, favicon)
├── scripts/              # Various utility scripts (e.g., generation, fetching, monitoring)
│   ├── duckdb-export.ts  # TypeScript DuckDB reindexer, rebuilds db/vault.parquet
│   ├── export-markdown.ts # TypeScript markdown compiler, builds public/content
│   └── formatter/        # Scripts for formatting and linting
├── src/
│   ├── components/       # Reusable React components
│   │   └── ui/           # Shadcn UI components (added via CLI)
│   ├── constants/        # Application-wide constants
│   ├── contexts/         # React Contexts (e.g., ThemeProvider, Web3Provider)
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Shared utility functions, helpers, constants
│   ├── pages/            # Next.js Pages Router (static export; no runtime API routes)
│   │   ├── _app.tsx      # Custom App component
│   │   └── _document.tsx # Custom Document component (if present)
│   ├── styles/           # Global CSS styles
│   │   └── globals.css
│   └── types/            # Shared TypeScript types and interfaces
├── vault/                # Markdown notes and content
│   ├── assets/           # Assets for notes
│   └── updates/          # Updates/reports
├── .env                  # Local environment variables (MUST be gitignored)
├── .env.example          # Example environment variables
├── .eslintrc.cjs         # ESLint configuration
├── next.config.ts        # Next.js configuration
├── package.json          # Project dependencies and scripts
├── postcss.config.mjs    # PostCSS configuration (for Tailwind)
├── prettier.config.mjs   # Prettier configuration
├── tailwind.config.mjs   # Tailwind CSS configuration
└── tsconfig.json         # TypeScript configuration
```

_Note: File extensions (.js, .mjs, .cjs, .ts) might vary slightly based on project setup choices._

## Development Workflow

- Cline helps write and review code changes
- `.github/workflows/publish-pages.yml` deploys to Cloudflare Pages on push to main
- `pnpm dev`: Starts the development server after generating static paths.
- `pnpm build`: Generates various static assets, indexes, and then builds the Next.js application.
- `pnpm test`: Runs Vitest tests.

## Security

DO NOT read or modify:

- .env files
- \*_/config/secrets._
- Any file containing API keys or credentials
