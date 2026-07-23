#!/usr/bin/env tsx

/**
 * Roll the vault.parquet content metrics up into a small D1 table so
 * consumers (fortress memo-analytics, etc.) can query build-health numbers
 * without loading the whole parquet (CF-N.4's "rollups to D1").
 *
 * Reuses collectVaultMetrics from monitor-vault-parquet.ts (same DuckDB
 * query this repo already runs) rather than re-querying the parquet here.
 *
 * Usage:
 *   tsx scripts/upload-rollups-to-d1.ts             # real upload, needs D1_* env
 *   tsx scripts/upload-rollups-to-d1.ts --dry-run   # compute + log only
 */

import { execSync } from 'child_process';
import { collectVaultMetrics } from './monitor-vault-parquet';
import { createD1ClientFromEnv, type D1Client } from './d1-env-client';

export type { D1Client };

export interface ContentRollup {
  commitSha: string;
  generatedAt: string;
  totalRecords: number;
  drafts: number;
  pinned: number;
  missingEmbeddings: number;
}

export async function computeRollup(commitSha: string): Promise<ContentRollup> {
  const metrics = await collectVaultMetrics();
  return {
    commitSha,
    generatedAt: new Date().toISOString(),
    totalRecords: metrics.totalRecords,
    drafts: metrics.drafts,
    pinned: metrics.pinned,
    missingEmbeddings: metrics.missingEmbeddings,
  };
}

export const CREATE_ROLLUP_TABLE_SQL = `CREATE TABLE IF NOT EXISTS content_rollups (
  commit_sha TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  total_records INTEGER NOT NULL,
  drafts INTEGER NOT NULL,
  pinned INTEGER NOT NULL,
  missing_embeddings INTEGER NOT NULL
)`;

// keyed by commit_sha: a re-run for the same commit replaces the row instead
// of inserting a duplicate.
export const UPSERT_ROLLUP_SQL = `INSERT INTO content_rollups
  (commit_sha, generated_at, total_records, drafts, pinned, missing_embeddings)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(commit_sha) DO UPDATE SET
    generated_at = excluded.generated_at,
    total_records = excluded.total_records,
    drafts = excluded.drafts,
    pinned = excluded.pinned,
    missing_embeddings = excluded.missing_embeddings`;

export async function uploadRollup(
  client: D1Client,
  rollup: ContentRollup,
  opts: { dryRun?: boolean } = {},
): Promise<void> {
  if (opts.dryRun) {
    console.log('[dry-run] would execute:\n', CREATE_ROLLUP_TABLE_SQL);
    console.log('[dry-run] would execute:\n', UPSERT_ROLLUP_SQL, rollup);
    return;
  }
  await client.execute(CREATE_ROLLUP_TABLE_SQL);
  await client.execute(UPSERT_ROLLUP_SQL, [
    rollup.commitSha,
    rollup.generatedAt,
    rollup.totalRecords,
    rollup.drafts,
    rollup.pinned,
    rollup.missingEmbeddings,
  ]);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const commitSha =
    process.env.GITHUB_SHA?.trim() || execSync('git rev-parse HEAD').toString().trim();

  const rollup = await computeRollup(commitSha);
  console.log(`Computed rollup for ${commitSha}${dryRun ? ' [dry-run]' : ''}:`, rollup);

  const client: D1Client = dryRun
    ? {
        execute: async () => {
          throw new Error('D1Client.execute should not be called in --dry-run');
        },
      }
    : createD1ClientFromEnv();

  await uploadRollup(client, rollup, { dryRun });
  console.log(dryRun ? 'Dry-run complete.' : 'Rollup uploaded to D1.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
