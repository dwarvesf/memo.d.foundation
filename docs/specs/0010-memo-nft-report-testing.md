# Memo NFT Report Testing Guide

## Overview

This document provides comprehensive testing procedures for the Memo NFT Report system, including unit tests, integration tests, and operational validation.

## Test Suite Architecture

### Core Components

- **Unit Tests**: Mock data validation and Discord embed generation
- **Integration Tests**: DuckDB PostgreSQL extension and database connectivity
- **Functional Tests**: End-to-end report generation and Discord delivery
- **Operational Tests**: Environment validation and prerequisite checking

### Test Runner

Custom lightweight test runner implemented in TypeScript without external dependencies:

- Simple assertion-based testing
- Comprehensive error reporting
- Performance metrics and coverage reporting
- Parallel test execution support

## Testing Commands

### Makefile Commands

#### `make nft-help`

Display comprehensive help for all NFT report commands with examples and configuration guidance.

```bash
make nft-help
```

#### `make nft-report-check`

Validate all prerequisites and configuration before running reports:

- Environment variable validation
- Database connectivity testing
- Remote parquet file accessibility
- Discord webhook validation

```bash
make nft-report-check
```

#### `make nft-report-test`

Execute the complete test suite covering all functionality:

- Mock data generation and validation
- Discord embed structure verification
- Health status calculation testing
- Edge case and error handling
- DuckDB extension functionality
- Address privacy protection

```bash
make nft-report-test
```

#### `make nft-report-dry`

Generate a complete report with verbose output without sending to Discord:

- Full data collection from both sources
- Complete analytics processing
- Discord embed generation
- Detailed logging and metrics

```bash
make nft-report-dry
```

#### `make nft-report-send`

Generate and send the complete report to Discord:

- Production report generation
- Discord webhook delivery
- Success/failure logging

```bash
make nft-report-send
```

#### `make nft-report-full`

Execute the complete workflow: prerequisite check → test suite → report generation and delivery:

```bash
make nft-report-full
```

### npm Scripts

#### Direct Script Execution

```bash
# Basic report generation
pnpm run nft-report

# Send report to Discord
pnpm run nft-report-send

# Verbose output mode
pnpm run nft-report-verbose

# Run test suite
pnpm run nft-report-test
```

#### Advanced Execution

```bash
# Direct TypeScript execution with custom flags
tsx scripts/memo-nft-report.ts --verbose
tsx scripts/memo-nft-report.ts --send
tsx scripts/test-memo-nft-report.ts
```

## Test Coverage

### Unit Tests

#### 1. Mock Data Generation

```typescript
test('Mock data generation', () => {
  // Validates structure and types of generated mock data
  // Ensures all required fields are present and properly typed
  // Verifies data consistency and realistic values
});
```

#### 2. Discord Embed Generation

```typescript
test('Discord embed generation', () => {
  // Validates Discord embed structure and format
  // Ensures all required fields are present
  // Verifies character count limits
  // Tests field organization and content formatting
});
```

#### 3. Health Status Calculation

```typescript
test('Health status calculation', () => {
  // Tests healthy status (green) conditions
  // Tests warning status (yellow) conditions
  // Validates color coding and indicators
  // Ensures threshold-based status determination
});
```

#### 4. Edge Case Handling

```typescript
test('Edge case handling', () => {
  // Tests empty data scenarios
  // Validates large number formatting
  // Ensures graceful degradation
  // Tests boundary conditions
});
```

### Integration Tests

#### 5. DuckDB PostgreSQL Extension

```typescript
test('DuckDB PostgreSQL extension test', async () => {
  // Validates DuckDB instance creation
  // Tests PostgreSQL extension loading
  // Verifies basic query functionality
  // Ensures proper resource cleanup
});
```

#### 6. Environment Variable Handling

```typescript
test('Environment variable handling', () => {
  // Tests missing environment variables
  // Validates connection string formats
  // Ensures secure credential handling
  // Tests environment restoration
});
```

### Security and Privacy Tests

#### 7. Address Truncation and Privacy

```typescript
test('Address truncation and privacy', () => {
  // Ensures full Ethereum addresses are not exposed
  // Validates truncated address format (0xabcd...1234)
  // Tests privacy protection mechanisms
  // Verifies no sensitive data leakage
});
```

#### 8. Discord Embed Size Limits

```typescript
test('Discord embed size limits', () => {
  // Tests maximum realistic data scenarios
  // Validates 6000 character Discord limit compliance
  // Ensures proper content truncation if needed
  // Tests JSON serialization efficiency
});
```

## Environment Setup for Testing

### Required Environment Variables

```bash
# PostgreSQL database connection (required for integration tests)
export MEMO_NFT_DB_CONNECTION_STRING="host=localhost port=5432 dbname=memo_nft user=username password=password"

# Discord webhook (optional for testing, required for production)
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/your-webhook-id/your-webhook-token"
```

### Alternative Environment Variable Setup

```bash
# Standard libpq environment variables (alternative approach)
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=memo_nft
export PGUSER=username
export PGPASSWORD=password
```

### Test Environment Configuration

```bash
# Minimal setup for unit tests only (no external dependencies)
unset MEMO_NFT_DB_CONNECTION_STRING
unset DISCORD_WEBHOOK_URL

# Run unit tests without integration components
tsx scripts/test-memo-nft-report.ts
```

## Test Data and Mocking

### Mock Data Structure

#### Minted Data Mock

```typescript
interface MockMintedData {
  mintableTotal: 1000,      // Total eligible content
  mintedCount: 750,         // Successfully minted
  pendingCount: 250,        // Awaiting minting
  recent24h: 15,           // Recent activity
  recent7d: 89,            // Weekly activity
  successRate: 75,         // Completion percentage
  topAuthors: [...],       // Author leaderboard
  topTags: [...],          // Popular tags
  avgTokenLength: 2500     // Content metrics
}
```

#### Collected Data Mock

```typescript
interface MockCollectedData {
  totalEvents: 2156,       // Total collection events
  totalCollected: 5432,    // Total NFTs collected
  uniqueCollectors: 234,   // Distinct collectors
  uniqueTokens: 89,        // Distinct tokens
  recent24hEvents: 45,     // Recent collections
  recent7dEvents: 278,     // Weekly collections
  topCollectors: [...],    // Collector leaderboard
  popularTokens: [...],    // Token popularity
  avgCollectionAmount: 3   // Average collection size
}
```

### Mock Data Generators

```typescript
function generateMockMintedData(): MockMintedData;
function generateMockCollectedData(): MockCollectedData;
```

## Continuous Integration Testing

### GitHub Actions Integration

#### Test Execution in CI

```yaml
- name: Run NFT Report Tests
  run: |
    pnpm run nft-report-test

- name: Validate Report Generation
  env:
    MEMO_NFT_DB_CONNECTION_STRING: ${{ secrets.MEMO_NFT_DB_CONNECTION_STRING }}
  run: |
    pnpm run nft-report-verbose
```

#### Test Artifacts

```yaml
- name: Upload Test Results
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: nft-report-test-results
    path: |
      test-results.log
      error-logs.txt
    retention-days: 7
```

## Performance Testing

### Benchmark Metrics

```bash
# Measure report generation time
time tsx scripts/memo-nft-report.ts --verbose

# Memory usage monitoring
node --inspect scripts/memo-nft-report.ts --verbose

# Database query performance
tsx scripts/memo-nft-report.ts --verbose 2>&1 | grep -E "(query|time|duration)"
```

### Load Testing

```bash
# Multiple concurrent executions
for i in {1..5}; do
  tsx scripts/memo-nft-report.ts --verbose &
done
wait
```

## Error Scenarios and Recovery Testing

### Database Connection Failures

```bash
# Test with invalid connection string
export MEMO_NFT_DB_CONNECTION_STRING="invalid-connection-string"
tsx scripts/memo-nft-report.ts --verbose

# Test with unreachable database
export MEMO_NFT_DB_CONNECTION_STRING="host=unreachable.host port=5432 dbname=memo_nft"
tsx scripts/memo-nft-report.ts --verbose
```

### Network Connectivity Issues

```bash
# Test with blocked remote parquet access
# (Requires network simulation or firewall rules)
tsx scripts/memo-nft-report.ts --verbose

# Test Discord webhook failures
export DISCORD_WEBHOOK_URL="https://invalid-webhook-url.com"
tsx scripts/memo-nft-report.ts --send
```

### Resource Constraint Testing

```bash
# Memory limit testing
node --max-old-space-size=256 scripts/memo-nft-report.ts --verbose

# CPU constraint testing
cpulimit -l 50 tsx scripts/memo-nft-report.ts --verbose
```

## Test Maintenance and Updates

### Adding New Tests

1. Add test case to `scripts/test-memo-nft-report.ts`
2. Follow existing test pattern and naming conventions
3. Include both positive and negative test scenarios
4. Update documentation with new test coverage

### Test Data Maintenance

1. Review mock data relevance regularly
2. Update mock data to reflect real-world scenarios
3. Ensure test data privacy and security compliance
4. Validate mock data against actual data structures

### Performance Baseline Updates

1. Establish performance benchmarks for each test
2. Monitor test execution time trends
3. Update expected performance thresholds
4. Optimize slow-running tests

## Debugging and Troubleshooting

### Common Test Failures

#### DuckDB Extension Loading

```bash
# Error: "Extension postgres not found"
# Solution: Ensure DuckDB installation includes postgres extension
npm list @duckdb/node-api
pnpm install @duckdb/node-api@latest
```

#### Environment Variable Issues

```bash
# Error: "MEMO_NFT_DB_CONNECTION_STRING environment variable is required"
# Solution: Set required environment variables
export MEMO_NFT_DB_CONNECTION_STRING="host=... port=... dbname=... user=... password=..."
```

#### Network Connectivity

```bash
# Error: "Remote parquet file not accessible"
# Solution: Check network connectivity and firewall rules
curl -I "https://memo.d.foundation/db/vault.parquet"
```

### Debug Mode Execution

```bash
# Enable debug logging
DEBUG=* tsx scripts/memo-nft-report.ts --verbose

# Node.js inspector mode
node --inspect-brk scripts/memo-nft-report.ts --verbose
```

### Log Analysis

```bash
# Extract performance metrics
tsx scripts/memo-nft-report.ts --verbose 2>&1 | grep -E "(✅|❌|📊|⏱️)"

# Error pattern analysis
tsx scripts/test-memo-nft-report.ts 2>&1 | grep -A 5 -B 5 "FAIL"
```

## Quality Assurance

### Test Quality Metrics

- **Code Coverage**: Aim for >90% function coverage
- **Assertion Density**: Multiple assertions per test case
- **Error Coverage**: Both positive and negative scenarios
- **Performance Bounds**: Execution time within acceptable limits

### Review Checklist

- [ ] All test cases pass consistently
- [ ] Mock data represents realistic scenarios
- [ ] Error handling covers edge cases
- [ ] Performance meets baseline requirements
- [ ] Security and privacy protections verified
- [ ] Documentation updated with new test procedures

This comprehensive testing framework ensures the reliability, performance, and security of the Memo NFT Report system across all deployment environments and usage scenarios.
