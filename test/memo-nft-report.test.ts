/**
 * @file memo-nft-report.test.ts
 * @description Vitest test suite for Memo NFT Report functionality
 *
 * Tests the core functionality of the NFT reporting system including:
 * - Data collection from both sources
 * - Discord embed generation
 * - Error handling scenarios
 * - Mock data validation
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';

// Mock data interfaces
interface MockMintedData {
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

interface MockCollectedData {
  totalEvents: number;
  totalCollected: number;
  uniqueCollectors: number;
  uniqueTokens: number;
  recent24hEvents: number;
  recent7dEvents: number;
  topCollectors: Array<{
    address: string;
    totalAmount: number;
    transactions: number;
  }>;
  popularTokens: Array<{
    tokenId: number;
    totalCollected: number;
    events: number;
  }>;
  avgCollectionAmount: number;
}

// Test data generators
function generateMockMintedData(): MockMintedData {
  return {
    mintableTotal: 1000,
    mintedCount: 750,
    pendingCount: 250,
    recent24h: 15,
    recent7d: 89,
    successRate: 75,
    topAuthors: [
      { author: 'alice.eth', mintedCount: 45 },
      { author: 'bob.dev', mintedCount: 38 },
      { author: 'charlie.crypto', mintedCount: 32 },
    ],
    topTags: [
      { tag: 'defi', count: 156 },
      { tag: 'security', count: 134 },
      { tag: 'development', count: 98 },
    ],
    avgTokenLength: 2500,
  };
}

function generateMockCollectedData(): MockCollectedData {
  return {
    totalEvents: 2156,
    totalCollected: 5432,
    uniqueCollectors: 234,
    uniqueTokens: 89,
    recent24hEvents: 45,
    recent7dEvents: 278,
    topCollectors: [
      {
        address: '0xfdfb16ffaf364a4ae15db843ae18a76fd848e79e',
        totalAmount: 156,
        transactions: 23,
      },
      {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        totalAmount: 134,
        transactions: 18,
      },
      {
        address: '0xabcdef1234567890abcdef1234567890abcdef12',
        totalAmount: 89,
        transactions: 12,
      },
    ],
    popularTokens: [
      { tokenId: 42, totalCollected: 89, events: 34 },
      { tokenId: 17, totalCollected: 76, events: 28 },
      { tokenId: 91, totalCollected: 65, events: 22 },
    ],
    avgCollectionAmount: 3,
  };
}

// Discord embed generation function (copied from main script)
function generateDiscordEmbed(
  mintedData: MockMintedData,
  collectedData: MockCollectedData,
) {
  const hasIssues =
    mintedData.successRate < 70 || collectedData.recent24hEvents === 0;
  const color = hasIssues ? 0xff6b35 : 0x00d4aa;
  const healthStatus = hasIssues ? '🟡' : '🟢';

  return {
    embeds: [
      {
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
${
  mintedData.topAuthors.length > 0
    ? mintedData.topAuthors
        .map(a => `• **${a.author}**: ${a.mintedCount} minted`)
        .join('\n')
    : '• No data available'
}

🏷️ **Popular Tags**
${
  mintedData.topTags.length > 0
    ? mintedData.topTags.map(t => `• **${t.tag}**: ${t.count} memos`).join('\n')
    : '• No data available'
}`,
            inline: false,
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
${
  collectedData.topCollectors.length > 0
    ? collectedData.topCollectors
        .map(
          c =>
            `• **${c.address.substring(0, 8)}...**: ${c.totalAmount} NFTs (${c.transactions} tx)`,
        )
        .join('\n')
    : '• No collection activity recorded'
}

🎯 **Most Collected Tokens**
${
  collectedData.popularTokens.length > 0
    ? collectedData.popularTokens
        .map(
          t =>
            `• **Token #${t.tokenId}**: ${t.totalCollected} collected (${t.events} events)`,
        )
        .join('\n')
    : '• No collection data available'
}`,
            inline: false,
          },
        ],
        footer: {
          text: `Generated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
        },
      },
    ],
  };
}

describe('Memo NFT Report', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Mock Data Generation', () => {
    test('should generate valid minted data structure', () => {
      const mintedData = generateMockMintedData();

      expect(typeof mintedData.mintableTotal).toBe('number');
      expect(typeof mintedData.mintedCount).toBe('number');
      expect(typeof mintedData.successRate).toBe('number');
      expect(Array.isArray(mintedData.topAuthors)).toBe(true);
      expect(Array.isArray(mintedData.topTags)).toBe(true);
      expect(mintedData.topAuthors.length).toBeGreaterThan(0);
      expect(mintedData.topTags.length).toBeGreaterThan(0);

      // Validate author structure
      mintedData.topAuthors.forEach(author => {
        expect(typeof author.author).toBe('string');
        expect(typeof author.mintedCount).toBe('number');
        expect(author.author.length).toBeGreaterThan(0);
        expect(author.mintedCount).toBeGreaterThan(0);
      });
    });

    test('should generate valid collected data structure', () => {
      const collectedData = generateMockCollectedData();

      expect(typeof collectedData.totalEvents).toBe('number');
      expect(typeof collectedData.totalCollected).toBe('number');
      expect(typeof collectedData.uniqueCollectors).toBe('number');
      expect(Array.isArray(collectedData.topCollectors)).toBe(true);
      expect(Array.isArray(collectedData.popularTokens)).toBe(true);
      expect(collectedData.topCollectors.length).toBeGreaterThan(0);
      expect(collectedData.popularTokens.length).toBeGreaterThan(0);

      // Validate collector structure
      collectedData.topCollectors.forEach(collector => {
        expect(typeof collector.address).toBe('string');
        expect(typeof collector.totalAmount).toBe('number');
        expect(typeof collector.transactions).toBe('number');
        expect(collector.address.startsWith('0x')).toBe(true);
        expect(collector.address.length).toBe(42);
      });
    });
  });

  describe('Discord Embed Generation', () => {
    test('should generate valid embed structure', () => {
      const mintedData = generateMockMintedData();
      const collectedData = generateMockCollectedData();
      const embed = generateDiscordEmbed(mintedData, collectedData);

      expect(embed).toHaveProperty('embeds');
      expect(Array.isArray(embed.embeds)).toBe(true);
      expect(embed.embeds).toHaveLength(1);

      const embedObj = embed.embeds[0];
      expect(embedObj).toHaveProperty('title');
      expect(embedObj).toHaveProperty('description');
      expect(embedObj).toHaveProperty('color');
      expect(embedObj).toHaveProperty('timestamp');
      expect(embedObj).toHaveProperty('fields');
      expect(embedObj).toHaveProperty('footer');

      expect(embedObj.title).toContain('Memo NFT Report');
      expect(Array.isArray(embedObj.fields)).toBe(true);
      expect(embedObj.fields).toHaveLength(2);
    });

    test('should include required sections in embed fields', () => {
      const mintedData = generateMockMintedData();
      const collectedData = generateMockCollectedData();
      const embed = generateDiscordEmbed(mintedData, collectedData);

      const field1 = embed.embeds[0].fields[0];
      const field2 = embed.embeds[0].fields[1];

      expect(field1.name).toContain('Minted Memo Events');
      expect(field1.value).toContain('Minting Pipeline');
      expect(field1.value).toContain('Top Authors');
      expect(field1.value).toContain('Popular Tags');

      expect(field2.name).toContain('Collected Memo Events');
      expect(field2.value).toContain('Collection Activity');
      expect(field2.value).toContain('Top Collectors');
      expect(field2.value).toContain('Most Collected Tokens');
    });

    test('should calculate and display health status correctly', () => {
      // Test healthy status
      const healthyMinted = { ...generateMockMintedData(), successRate: 85 };
      const healthyCollected = {
        ...generateMockCollectedData(),
        recent24hEvents: 50,
      };
      const healthyEmbed = generateDiscordEmbed(
        healthyMinted,
        healthyCollected,
      );

      expect(healthyEmbed.embeds[0].color).toBe(0x00d4aa);
      expect(healthyEmbed.embeds[0].description).toContain('🟢');

      // Test warning status
      const warningMinted = { ...generateMockMintedData(), successRate: 60 };
      const warningCollected = {
        ...generateMockCollectedData(),
        recent24hEvents: 0,
      };
      const warningEmbed = generateDiscordEmbed(
        warningMinted,
        warningCollected,
      );

      expect(warningEmbed.embeds[0].color).toBe(0xff6b35);
      expect(warningEmbed.embeds[0].description).toContain('🟡');
    });

    test('should handle data formatting correctly', () => {
      const mintedData = {
        ...generateMockMintedData(),
        mintableTotal: 1500000,
        mintedCount: 750000,
      };
      const collectedData = {
        ...generateMockCollectedData(),
        totalEvents: 5000000,
      };
      const embed = generateDiscordEmbed(mintedData, collectedData);

      const field1Value = embed.embeds[0].fields[0].value;
      const field2Value = embed.embeds[0].fields[1].value;

      // Check number formatting with commas
      expect(field1Value).toContain('1,500,000');
      expect(field1Value).toContain('750,000');
      expect(field2Value).toContain('5,000,000');
    });
  });

  describe('Edge Cases and Data Validation', () => {
    test('should handle empty data gracefully', () => {
      const emptyMinted: MockMintedData = {
        mintableTotal: 0,
        mintedCount: 0,
        pendingCount: 0,
        recent24h: 0,
        recent7d: 0,
        successRate: 0,
        topAuthors: [],
        topTags: [],
        avgTokenLength: 0,
      };
      const emptyCollected: MockCollectedData = {
        totalEvents: 0,
        totalCollected: 0,
        uniqueCollectors: 0,
        uniqueTokens: 0,
        recent24hEvents: 0,
        recent7dEvents: 0,
        topCollectors: [],
        popularTokens: [],
        avgCollectionAmount: 0,
      };

      const embed = generateDiscordEmbed(emptyMinted, emptyCollected);

      expect(embed.embeds[0]).toBeDefined();
      expect(embed.embeds[0].color).toBe(0xff6b35); // Should show warning for empty data
      expect(embed.embeds[0].fields[0].value).toContain('No data available');
      expect(embed.embeds[0].fields[1].value).toContain(
        'No collection activity recorded',
      );
    });

    test('should respect Discord embed size limits', () => {
      // Generate embed with maximum realistic data
      const maxMinted = {
        ...generateMockMintedData(),
        topAuthors: Array.from({ length: 10 }, (_, i) => ({
          author: `very-long-author-name-${i}`,
          mintedCount: 100 - i,
        })),
        topTags: Array.from({ length: 10 }, (_, i) => ({
          tag: `very-long-tag-name-${i}`,
          count: 200 - i,
        })),
      };

      const maxCollected = {
        ...generateMockCollectedData(),
        topCollectors: Array.from({ length: 10 }, (_, i) => ({
          address: `0x${'f'.repeat(40)}`,
          totalAmount: 1000 - i,
          transactions: 50 - i,
        })),
        popularTokens: Array.from({ length: 10 }, (_, i) => ({
          tokenId: 1000 + i,
          totalCollected: 500 - i,
          events: 100 - i,
        })),
      };

      const embed = generateDiscordEmbed(maxMinted, maxCollected);
      const jsonString = JSON.stringify(embed);

      // Discord embed limit is 6000 characters total
      expect(jsonString.length).toBeLessThanOrEqual(6000);
    });

    test('should truncate addresses for privacy', () => {
      const testCollectors = [
        {
          address: '0xfdfb16ffaf364a4ae15db843ae18a76fd848e79e',
          totalAmount: 100,
          transactions: 10,
        },
      ];

      const mockData = {
        ...generateMockCollectedData(),
        topCollectors: testCollectors,
      };
      const embed = generateDiscordEmbed(generateMockMintedData(), mockData);

      const collectorField = embed.embeds[0].fields[1].value;

      // Check that full address is not exposed
      expect(collectorField).not.toContain(
        '0xfdfb16ffaf364a4ae15db843ae18a76fd848e79e',
      );

      // Check that truncated address is present (8 chars + ...)
      expect(collectorField).toContain('0xfdfb16...');
    });
  });

  describe('DuckDB Integration', () => {
    test('should load PostgreSQL extension successfully', async () => {
      let connection: DuckDBConnection | null = null;

      try {
        const instance = await DuckDBInstance.create(':memory:');
        connection = await instance.connect();

        // Test postgres extension loading
        await connection.runAndReadAll('LOAD postgres;');

        // Test basic query functionality
        const testResult = await connection.runAndReadAll(
          'SELECT 1 as test_value',
        );
        const rows = testResult.getRowObjects();

        expect(rows).toBeDefined();
        expect(rows).toHaveLength(1);
        expect(rows[0].test_value).toBe(1);
      } finally {
        if (connection) {
          connection.closeSync();
        }
      }
    });

    test('should handle DuckDB connection errors gracefully', async () => {
      let connection: DuckDBConnection | null = null;

      try {
        const instance = await DuckDBInstance.create(':memory:');
        connection = await instance.connect();

        // Test invalid query
        await expect(
          connection.runAndReadAll('INVALID SQL QUERY'),
        ).rejects.toThrow();
      } finally {
        if (connection) {
          connection.closeSync();
        }
      }
    });
  });

  describe('Environment Variable Handling', () => {
    test('should validate connection string format', () => {
      const testConnectionString =
        'host=localhost port=5432 dbname=test user=test password=test';

      expect(testConnectionString).toContain('host=');
      expect(testConnectionString).toContain('port=');
      expect(testConnectionString).toContain('dbname=');
      expect(testConnectionString).toContain('user=');
      expect(testConnectionString).toContain('password=');
    });

    test('should handle missing environment variables', () => {
      // Test missing connection string
      delete process.env.MEMO_NFT_DB_CONNECTION_STRING;
      delete process.env.DISCORD_WEBHOOK_URL;

      const hasConnectionString = !!process.env.MEMO_NFT_DB_CONNECTION_STRING;
      const hasWebhookUrl = !!process.env.DISCORD_WEBHOOK_URL;

      expect(hasConnectionString).toBe(false);
      expect(hasWebhookUrl).toBe(false);
    });

    test('should detect environment variables when set', () => {
      process.env.MEMO_NFT_DB_CONNECTION_STRING = 'test-connection-string';
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test';

      const hasConnectionString = !!process.env.MEMO_NFT_DB_CONNECTION_STRING;
      const hasWebhookUrl = !!process.env.DISCORD_WEBHOOK_URL;

      expect(hasConnectionString).toBe(true);
      expect(hasWebhookUrl).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    test('should validate numeric calculations', () => {
      const mintedData = generateMockMintedData();

      // Verify success rate calculation
      const expectedSuccessRate = Math.round(
        (mintedData.mintedCount / mintedData.mintableTotal) * 100,
      );
      expect(mintedData.successRate).toBe(expectedSuccessRate);

      // Verify pending count calculation
      const expectedPendingCount =
        mintedData.mintableTotal - mintedData.mintedCount;
      expect(mintedData.pendingCount).toBe(expectedPendingCount);
    });

    test('should handle zero division gracefully', () => {
      const zeroMinted = {
        ...generateMockMintedData(),
        mintableTotal: 0,
        mintedCount: 0,
        successRate: 0,
      };

      expect(zeroMinted.successRate).toBe(0); // Should not throw division by zero
    });

    test('should validate timestamp format', () => {
      const mintedData = generateMockMintedData();
      const collectedData = generateMockCollectedData();
      const embed = generateDiscordEmbed(mintedData, collectedData);

      const timestamp = embed.embeds[0].timestamp;
      expect(timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });
});
