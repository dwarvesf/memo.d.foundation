#!/usr/bin/env tsx

/**
 * Vault Parquet Monitoring Script
 * 
 * Monitors vault.parquet file health and generates Discord notifications
 * with comprehensive metrics and visual status indicators.
 * 
 * Usage:
 *   tsx scripts/monitor-vault-parquet.ts --send      # Send to Discord
 *   tsx scripts/monitor-vault-parquet.ts --verbose   # Show detailed output
 */

import fs from 'fs';
import path from 'path';
import { DuckDBInstance } from '@duckdb/node-api';

interface VaultMetrics {
  totalRecords: number;
  fileSizeMB: number;
  fileAgeHours: number;
  drafts: number;
  featured: number;
  pinned: number;
  pendingMint: number;
  pendingArweave: number;
  missingEmbeddings: number;
  emptyContent: number;
  missingDates: number;
  missingAuthors: number;
  adoptCount: number;
  trialCount: number;
  backlogCount: number;
  avgTokens: number;
  minTokens: number;
  maxTokens: number;
  missingDatesPercent: number;
  missingAuthorsPercent: number;
}

async function collectVaultMetrics(): Promise<VaultMetrics> {
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();

  try {
    const vaultPath = path.join(process.cwd(), 'db/vault.parquet');

    // File health metrics
    const stats = fs.statSync(vaultPath);
    const fileSizeMB = Math.round(stats.size / (1024 * 1024));
    const fileAgeHours = Math.round((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60));

    // Basic counts
    const totalResult = await connection.runAndReadAll(
      `SELECT COUNT(*) as count FROM read_parquet('${vaultPath}')`
    );
    const totalRecords = Number(totalResult.getRowObjects()[0]?.count) || 0;

    // Content status
    const statusResult = await connection.runAndReadAll(`
      SELECT 
        COUNT(CASE WHEN draft = true THEN 1 END) as drafts,
        COUNT(CASE WHEN featured = true THEN 1 END) as featured,
        COUNT(CASE WHEN pinned = true THEN 1 END) as pinned,
        COUNT(CASE WHEN should_mint = true AND (minted_at IS NULL OR token_id IS NULL) THEN 1 END) as pending_mint,
        COUNT(CASE WHEN should_deploy_perma_storage = true AND perma_storage_id IS NULL THEN 1 END) as pending_arweave
      FROM read_parquet('${vaultPath}')
    `);
    const statusStats = statusResult.getRowObjects()[0];

    // Embedding status
    const embeddingResult = await connection.runAndReadAll(`
      SELECT 
        COUNT(CASE WHEN embeddings_openai IS NULL THEN 1 END) + 
        COUNT(CASE WHEN embeddings_spr_custom IS NULL THEN 1 END) as missing_embeddings
      FROM read_parquet('${vaultPath}')
      WHERE md_content IS NOT NULL AND LENGTH(md_content) > 100
    `);
    const missingEmbeddings = Number(embeddingResult.getRowObjects()[0]?.missing_embeddings) || 0;

    // Content quality
    const qualityResult = await connection.runAndReadAll(`
      SELECT 
        COUNT(CASE WHEN LENGTH(md_content) = 0 OR md_content IS NULL THEN 1 END) as empty_content,
        COUNT(CASE WHEN date IS NULL THEN 1 END) as missing_dates,
        COUNT(CASE WHEN array_length(authors) = 0 OR authors IS NULL THEN 1 END) as missing_authors
      FROM read_parquet('${vaultPath}')
    `);
    const qualityStats = qualityResult.getRowObjects()[0];

    // Tech radar status
    const radarResult = await connection.runAndReadAll(`
      SELECT 
        COUNT(CASE WHEN status = 'Adopt' THEN 1 END) as adopt_count,
        COUNT(CASE WHEN status = 'Trial' THEN 1 END) as trial_count,
        COUNT(CASE WHEN status = 'Backlog' THEN 1 END) as backlog_count
      FROM read_parquet('${vaultPath}')
    `);
    const radarStats = radarResult.getRowObjects()[0];

    // Token distribution
    const tokenResult = await connection.runAndReadAll(`
      SELECT 
        MIN(estimated_tokens) as min_tokens,
        MAX(estimated_tokens) as max_tokens,
        AVG(estimated_tokens)::INT as avg_tokens
      FROM read_parquet('${vaultPath}')
    `);
    const tokenStats = tokenResult.getRowObjects()[0];

    const missingDates = Number(qualityStats?.missing_dates) || 0;
    const missingAuthors = Number(qualityStats?.missing_authors) || 0;

    return {
      totalRecords,
      fileSizeMB,
      fileAgeHours,
      drafts: Number(statusStats?.drafts) || 0,
      featured: Number(statusStats?.featured) || 0,
      pinned: Number(statusStats?.pinned) || 0,
      pendingMint: Number(statusStats?.pending_mint) || 0,
      pendingArweave: Number(statusStats?.pending_arweave) || 0,
      missingEmbeddings,
      emptyContent: Number(qualityStats?.empty_content) || 0,
      missingDates,
      missingAuthors,
      adoptCount: Number(radarStats?.adopt_count) || 0,
      trialCount: Number(radarStats?.trial_count) || 0,
      backlogCount: Number(radarStats?.backlog_count) || 0,
      avgTokens: Number(tokenStats?.avg_tokens) || 0,
      minTokens: Number(tokenStats?.min_tokens) || 0,
      maxTokens: Number(tokenStats?.max_tokens) || 0,
      missingDatesPercent: totalRecords > 0 ? Math.round((missingDates / totalRecords) * 100) : 0,
      missingAuthorsPercent: totalRecords > 0 ? Math.round((missingAuthors / totalRecords) * 100) : 0,
    };
  } finally {
    connection.closeSync();
  }
}

function generateDiscordEmbed(metrics: VaultMetrics) {
  // Determine health status and color
  const hasWarnings = metrics.missingDatesPercent > 25 || metrics.missingAuthorsPercent > 40 || metrics.emptyContent > 50;
  const hasCritical = metrics.pendingMint > 20 || metrics.pendingArweave > 30 || metrics.missingEmbeddings > 100;

  const color = hasCritical ? 0xff0000 : hasWarnings ? 0xffff00 : 0x00ff00;
  const healthStatus = hasCritical ? '🔴' : hasWarnings ? '🟡' : '🟢';

  const embed = {
    embeds: [{
      title: '📊 Vault.parquet Health Report',
      description: `Current status of memo.d.foundation knowledge vault`,
      color,
      timestamp: new Date().toISOString(),
      fields: [
        {
          name: '📁 File Health',
          value: `${healthStatus} **${metrics.totalRecords.toLocaleString()}** records | **${metrics.fileSizeMB}MB** | ${metrics.fileAgeHours}h old`,
          inline: true
        },
        {
          name: '📝 Content Status',
          value: `📄 **${metrics.drafts}** drafts | ⭐ **${metrics.featured}** featured | 📌 **${metrics.pinned}** pinned`,
          inline: true
        },
        {
          name: '🔄 Processing Queue',
          value: `🪙 **${metrics.pendingMint}** NFT mint | 🏛️ **${metrics.pendingArweave}** Arweave | 🤖 **${metrics.missingEmbeddings}** embed missing`,
          inline: false
        },
        {
          name: '📊 Content Quality',
          value: `📝 **${metrics.emptyContent}** empty | 📅 **${metrics.missingDates}** no dates | 👤 **${metrics.missingAuthors}** no authors`,
          inline: true
        },
        {
          name: '🎯 Tech Radar',
          value: `✅ **${metrics.adoptCount}** Adopt | 🧪 **${metrics.trialCount}** Trial | 📋 **${metrics.backlogCount}** Backlog`,
          inline: true
        },
        {
          name: '🔢 Token Stats',
          value: `📊 Avg: **${metrics.avgTokens.toLocaleString()}** | Min: **${metrics.minTokens}** | Max: **${metrics.maxTokens.toLocaleString()}**`,
          inline: false
        },
        {
          name: '⚠️ Quality Alerts',
          value: `${metrics.missingDatesPercent > 25 ? '🟡' : '🟢'} **${metrics.missingDatesPercent}%** missing dates | ${metrics.missingAuthorsPercent > 40 ? '🟡' : '🟢'} **${metrics.missingAuthorsPercent}%** missing authors`,
          inline: false
        }
      ],
      footer: {
        text: `Last updated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`
      }
    }]
  };

  return embed;
}

async function sendToDiscord(payload: any) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('No Discord webhook URL configured, skipping notification');
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

    console.log('Discord notification sent successfully');
  } catch (error) {
    console.error('Failed to send Discord notification:', error);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const sendToDiscordFlag = args.includes('--send');
  const verbose = args.includes('--verbose');

  try {
    console.log('Collecting vault metrics...');
    const metrics = await collectVaultMetrics();

    console.log('Generating Discord embed...');
    const embed = generateDiscordEmbed(metrics);

    if (verbose) {
      console.log('\n=== METRICS ===');
      console.log(JSON.stringify(metrics, null, 2));
      console.log('\n=== EMBED PAYLOAD ===');
      console.log(JSON.stringify(embed, null, 2));
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Records: ${metrics.totalRecords.toLocaleString()}`);
    console.log(`File Size: ${metrics.fileSizeMB}MB`);
    console.log(`Pending Mint: ${metrics.pendingMint}`);
    console.log(`Pending Arweave: ${metrics.pendingArweave}`);
    console.log(`Missing Dates: ${metrics.missingDatesPercent}%`);
    console.log(`Missing Authors: ${metrics.missingAuthorsPercent}%`);

    // Check character count
    const jsonString = JSON.stringify(embed);
    console.log(`\nEmbed character count: ${jsonString.length}/2000`);

    if (sendToDiscordFlag) {
      await sendToDiscord(embed);
    } else {
      console.log('\nUse --send flag to send to Discord');
    }

  } catch (error) {
    console.error('Failed to generate metrics:', error);
    process.exit(1);
  }
}

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { collectVaultMetrics, generateDiscordEmbed };