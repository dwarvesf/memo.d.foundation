# Coding Standards: Memo.d.Foundation (Next.js Pages Router, DuckDB, Parquet, RainbowKit, Wagmi, Shadcn)

## Objective

- Deliver a performant, maintainable, and typesafe Next.js application focused on knowledge management and Web3 integration.
- Prioritize developer experience, data integrity, and a consistent UI/UX.

## Code Style

- Use modern TypeScript with functional patterns; leverage inference.
- Name variables and functions descriptively (e.g., `isLoadingData`, `fetchVaultContent`).
- Organize files logically within `pages`, `components`, `lib`, `contexts`, `hooks`, `scripts`, `db`, `vault`.
- For UI components (forms, dialogs) that are specific to a particular page, consider co-locating them within a private `_components` folder if they are not reusable across the application.
- Avoid making page files excessively long; break down large page files into multiple, smaller, and reusable components.
- Use lowercase-kebab-case for directory and file names (e.g., `components/data-table`, `lib/utils.ts`).

## Optimization & Performance

- Optimize data fetching from DuckDB and Parquet files.
- Use Next.js `dynamic` imports for code splitting where appropriate.
- Design mobile-first, responsive UIs with Tailwind.
- Optimize images (Next.js `<Image>`, modern formats like WebP).
- Implement granular loading states (e.g., skeleton UIs for specific data tables or components) rather than hiding entire page layouts during data fetching.
- Leverage client-side caching for frequently accessed data where appropriate.

## Error Handling & Validation

- Use Zod for robust schema validation (e.g., form inputs, API route parameters).
- Handle errors gracefully in data fetching, Web3 interactions, and UI components.
- Use guard clauses and early returns for clarity.

## UI & Styling

- Utilize Shadcn UI components built on Radix UI and Tailwind CSS.
- **Prioritize Shadcn UI Design:** When making UI enhancements or adding new UI elements, always prioritize using existing Shadcn UI components and adhering to their design patterns and styling conventions. If a direct Shadcn component is not available, ensure custom components align seamlessly with the Shadcn aesthetic using Tailwind CSS.
- Maintain consistency using Tailwind utility classes and `tailwind.config.mjs`.
- Ensure accessibility and responsive design across devices.
- **Centralized Dialogs:** For common UI patterns like confirmation dialogs, use a single, reusable component (e.g., `ConfirmActionDialog`) to ensure consistency across the application and reduce code duplication.

## Form Handling

- Use React Hook Form for form state management and validation.
- Integrate Zod for schema validation with React Hook Form.
- Use Shadcn UI components for form elements (e.g., form, inputs, buttons) to ensure consistent styling and behavior.

## State & Data Management

- Use React state/context for client-side UI state.
- Manage Web3 state using Wagmi and RainbowKit.
- For data persistence and querying, interact with DuckDB and Parquet files.
- Implement data loading and processing logic within `lib/` or `hooks/` as appropriate.

## Database & Data Processing (DuckDB, Parquet)

- **Schema First:** Database schema changes should be reflected in `db/schema.sql`.
- **Data Loading:** Use `db/load.sql` for loading data into DuckDB.
- **Parquet Data:** Understand and utilize `db/processing_metadata.parquet` and `db/vault.parquet` for data storage and retrieval.
- **Scripts:** Leverage scripts in the `scripts/` directory for data generation, processing, and monitoring (e.g., `scripts/monitor-vault-parquet.ts`, `scripts/generate-static-paths.ts`).

## Security

- Manage secrets strictly via `.env` and validate as needed.
- Implement Web3 authentication securely using RainbowKit and Wagmi.
- Validate all inputs rigorously using Zod.

## Testing & Documentation

- **Type Checking:** Run `pnpm typecheck` or `pnpm check` to ensure TypeScript validity.
- **Linting:** Run `pnpm lint` to check for code style issues and `pnpm lint-staged` for pre-commit checks.
- **Formatting:** Run `pnpm format` to apply formatting rules.
- Write tests for critical logic (e.g., utility functions, data processing scripts) using Vitest.
- Add JSDoc comments for complex functions, components, and data processing logic.
- Keep `db/schema.sql` well-documented.

## Methodology

1.  **Analyze**: Understand requirements, data models (SQL, Parquet), and Web3 interactions.
2.  **Plan**: Define data flow, component structure, and Web3 integration points.
3.  **Implement**: Build features iteratively, ensuring typesafety and data integrity.
4.  **Refine**: Optimize data queries, components, and user experience.

## Workflow

1.  Define/update `db/schema.sql` and `db/load.sql` as needed.
2.  Run relevant `pnpm` scripts for data generation/processing (e.g., `pnpm run generate-static-paths`, `pnpm run generate-menu`).
3.  Implement UI components in `src/components/` and pages/layouts in `src/pages/`.
4.  Integrate data fetching/processing and Web3 interactions.
5.  Run checks (`pnpm lint`, `pnpm format`).
6.  Test, review, and optimize (`pnpm test`).
7.  Deploy application.
