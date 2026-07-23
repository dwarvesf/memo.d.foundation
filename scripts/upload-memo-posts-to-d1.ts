#!/usr/bin/env tsx

/**
 * Upload PER-POST rows (not the aggregate content_rollups of #303) to a D1
 * `memo_posts` table, keyed by file_path -- the exact per-post shape
 * fortress-api's Discord DuckDB queries need (see extract-memo-posts.ts for
 * the discord.go column cross-check). Completes the DuckDB-kill that #303's
 * aggregate-only rollup left unfinished (M4-06).
 *
 * Usage:
 *   tsx scripts/upload-memo-posts-to-d1.ts             # real upload, needs D1_* env
 *   tsx scripts/upload-memo-posts-to-d1.ts --dry-run   # extract + log only
 */

import path from 'path';
import { execSync } from 'child_process';
import { extractMemoPosts, type MemoPostRow } from './extract-memo-posts';
import { createD1ClientFromEnv, type D1Client } from './d1-env-client';

export const CREATE_MEMO_POSTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS memo_posts (
  file_path TEXT PRIMARY KEY,
  date TEXT,
  title TEXT NOT NULL,
  authors TEXT NOT NULL,
  tags TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

// keyed by file_path: a re-run replaces each post's row instead of inserting
// a duplicate, same idempotent shape as #303's content_rollups upsert.
export const UPSERT_MEMO_POST_SQL = `INSERT INTO memo_posts
  (file_path, date, title, authors, tags, commit_sha, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(file_path) DO UPDATE SET
    date = excluded.date,
    title = excluded.title,
    authors = excluded.authors,
    tags = excluded.tags,
    commit_sha = excluded.commit_sha,
    updated_at = excluded.updated_at`;

export async function uploadMemoPosts(
  client: D1Client,
  rows: MemoPostRow[],
  opts: { commitSha: string; dryRun?: boolean },
): Promise<number> {
  if (opts.dryRun) {
    console.log('[dry-run] would execute:\n', CREATE_MEMO_POSTS_TABLE_SQL);
    console.log(`[dry-run] would upsert ${rows.length} memo_posts row(s)`);
    return rows.length;
  }

  await client.execute(CREATE_MEMO_POSTS_TABLE_SQL);
  const updatedAt = new Date().toISOString();
  for (const row of rows) {
    await client.execute(UPSERT_MEMO_POST_SQL, [
      row.filePath,
      row.date,
      row.title,
      JSON.stringify(row.authors),
      JSON.stringify(row.tags),
      opts.commitSha,
      updatedAt,
    ]);
  }
  return rows.length;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const commitSha =
    process.env.GITHUB_SHA?.trim() || execSync('git rev-parse HEAD').toString().trim();

  const vaultPath = path.join(process.cwd(), 'db/vault.parquet');
  const rows = await extractMemoPosts(vaultPath);
  console.log(`Extracted ${rows.length} per-post row(s) from ${vaultPath}${dryRun ? ' [dry-run]' : ''}`);

  const client: D1Client = dryRun
    ? {
        execute: async () => {
          throw new Error('D1Client.execute should not be called in --dry-run');
        },
      }
    : createD1ClientFromEnv();

  const count = await uploadMemoPosts(client, rows, { commitSha, dryRun });
  console.log(dryRun ? 'Dry-run complete.' : `Uploaded ${count} memo_posts row(s) to D1.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
