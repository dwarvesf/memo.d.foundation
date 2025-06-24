# Test Suite

This directory contains Jest-based tests for the memo.d.foundation project.

## Structure

```
test/
├── README.md                    # This file
├── setup.ts                     # Jest global setup and configuration
└── memo-nft-report.test.ts     # NFT report functionality tests
```

## Running Tests

### Using npm/pnpm scripts:

```bash
pnpm test                  # Run all tests
pnpm test:watch           # Run tests in watch mode
pnpm test:coverage        # Run tests with coverage report
pnpm test:nft             # Run only NFT report tests
```

### Using Makefile:

```bash
make nft-report-test      # Run NFT report tests
```

## Test Coverage

The test suite covers:

- ✅ Mock data generation and validation
- ✅ Discord embed creation and formatting
- ✅ Health status calculation logic
- ✅ Edge cases and data validation
- ✅ DuckDB PostgreSQL extension integration
- ✅ Environment variable handling
- ✅ Address privacy protection
- ✅ Discord embed size limit compliance
- ✅ Data integrity and calculations

## Configuration

Jest configuration is in `jest.config.js` with:

- TypeScript support via ts-jest
- ESM module support
- 30-second timeout for DuckDB operations
- Coverage reporting for scripts directory
- Global setup for test environment

## Adding New Tests

1. Create test files with `.test.ts` extension in this directory
2. Import test utilities from `@jest/globals`
3. Use the existing patterns for describe/test structure
4. Mock external dependencies as needed

Example:

```typescript
import { describe, test, expect } from '@jest/globals';

describe('My Feature', () => {
  test('should work correctly', () => {
    expect(true).toBe(true);
  });
});
```
