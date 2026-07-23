/**
 * @file upload-rollups-to-d1.test.ts
 * @description Unit tests + a dry-run against a mocked D1 client for
 * scripts/upload-rollups-to-d1.ts (CF-N.4's "rollups to D1").
 */

import { describe, test, expect, vi } from 'vitest';

vi.mock('../scripts/monitor-vault-parquet', () => ({
  collectVaultMetrics: vi.fn(async () => ({
    totalRecords: 2031,
    fileSizeMB: 45,
    fileAgeHours: 2,
    drafts: 150,
    pinned: 25,
    pendingMint: 5,
    pendingArweave: 8,
    missingEmbeddings: 44,
    emptyContent: 3,
    missingDates: 100,
    missingAuthors: 150,
    avgTokens: 2500,
    minTokens: 50,
    maxTokens: 15000,
    missingDatesPercent: 5,
    missingAuthorsPercent: 7,
  })),
}));

import {
  computeRollup,
  uploadRollup,
  CREATE_ROLLUP_TABLE_SQL,
  UPSERT_ROLLUP_SQL,
  type D1Client,
} from '../scripts/upload-rollups-to-d1';

describe('computeRollup', () => {
  test('derives the rollup from collectVaultMetrics, keyed by commit sha', async () => {
    const rollup = await computeRollup('deadbeef');

    expect(rollup.commitSha).toBe('deadbeef');
    expect(rollup.totalRecords).toBe(2031);
    expect(rollup.drafts).toBe(150);
    expect(rollup.pinned).toBe(25);
    expect(rollup.missingEmbeddings).toBe(44);
    expect(() => new Date(rollup.generatedAt).toISOString()).not.toThrow();
  });
});

function createRecordingD1Client(): { client: D1Client; calls: Array<{ sql: string; params?: unknown[] }> } {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const client: D1Client = {
    async execute(sql, params) {
      calls.push({ sql, params });
      return { success: true };
    },
  };
  return { client, calls };
}

describe('uploadRollup', () => {
  test('creates the table then upserts, keyed by commit_sha (idempotent re-run)', async () => {
    const { client, calls } = createRecordingD1Client();
    const rollup = await computeRollup('deadbeef');

    await uploadRollup(client, rollup);

    expect(calls).toHaveLength(2);
    expect(calls[0].sql).toBe(CREATE_ROLLUP_TABLE_SQL);
    expect(calls[1].sql).toBe(UPSERT_ROLLUP_SQL);
    expect(calls[1].params).toEqual([
      'deadbeef',
      rollup.generatedAt,
      2031,
      150,
      25,
      44,
    ]);
    expect(UPSERT_ROLLUP_SQL).toMatch(/ON CONFLICT\(commit_sha\) DO UPDATE/);
  });

  test('a re-run for the same commit replaces the row (same params, no new PK)', async () => {
    const { client, calls } = createRecordingD1Client();
    const rollup = await computeRollup('deadbeef');

    await uploadRollup(client, rollup);
    await uploadRollup(client, rollup);

    const upserts = calls.filter(c => c.sql === UPSERT_ROLLUP_SQL);
    expect(upserts).toHaveLength(2);
    expect(upserts[0].params?.[0]).toBe(upserts[1].params?.[0]);
  });

  test('dry-run never touches the client (asserts against a client that throws if called)', async () => {
    const throwingClient: D1Client = {
      execute: async () => {
        throw new Error('execute must not be called during dry-run');
      },
    };
    const rollup = await computeRollup('deadbeef');

    await expect(uploadRollup(throwingClient, rollup, { dryRun: true })).resolves.toBeUndefined();
  });
});
