#!/usr/bin/env tsx

/**
 * Memo NFT Report Script
 * 
 * Generates comprehensive NFT reports with two main sections:
 * 1. Minted Memo Events - Analysis of memo content ready for/already minted as NFTs
 * 2. Collected Memo Events - Analysis of actual NFT collection activities on blockchain
 * 
 * Data Sources:
 * - Parquet: https://memo.d.foundation/db/vault.parquet (minted memo analysis)
 * - PostgreSQL: memo_nft.memo_minted_events table (collection events)
 * 
 * Usage:
 *   tsx scripts/memo-nft-report.ts --send           # Send to Discord
 *   tsx scripts/memo-nft-report.ts --verbose        # Show detailed output
 *   tsx scripts/memo-nft-report.ts --test-parquet   # Test parquet queries only
 */

import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';

// Type definitions for database operations
interface QueryResult {
  getRowObjects(): Record<string, unknown>[];
}

interface MintedMetrics {
  mintableTotal: number;
  mintedCount: number;
  pendingCount: number;
  recent24h: number;
  recent7d: number;
  successRate: number;
  topAuthors: Array<{ author: string; mintedCount: number }>;
  topTags: Array<{ tag: string; count: number }>;
  avgTokenLength: number;
}

interface CollectedMetrics {
  totalEvents: number;
  totalCollected: number;
  uniqueCollectors: number;
  uniqueTokens: number;
  recent24hEvents: number;
  recent7dEvents: number;
  topCollectors: Array<{ address: string; totalAmount: number; transactions: number }>;
  popularTokens: Array<{ tokenId: number; totalCollected: number; events: number }>;
  avgCollectionAmount: number;
}

async function setupDuckDBConnections(): Promise<DuckDBConnection> {
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();

  try {
    // Load postgres extension
    await connection.runAndReadAll('LOAD postgres;');
    console.log('✅ PostgreSQL extension loaded');

    // Attach PostgreSQL database
    const connectionString = process.env.MEMO_NFT_DB_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('MEMO_NFT_DB_CONNECTION_STRING environment variable is required');
    }

    await connection.runAndReadAll(`
      ATTACH '${connectionString}' AS memo_nft_db (TYPE postgres, READ_ONLY);
    `);
    console.log('✅ PostgreSQL database attached');

    return connection;
  } catch (error) {
    console.error('❌ Failed to setup DuckDB connections:', error);
    connection.closeSync();
    throw error;
  }
}

async function collectMintedMetrics(connection: DuckDBConnection): Promise<MintedMetrics> {
  console.log('📊 Collecting minted memo metrics...');

  try {
    // Main minting statistics
    const mainStatsResult = (await connection.runAndReadAll(`
      SELECT 
        COUNT(CASE WHEN should_mint = true THEN 1 END) as mintable_total,
        COUNT(CASE WHEN should_mint = true AND minted_at IS NOT NULL THEN 1 END) as minted_count,
        COUNT(CASE WHEN should_mint = true AND minted_at IS NULL THEN 1 END) as pending_count,
        COUNT(CASE WHEN should_mint = true AND minted_at >= CURRENT_DATE - INTERVAL '1 day' THEN 1 END) as recent_24h,
        COUNT(CASE WHEN should_mint = true AND minted_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recent_7d,
        AVG(estimated_tokens) as avg_token_length
      FROM read_parquet('https://memo.d.foundation/db/vault.parquet')
    `)) as QueryResult;

    const mainStats = mainStatsResult.getRowObjects()[0];

    // Top authors by minted content
    const authorsResult = (await connection.runAndReadAll(`
      SELECT 
        author, 
        COUNT(*) as minted_count
      FROM (
        SELECT unnest(authors) as author
        FROM read_parquet('https://memo.d.foundation/db/vault.parquet')
        WHERE should_mint = true AND minted_at IS NOT NULL AND authors IS NOT NULL
      )
      WHERE author IS NOT NULL AND author != ''
      GROUP BY author 
      ORDER BY minted_count DESC 
      LIMIT 5
    `)) as QueryResult;

    // Top tags in minted content
    const tagsResult = (await connection.runAndReadAll(`
      SELECT 
        tag, 
        COUNT(*) as count
      FROM (
        SELECT unnest(tags) as tag
        FROM read_parquet('https://memo.d.foundation/db/vault.parquet')
        WHERE should_mint = true AND minted_at IS NOT NULL AND tags IS NOT NULL
      )
      WHERE tag IS NOT NULL AND tag != ''
      GROUP BY tag 
      ORDER BY count DESC 
      LIMIT 5
    `)) as QueryResult;

    const mintableTotal = Number(mainStats?.mintable_total) || 0;
    const mintedCount = Number(mainStats?.minted_count) || 0;

    return {
      mintableTotal,
      mintedCount,
      pendingCount: Number(mainStats?.pending_count) || 0,
      recent24h: Number(mainStats?.recent_24h) || 0,
      recent7d: Number(mainStats?.recent_7d) || 0,
      successRate: mintableTotal > 0 ? Math.round((mintedCount / mintableTotal) * 100) : 0,
      topAuthors: authorsResult.getRowObjects().map((row: Record<string, unknown>) => ({
        author: String(row.author || ''),
        mintedCount: Number(row.minted_count)
      })),
      topTags: tagsResult.getRowObjects().map((row: Record<string, unknown>) => ({
        tag: String(row.tag || ''),
        count: Number(row.count)
      })),
      avgTokenLength: Math.round(Number(mainStats?.avg_token_length) || 0)
    };
  } catch (error) {
    console.error('❌ Failed to collect minted metrics:', error);
    throw error;
  }
}

async function collectCollectedMetrics(connection: DuckDBConnection): Promise<CollectedMetrics> {
  console.log('💎 Collecting collected memo metrics...');

  try {
    // Main collection statistics
    const mainStatsResult = (await connection.runAndReadAll(`
      SELECT 
        COUNT(*) as total_events,
        SUM(amount) as total_collected,
        COUNT(DISTINCT "to") as unique_collectors,
        COUNT(DISTINCT token_id) as unique_tokens,
        COUNT(CASE WHEN timestamp > extract(epoch from now() - interval '1 day') THEN 1 END) as recent_24h_events,
        COUNT(CASE WHEN timestamp > extract(epoch from now() - interval '7 days') THEN 1 END) as recent_7d_events,
        AVG(amount) as avg_collection_amount
      FROM memo_nft_db.memo_nft.memo_minted_events
    `)) as QueryResult;

    const mainStats = mainStatsResult.getRowObjects()[0];

    // Top collectors
    const collectorsResult = (await connection.runAndReadAll(`
      SELECT 
        "to" as address,
        SUM(amount) as total_amount,
        COUNT(*) as transactions
      FROM memo_nft_db.memo_nft.memo_minted_events
      GROUP BY "to"
      ORDER BY total_amount DESC
      LIMIT 5
    `)) as QueryResult;

    // Most collected tokens
    const tokensResult = (await connection.runAndReadAll(`
      SELECT 
        token_id,
        SUM(amount) as total_collected,
        COUNT(*) as events
      FROM memo_nft_db.memo_nft.memo_minted_events
      GROUP BY token_id
      ORDER BY total_collected DESC
      LIMIT 5
    `)) as QueryResult;

    return {
      totalEvents: Number(mainStats?.total_events) || 0,
      totalCollected: Number(mainStats?.total_collected) || 0,
      uniqueCollectors: Number(mainStats?.unique_collectors) || 0,
      uniqueTokens: Number(mainStats?.unique_tokens) || 0,
      recent24hEvents: Number(mainStats?.recent_24h_events) || 0,
      recent7dEvents: Number(mainStats?.recent_7d_events) || 0,
      topCollectors: collectorsResult.getRowObjects().map((row: Record<string, unknown>) => ({
        address: String(row.address || ''),
        totalAmount: Number(row.total_amount),
        transactions: Number(row.transactions)
      })),
      popularTokens: tokensResult.getRowObjects().map((row: Record<string, unknown>) => ({
        tokenId: Number(row.token_id),
        totalCollected: Number(row.total_collected),
        events: Number(row.events)
      })),
      avgCollectionAmount: Math.round(Number(mainStats?.avg_collection_amount) || 0)
    };
  } catch (error) {
    console.error('❌ Failed to collect collected metrics:', error);
    throw error;
  }
}

function generateDiscordEmbed(mintedData: MintedMetrics, collectedData: CollectedMetrics) {
  // Determine health status
  const mintingEfficiency = mintedData.successRate;
  const collectionActivity = collectedData.recent24hEvents;

  const hasIssues = mintingEfficiency < 70 || collectionActivity === 0;
  const color = hasIssues ? 0xff6b35 : 0x00d4aa;
  const healthStatus = hasIssues ? '🟡' : '🟢';

  const embed = {
    embeds: [{
      title: '🎨 Memo NFT Report',
      description: `${healthStatus} Comprehensive NFT activity report for memo.d.foundation`,
      color,
      timestamp: new Date().toISOString(),
      fields: [
        {
          name: '📊 Minted Memo Events',
          value: `🏭 **Minting Pipeline Status**
• Available: **${mintedData.mintableTotal.toLocaleString()}** memos
• Minted: **${mintedData.mintedCount.toLocaleString()}** (${mintedData.successRate}% completion)
• Pending: **${mintedData.pendingCount.toLocaleString()}** memos
• Recent Activity: **${mintedData.recent24h}** (24h) | **${mintedData.recent7d}** (7d)

👥 **Top Authors (Minted Content)**
${mintedData.topAuthors.length > 0
              ? mintedData.topAuthors.map(a => `• **${a.author}**: ${a.mintedCount} minted`).join('\n')
              : '• No data available'
            }

🏷️ **Popular Tags**
${mintedData.topTags.length > 0
              ? mintedData.topTags.map(t => `• **${t.tag}**: ${t.count} memos`).join('\n')
              : '• No data available'
            }`,
          inline: false
        },
        {
          name: '💎 Collected Memo Events',
          value: `📈 **Collection Activity**
• Total Events: **${collectedData.totalEvents.toLocaleString()}**
• NFTs Collected: **${collectedData.totalCollected.toLocaleString()}**
• Unique Collectors: **${collectedData.uniqueCollectors.toLocaleString()}**
• Unique Tokens: **${collectedData.uniqueTokens.toLocaleString()}**
• Recent Activity: **${collectedData.recent24hEvents}** (24h) | **${collectedData.recent7dEvents}** (7d)

🏆 **Top Collectors**
${collectedData.topCollectors.length > 0
              ? collectedData.topCollectors.map(c =>
                `• **${c.address.substring(0, 8)}...**: ${c.totalAmount} NFTs (${c.transactions} tx)`
              ).join('\n')
              : '• No collection activity recorded'
            }

🎯 **Most Collected Tokens**
${collectedData.popularTokens.length > 0
              ? collectedData.popularTokens.map(t =>
                `• **Token #${t.tokenId}**: ${t.totalCollected} collected (${t.events} events)`
              ).join('\n')
              : '• No collection data available'
            }`,
          inline: false
        },
        {
          name: '📈 Key Metrics',
          value: `• Avg Content Length: **${mintedData.avgTokenLength.toLocaleString()}** tokens
• Avg Collection Size: **${collectedData.avgCollectionAmount}** NFTs per transaction
• Collection Efficiency: **${collectedData.uniqueTokens > 0 ? Math.round((collectedData.totalCollected / collectedData.uniqueTokens) * 100) / 100 : 0}** avg collections per token`,
          inline: false
        }
      ],
      footer: {
        text: `Generated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`
      }
    }]
  };

  return embed;
}

async function sendToDiscord(payload: Record<string, unknown>) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('⚠️  No Discord webhook URL configured, skipping notification');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
    }

    console.log('✅ Discord notification sent successfully');
  } catch (error) {
    console.error('❌ Failed to send Discord notification:', error);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const sendToDiscordFlag = args.includes('--send');
  const verbose = args.includes('--verbose');
  const testMode = args.includes('--test-parquet');

  let connection: DuckDBConnection | null = null;

  try {
    console.log('🚀 Starting Memo NFT Report generation...');

    if (testMode) {
      console.log('🧪 Test Mode: Testing parquet queries only...');
      // Create simple DuckDB instance for parquet testing
      const instance = await DuckDBInstance.create(':memory:');
      connection = await instance.connect();

      // Test only minted metrics (parquet)
      const mintedData = await collectMintedMetrics(connection);
      console.log('✅ Parquet queries working correctly');
      console.log('Minted metrics:', JSON.stringify(mintedData, null, 2));
      return;
    }

    // Setup connections
    connection = await setupDuckDBConnections();

    // Collect metrics from both sources
    const [mintedData, collectedData] = await Promise.all([
      collectMintedMetrics(connection),
      collectCollectedMetrics(connection)
    ]);

    // Generate Discord embed
    console.log('📝 Generating report...');
    const embed = generateDiscordEmbed(mintedData, collectedData);

    if (verbose) {
      console.log('\n=== MINTED METRICS ===');
      console.log(JSON.stringify(mintedData, null, 2));
      console.log('\n=== COLLECTED METRICS ===');
      console.log(JSON.stringify(collectedData, null, 2));
      console.log('\n=== DISCORD EMBED ===');
      console.log(JSON.stringify(embed, null, 2));
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Minted Content: ${mintedData.mintedCount.toLocaleString()}/${mintedData.mintableTotal.toLocaleString()} (${mintedData.successRate}%)`);
    console.log(`Collection Events: ${collectedData.totalEvents.toLocaleString()}`);
    console.log(`Total NFTs Collected: ${collectedData.totalCollected.toLocaleString()}`);
    console.log(`Unique Collectors: ${collectedData.uniqueCollectors.toLocaleString()}`);
    console.log(`Recent Activity (24h): ${mintedData.recent24h} mints | ${collectedData.recent24hEvents} collections`);

    // Check character count
    const jsonString = JSON.stringify(embed);
    console.log(`\nEmbed character count: ${jsonString.length}/6000`);

    if (sendToDiscordFlag) {
      await sendToDiscord(embed);
    } else {
      console.log('\n💡 Use --send flag to send to Discord');
    }

  } catch (error) {
    console.error('❌ Failed to generate NFT report:', error);
    process.exit(1);
  } finally {
    if (connection) {
      connection.closeSync();
    }
  }
}

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { collectMintedMetrics, collectCollectedMetrics, generateDiscordEmbed };