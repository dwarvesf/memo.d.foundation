# Test Suite

This directory contains Vitest tests for the memo.d.foundation project.

## Structure

Every `test/**/*.test.ts` file is picked up automatically. `test/setup.ts` holds the global setup and runs before each file.

## Running Tests

### Using npm/pnpm scripts:

```bash
pnpm test                  # Run all tests
pnpm test:watch           # Run tests in watch mode
pnpm test:coverage        # Run tests with coverage report
pnpm test:nft             # Run only NFT report tests
```

To run a single file:

```bash
pnpm exec vitest run test/duckdb-export.test.ts
```

### Using Makefile:

```bash
make test                 # Run the whole suite
make nft-report-test      # Run NFT report tests
```

## Test Coverage

The suite covers the build-side scripts: the DuckDB export and markdown compiler ports, the R2 and D1 upload paths, feed limits, draft filtering, submodule and oversize-asset verification, parquet monitoring, and the NFT report.

## Configuration

Vitest configuration is in `vitest.config.ts`:

- Node environment, TypeScript via Vite
- `@` aliased to `src/`
- 30-second timeout for DuckDB operations
- Coverage reporting over `scripts/`
- `test/setup.ts` as the global setup file

## Adding New Tests

1. Create test files with `.test.ts` extension in this directory
2. Import test utilities from `vitest`
3. Use the existing patterns for describe/test structure
4. Mock external dependencies as needed

Example:

```typescript
import { describe, test, expect } from 'vitest';

describe('My Feature', () => {
  test('should work correctly', () => {
    expect(true).toBe(true);
  });
});
```
