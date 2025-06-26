# Memo NFT Report Implementation Specification

## Overview

The Memo NFT Report system provides comprehensive analytics for the NFT ecosystem of memo.d.foundation, tracking both content preparation for minting and actual collection activities on the blockchain.

## Architecture

### Data Sources

1. **Minted Memo Events**: Remote parquet file at `https://memo.d.foundation/db/vault.parquet`
2. **Collected Memo Events**: PostgreSQL database `memo_nft` with table `memo_minted_events`

### Technology Stack

- **Database Engine**: DuckDB with PostgreSQL extension
- **Runtime**: Node.js with TypeScript (tsx)
- **Notification**: Discord webhooks
- **Automation**: GitHub Actions

## Implementation Details

### Main Script: `scripts/memo-nft-report.ts`

#### Key Features

- **Unified Database Interface**: Uses DuckDB for both parquet and PostgreSQL data sources
- **Dual-Section Reporting**: Analyzes both minting pipeline and collection activities
- **Discord Integration**: Rich embed notifications with comprehensive metrics
- **Error Handling**: Graceful degradation if one data source fails

#### Data Models

```typescript
interface MintedMetrics {
  mintableTotal: number; // Total memos eligible for minting
  mintedCount: number; // Successfully minted memos
  pendingCount: number; // Memos awaiting minting
  recent24h: number; // Recent minting activity (24h)
  recent7d: number; // Recent minting activity (7d)
  successRate: number; // Minting completion percentage
  topAuthors: Array<{
    // Most prolific authors
    author: string;
    mintedCount: number;
  }>;
  topTags: Array<{
    // Popular content tags
    tag: string;
    count: number;
  }>;
  avgTokenLength: number; // Average content length
}

interface CollectedMetrics {
  totalEvents: number; // Total collection events
  totalCollected: number; // Total NFTs collected
  uniqueCollectors: number; // Distinct collector addresses
  uniqueTokens: number; // Distinct token IDs collected
  recent24hEvents: number; // Recent collection activity (24h)
  recent7dEvents: number; // Recent collection activity (7d)
  topCollectors: Array<{
    // Most active collectors
    address: string;
    totalAmount: number;
    transactions: number;
  }>;
  popularTokens: Array<{
    // Most collected tokens
    tokenId: number;
    totalCollected: number;
    events: number;
  }>;
  avgCollectionAmount: number; // Average collection size
}
```

### Database Schema

#### Parquet File Schema (vault.parquet)

```sql
-- Key fields for minting analysis
should_mint: BOOLEAN          -- Content eligible for minting
minted_at: DATE              -- Minting completion timestamp
token_id: VARCHAR            -- Assigned NFT token ID
authors: VARCHAR[]           -- Content authors
tags: VARCHAR[]              -- Content categorization tags
estimated_tokens: BIGINT     -- Content length metric
```

#### PostgreSQL Schema (memo_nft.memo_minted_events)

```sql
CREATE TABLE memo_minted_events (
  id TEXT,                   -- Event identifier
  "to" TEXT,                 -- Collector ETH address
  amount NUMERIC,            -- Number of NFTs collected
  token_id NUMERIC,          -- NFT token identifier
  timestamp INTEGER          -- Unix timestamp
);
```

### SQL Queries

#### Section 1: Minted Memo Events

```sql
-- Main minting pipeline statistics
SELECT
  COUNT(CASE WHEN should_mint = true THEN 1 END) as mintable_total,
  COUNT(CASE WHEN should_mint = true AND minted_at IS NOT NULL THEN 1 END) as minted_count,
  COUNT(CASE WHEN should_mint = true AND minted_at IS NULL THEN 1 END) as pending_count,
  COUNT(CASE WHEN should_mint = true AND minted_at >= CURRENT_DATE - INTERVAL '1 day' THEN 1 END) as recent_24h,
  AVG(estimated_tokens) as avg_token_length
FROM read_parquet('https://memo.d.foundation/db/vault.parquet');

-- Top content creators
SELECT
  unnest(authors) as author,
  COUNT(*) as minted_count
FROM read_parquet('https://memo.d.foundation/db/vault.parquet')
WHERE should_mint = true AND minted_at IS NOT NULL
GROUP BY author
ORDER BY minted_count DESC LIMIT 5;
```

#### Section 2: Collected Memo Events

```sql
-- Collection activity overview
SELECT
  COUNT(*) as total_events,
  SUM(amount) as total_collected,
  COUNT(DISTINCT "to") as unique_collectors,
  COUNT(DISTINCT token_id) as unique_tokens,
  COUNT(CASE WHEN timestamp > extract(epoch from now() - interval '1 day') THEN 1 END) as recent_24h_events
FROM memo_nft_db.memo_minted_events;

-- Top collectors analysis
SELECT
  "to" as address,
  SUM(amount) as total_amount,
  COUNT(*) as transactions
FROM memo_nft_db.memo_minted_events
GROUP BY "to"
ORDER BY total_amount DESC LIMIT 5;
```

## GitHub Actions Workflow

### Triggers

- **Schedule**: Daily at 9 AM UTC (`0 9 * * *`)
- **Manual Dispatch**: With configurable parameters
- **Push**: Development testing on `ci/nft-reporting` branch

### Environment Variables

```bash
MEMO_NFT_DB_CONNECTION_STRING="host=hostname port=5432 dbname=memo_nft user=username password=password"
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

### Workflow Features

- **Connectivity Testing**: Validates database and parquet file access
- **Health Checks**: Comprehensive environment validation
- **Error Handling**: Artifact upload for failure analysis
- **Multiple Execution Modes**: Scheduled, manual, and development

## Discord Report Format

### Report Structure

```markdown
🎨 **Memo NFT Report**
🟢 Comprehensive NFT activity report for memo.d.foundation

📊 **Section 1: Minted Memo Events**
🏭 Pipeline Status
• Available: 1,234 memos
• Minted: 987 (80% completion)
• Pending: 247 memos
• Recent Activity: 15 (24h) | 89 (7d)

👥 Top Authors (Minted Content)
• author1: 45 minted
• author2: 38 minted

💎 **Section 2: Collected Memo Events**
📈 Collection Activity
• Total Events: 2,156
• NFTs Collected: 5,432
• Unique Collectors: 234
• Recent Activity: 89 (24h) | 456 (7d)

🏆 Top Collectors
• 0xfdfb...e79e: 156 NFTs (23 tx)
• 0x1234...5678: 134 NFTs (18 tx)
```

### Health Status Indicators

- 🟢 **Healthy**: Minting efficiency ≥70%, recent collection activity
- 🟡 **Warning**: Low minting efficiency or no recent collections
- 🔴 **Critical**: System errors or data unavailability

## Usage Instructions

### Local Development

```bash
# Install dependencies
pnpm install

# Set environment variables
export MEMO_NFT_DB_CONNECTION_STRING="your-connection-string"
export DISCORD_WEBHOOK_URL="your-webhook-url"

# Run with verbose output
tsx scripts/memo-nft-report.ts --verbose

# Send to Discord
tsx scripts/memo-nft-report.ts --send
```

### Production Deployment

1. Configure GitHub repository secrets:

   - `MEMO_NFT_DB_CONNECTION_STRING`
   - `DISCORD_WEBHOOK_URL`

2. Workflow runs automatically daily or manually via GitHub Actions UI

### Monitoring

- Check GitHub Actions for execution logs
- Monitor Discord channel for regular reports
- Review health check results for system validation

## Error Handling & Recovery

### Common Issues

1. **Database Connection Failures**

   - Verify connection string format
   - Check network connectivity
   - Validate credentials

2. **Parquet File Unavailability**

   - Confirm URL accessibility
   - Check file permissions
   - Verify network policies

3. **Discord Webhook Failures**
   - Validate webhook URL
   - Check channel permissions
   - Monitor rate limits

### Graceful Degradation

- Single-source reporting if one data source fails
- Comprehensive error logging and artifact collection
- Automatic retry mechanisms for transient failures

## Performance Considerations

### Optimization Strategies

- **Connection Pooling**: Efficient DuckDB resource management
- **Query Optimization**: Indexed and filtered data access
- **Parallel Processing**: Concurrent data collection from multiple sources
- **Caching**: Local temporary storage during processing

### Resource Requirements

- **Memory**: ~500MB for DuckDB operations
- **Network**: Outbound HTTPS for parquet and Discord
- **Database**: Read-only PostgreSQL access
- **Runtime**: Node.js 20+ with TypeScript support

## Security Considerations

### Access Control

- **Read-Only Database Access**: Prevents data modification
- **Environment Variable Storage**: Secure credential management
- **GitHub Secrets**: Encrypted secret storage
- **Network Restrictions**: HTTPS-only communications

### Data Privacy

- **Address Truncation**: Partial display of ETH addresses
- **Aggregated Metrics**: No individual transaction details
- **Public Parquet Access**: Read-only external data source

## Future Enhancements

### Potential Improvements

1. **Cross-Source Analytics**: JOIN queries between parquet and PostgreSQL
2. **Trend Analysis**: Historical data comparison and forecasting
3. **Alert System**: Threshold-based notifications for anomalies
4. **Dashboard Integration**: Web-based visualization interface
5. **Multi-Chain Support**: Expansion to additional blockchain networks

### Scalability Considerations

- **Data Volume Growth**: Optimized queries for larger datasets
- **Frequency Adjustment**: Configurable reporting intervals
- **Additional Metrics**: Expandable analytics framework
- **Multiple Destinations**: Support for various notification channels
