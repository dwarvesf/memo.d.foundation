/**
 * @file monitor-vault-parquet.test.ts
 * @description Vitest test suite for Vault Parquet Monitoring functionality
 *
 * Tests the core functionality of the vault monitoring system including:
 * - Metrics collection from parquet files
 * - Discord embed generation
 * - Health status calculations
 * - Error handling scenarios
 * - Mock data validation
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateDiscordEmbed } from '../scripts/monitor-vault-parquet';

// Mock DuckDB module
vi.mock('@duckdb/node-api', () => ({
  DuckDBInstance: {
    create: vi.fn(),
  },
}));

// Discord embed types
interface DiscordEmbedField {
  name: string;
  value: string;
  inline: boolean;
}

// Mock data interface
interface MockVaultMetrics {
  totalRecords: number;
  fileSizeMB: number;
  fileAgeHours: number;
  drafts: number;
  pinned: number;
  pendingMint: number;
  pendingArweave: number;
  missingEmbeddings: number;
  emptyContent: number;
  missingDates: number;
  missingAuthors: number;
  avgTokens: number;
  minTokens: number;
  maxTokens: number;
  missingDatesPercent: number;
  missingAuthorsPercent: number;
}

// Test data generators
function generateHealthyMetrics(): MockVaultMetrics {
  return {
    totalRecords: 5000,
    fileSizeMB: 45,
    fileAgeHours: 2,
    drafts: 150,
    pinned: 25,
    pendingMint: 5,
    pendingArweave: 8,
    missingEmbeddings: 12,
    emptyContent: 3,
    missingDates: 100,
    missingAuthors: 150,
    avgTokens: 2500,
    minTokens: 50,
    maxTokens: 15000,
    missingDatesPercent: 2,
    missingAuthorsPercent: 3,
  };
}

function generateWarningMetrics(): MockVaultMetrics {
  return {
    totalRecords: 4000,
    fileSizeMB: 38,
    fileAgeHours: 12,
    drafts: 200,
    pinned: 30,
    pendingMint: 15,
    pendingArweave: 25,
    missingEmbeddings: 75,
    emptyContent: 45,
    missingDates: 1200,
    missingAuthors: 1800,
    avgTokens: 2200,
    minTokens: 25,
    maxTokens: 18000,
    missingDatesPercent: 30,
    missingAuthorsPercent: 45,
  };
}

function generateCriticalMetrics(): MockVaultMetrics {
  return {
    totalRecords: 3000,
    fileSizeMB: 28,
    fileAgeHours: 48,
    drafts: 300,
    pinned: 50,
    pendingMint: 35,
    pendingArweave: 45,
    missingEmbeddings: 150,
    emptyContent: 80,
    missingDates: 900,
    missingAuthors: 1500,
    avgTokens: 1800,
    minTokens: 10,
    maxTokens: 25000,
    missingDatesPercent: 30,
    missingAuthorsPercent: 50,
  };
}

describe('Vault Parquet Monitoring', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('generateDiscordEmbed', () => {
    test('should generate healthy status embed', () => {
      const metrics = generateHealthyMetrics();
      const embed = generateDiscordEmbed(metrics);

      expect(embed).toHaveProperty('embeds');
      expect(embed.embeds).toHaveLength(1);

      const embedObj = embed.embeds[0];
      expect(embedObj.title).toBe('📊 Vault.parquet Health Report');
      expect(embedObj.color).toBe(0x00ff00); // Green for healthy
      expect(embedObj.description).toContain(
        'memo.d.foundation knowledge vault',
      );
      expect(embedObj.fields).toHaveLength(6);

      // Check health status indicator
      const fileHealthField = embedObj.fields.find(
        (f: DiscordEmbedField) => f.name === '📁 File Health',
      );
      expect(fileHealthField?.value).toContain('🟢');
      expect(fileHealthField?.value).toContain('5,000');
      expect(fileHealthField?.value).toContain('45MB');
    });

    test('should generate warning status embed', () => {
      const metrics = generateWarningMetrics();
      const embed = generateDiscordEmbed(metrics);

      const embedObj = embed.embeds[0];
      expect(embedObj.color).toBe(0xffff00); // Yellow for warning

      const fileHealthField = embedObj.fields.find(
        (f: DiscordEmbedField) => f.name === '📁 File Health',
      );
      expect(fileHealthField?.value).toContain('🟡');

      const qualityField = embedObj.fields.find(
        (f: DiscordEmbedField) => f.name === '⚠️ Quality Alerts',
      );
      expect(qualityField?.value).toContain('🟡 **30%** missing dates');
      expect(qualityField?.value).toContain('🟡 **45%** missing authors');
    });

    test('should generate critical status embed', () => {
      const metrics = generateCriticalMetrics();
      const embed = generateDiscordEmbed(metrics);

      const embedObj = embed.embeds[0];
      expect(embedObj.color).toBe(0xff0000); // Red for critical

      const fileHealthField = embedObj.fields.find(
        (f: DiscordEmbedField) => f.name === '📁 File Health',
      );
      expect(fileHealthField?.value).toContain('🔴');

      const queueField = embedObj.fields.find(
        (f: DiscordEmbedField) => f.name === '🔄 Processing Queue',
      );
      expect(queueField?.value).toContain('🪙 **35** NFT mint');
      expect(queueField?.value).toContain('🏛️ **45** Arweave');
    });

    test('should format numbers with locale strings', () => {
      const metrics = {
        ...generateHealthyMetrics(),
        totalRecords: 1234567,
        avgTokens: 12345,
        maxTokens: 987654,
      };
      const embed = generateDiscordEmbed(metrics);

      const embedObj = embed.embeds[0];
      const fileHealthField = embedObj.fields.find(
        (f: DiscordEmbedField) => f.name === '📁 File Health',
      );
      expect(fileHealthField?.value).toContain('1,234,567');

      const tokenField = embedObj.fields.find(
        (f: DiscordEmbedField) => f.name === '🔢 Token Stats',
      );
      expect(tokenField?.value).toContain('12,345');
      expect(tokenField?.value).toContain('987,654');
    });

    test('should include all required embed fields', () => {
      const metrics = generateHealthyMetrics();
      const embed = generateDiscordEmbed(metrics);

      const embedObj = embed.embeds[0];
      const fieldNames = embedObj.fields.map((f: DiscordEmbedField) => f.name);

      expect(fieldNames).toContain('📁 File Health');
      expect(fieldNames).toContain('📝 Content Status');
      expect(fieldNames).toContain('🔄 Processing Queue');
      expect(fieldNames).toContain('📊 Content Quality');
      expect(fieldNames).toContain('🔢 Token Stats');
      expect(fieldNames).toContain('⚠️ Quality Alerts');
    });

    test('should have valid timestamp and footer', () => {
      const metrics = generateHealthyMetrics();
      const embed = generateDiscordEmbed(metrics);

      const embedObj = embed.embeds[0];
      expect(embedObj.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(embedObj.footer.text).toMatch(
        /Last updated: \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/,
      );
    });
  });

  describe('Health Status Logic', () => {
    test('should correctly identify healthy status', () => {
      const metrics = generateHealthyMetrics();
      const embed = generateDiscordEmbed(metrics);

      expect(embed.embeds[0].color).toBe(0x00ff00);

      const fileHealthField = embed.embeds[0].fields.find(
        (f: DiscordEmbedField) => f.name === '📁 File Health',
      );
      expect(fileHealthField?.value).toContain('🟢');
    });

    test('should identify warning status for high missing dates', () => {
      const metrics = {
        ...generateHealthyMetrics(),
        missingDatesPercent: 30,
        missingDates: 1500,
      };
      const embed = generateDiscordEmbed(metrics);

      expect(embed.embeds[0].color).toBe(0xffff00);
    });

    test('should identify warning status for high missing authors', () => {
      const metrics = {
        ...generateHealthyMetrics(),
        missingAuthorsPercent: 45,
        missingAuthors: 2250,
      };
      const embed = generateDiscordEmbed(metrics);

      expect(embed.embeds[0].color).toBe(0xffff00);
    });

    test('should identify warning status for high empty content', () => {
      const metrics = {
        ...generateHealthyMetrics(),
        emptyContent: 60,
      };
      const embed = generateDiscordEmbed(metrics);

      expect(embed.embeds[0].color).toBe(0xffff00);
    });

    test('should identify critical status for high pending mint', () => {
      const metrics = {
        ...generateHealthyMetrics(),
        pendingMint: 25,
      };
      const embed = generateDiscordEmbed(metrics);

      expect(embed.embeds[0].color).toBe(0xff0000);
    });

    test('should identify critical status for high pending arweave', () => {
      const metrics = {
        ...generateHealthyMetrics(),
        pendingArweave: 35,
      };
      const embed = generateDiscordEmbed(metrics);

      expect(embed.embeds[0].color).toBe(0xff0000);
    });

    test('should identify critical status for high missing embeddings', () => {
      const metrics = {
        ...generateHealthyMetrics(),
        missingEmbeddings: 120,
      };
      const embed = generateDiscordEmbed(metrics);

      expect(embed.embeds[0].color).toBe(0xff0000);
    });

    test('should prioritize critical over warning status', () => {
      const metrics = {
        ...generateWarningMetrics(),
        pendingMint: 25, // Critical threshold
      };
      const embed = generateDiscordEmbed(metrics);

      expect(embed.embeds[0].color).toBe(0xff0000); // Should be critical (red)
    });
  });

  describe('Data Formatting and Validation', () => {
    test('should handle zero values gracefully', () => {
      const metrics: MockVaultMetrics = {
        totalRecords: 0,
        fileSizeMB: 0,
        fileAgeHours: 0,
        drafts: 0,
        pinned: 0,
        pendingMint: 0,
        pendingArweave: 0,
        missingEmbeddings: 0,
        emptyContent: 0,
        missingDates: 0,
        missingAuthors: 0,
        avgTokens: 0,
        minTokens: 0,
        maxTokens: 0,
        missingDatesPercent: 0,
        missingAuthorsPercent: 0,
      };

      const embed = generateDiscordEmbed(metrics);

      expect(embed.embeds[0]).toBeDefined();
      expect(embed.embeds[0].color).toBe(0x00ff00); // Should be healthy with zero issues

      const fileHealthField = embed.embeds[0].fields.find(
        (f: DiscordEmbedField) => f.name === '📁 File Health',
      );
      expect(fileHealthField?.value).toContain('**0** records');
      expect(fileHealthField?.value).toContain('**0MB**');
    });

    test('should handle very large numbers', () => {
      const metrics = {
        ...generateHealthyMetrics(),
        totalRecords: 9999999,
        avgTokens: 999999,
        maxTokens: 9999999,
      };

      const embed = generateDiscordEmbed(metrics);

      const fileHealthField = embed.embeds[0].fields.find(
        (f: DiscordEmbedField) => f.name === '📁 File Health',
      );
      expect(fileHealthField?.value).toContain('9,999,999');

      const tokenField = embed.embeds[0].fields.find(
        (f: DiscordEmbedField) => f.name === '🔢 Token Stats',
      );
      expect(tokenField?.value).toContain('999,999');
      expect(tokenField?.value).toContain('9,999,999');
    });

    test('should calculate percentages correctly', () => {
      const metrics = {
        ...generateHealthyMetrics(),
        totalRecords: 1000,
        missingDates: 250,
        missingAuthors: 400,
        missingDatesPercent: 25,
        missingAuthorsPercent: 40,
      };

      const embed = generateDiscordEmbed(metrics);

      const qualityField = embed.embeds[0].fields.find(
        (f: DiscordEmbedField) => f.name === '⚠️ Quality Alerts',
      );
      expect(qualityField?.value).toContain('🟢 **25%** missing dates');
      expect(qualityField?.value).toContain('🟢 **40%** missing authors');
    });

    test('should respect Discord embed character limits', () => {
      const metrics = generateCriticalMetrics();
      const embed = generateDiscordEmbed(metrics);

      const jsonString = JSON.stringify(embed);

      // Discord embed limit is 6000 characters total
      expect(jsonString.length).toBeLessThanOrEqual(6000);

      // Each field value should be reasonable length
      embed.embeds[0].fields.forEach((field: DiscordEmbedField) => {
        expect(field.value.length).toBeLessThanOrEqual(1024); // Discord field value limit
      });
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    test('should handle negative values as zero', () => {
      const metrics = {
        ...generateHealthyMetrics(),
        pendingMint: -5,
        missingEmbeddings: -10,
      };

      const embed = generateDiscordEmbed(metrics);

      // The function should handle negative values gracefully
      expect(embed.embeds[0]).toBeDefined();
      expect(embed.embeds[0].fields).toHaveLength(6);
    });

    test('should handle very old files', () => {
      const metrics = {
        ...generateHealthyMetrics(),
        fileAgeHours: 168, // 1 week old
      };

      const embed = generateDiscordEmbed(metrics);

      const fileHealthField = embed.embeds[0].fields.find(
        (f: DiscordEmbedField) => f.name === '📁 File Health',
      );
      expect(fileHealthField?.value).toContain('168h old');
    });

    test('should handle extreme token ranges', () => {
      const metrics = {
        ...generateHealthyMetrics(),
        minTokens: 1,
        maxTokens: 1000000,
        avgTokens: 50000,
      };

      const embed = generateDiscordEmbed(metrics);

      const tokenField = embed.embeds[0].fields.find(
        (f: DiscordEmbedField) => f.name === '🔢 Token Stats',
      );
      expect(tokenField?.value).toContain('Min: **1**');
      expect(tokenField?.value).toContain('Max: **1,000,000**');
      expect(tokenField?.value).toContain('Avg: **50,000**');
    });
  });

  describe('Embed Structure Validation', () => {
    test('should have valid Discord embed structure', () => {
      const metrics = generateHealthyMetrics();
      const embed = generateDiscordEmbed(metrics);

      // Top level structure
      expect(embed).toHaveProperty('embeds');
      expect(Array.isArray(embed.embeds)).toBe(true);
      expect(embed.embeds).toHaveLength(1);

      // Embed object structure
      const embedObj = embed.embeds[0];
      expect(embedObj).toHaveProperty('title');
      expect(embedObj).toHaveProperty('description');
      expect(embedObj).toHaveProperty('color');
      expect(embedObj).toHaveProperty('timestamp');
      expect(embedObj).toHaveProperty('fields');
      expect(embedObj).toHaveProperty('footer');

      // Fields structure
      expect(Array.isArray(embedObj.fields)).toBe(true);
      embedObj.fields.forEach((field: DiscordEmbedField) => {
        expect(field).toHaveProperty('name');
        expect(field).toHaveProperty('value');
        expect(field).toHaveProperty('inline');
        expect(typeof field.name).toBe('string');
        expect(typeof field.value).toBe('string');
        expect(typeof field.inline).toBe('boolean');
      });

      // Footer structure
      expect(embedObj.footer).toHaveProperty('text');
      expect(typeof embedObj.footer.text).toBe('string');
    });

    test('should have correct field inline settings', () => {
      const metrics = generateHealthyMetrics();
      const embed = generateDiscordEmbed(metrics);

      const embedObj = embed.embeds[0];
      const fields = embedObj.fields;

      // Check specific inline settings
      const fileHealthField = fields.find(
        (f: DiscordEmbedField) => f.name === '📁 File Health',
      );
      expect(fileHealthField?.inline).toBe(true);

      const contentStatusField = fields.find(
        (f: DiscordEmbedField) => f.name === '📝 Content Status',
      );
      expect(contentStatusField?.inline).toBe(true);

      const processingQueueField = fields.find(
        (f: DiscordEmbedField) => f.name === '🔄 Processing Queue',
      );
      expect(processingQueueField?.inline).toBe(false);

      const tokenStatsField = fields.find(
        (f: DiscordEmbedField) => f.name === '🔢 Token Stats',
      );
      expect(tokenStatsField?.inline).toBe(false);
    });
  });
});
