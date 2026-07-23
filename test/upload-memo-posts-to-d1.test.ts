/**
 * @file upload-memo-posts-to-d1.test.ts
 * @description Unit tests against a mocked D1 client for
 * scripts/upload-memo-posts-to-d1.ts (M4-05b, per-post rows completing the
 * DuckDB-kill that #303's aggregate-only content_rollups left unfinished).
 */

import { describe, test, expect } from 'vitest';
import {
  uploadMemoPosts,
  CREATE_MEMO_POSTS_TABLE_SQL,
  UPSERT_MEMO_POST_SQL,
} from '../scripts/upload-memo-posts-to-d1';
import type { D1Client } from '../scripts/d1-env-client';
import type { MemoPostRow } from '../scripts/extract-memo-posts';

const samplePosts: MemoPostRow[] = [
  {
    filePath: 'consulting/navigate/social-proof.md',
    date: '2025-09-08',
    title: 'Social proof',
    authors: ['monotykamary'],
    tags: ['consulting', 'navigate', 'sales', 'social-proof'],
  },
  {
    filePath: 'research/breakdown/cap.md',
    date: '2025-09-09',
    title: 'CAP breakdown',
    authors: ['R-Jim'],
    tags: ['architecture', 'audio', 'breakdown', 'screen-recording'],
  },
];

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

describe('uploadMemoPosts', () => {
  test('creates the table then upserts one row per post, keyed by file_path', async () => {
    const { client, calls } = createRecordingD1Client();

    const count = await uploadMemoPosts(client, samplePosts, { commitSha: 'deadbeef' });

    expect(count).toBe(2);
    expect(calls[0].sql).toBe(CREATE_MEMO_POSTS_TABLE_SQL);
    const upserts = calls.filter(c => c.sql === UPSERT_MEMO_POST_SQL);
    expect(upserts).toHaveLength(2);

    const first = upserts[0].params!;
    expect(first[0]).toBe('consulting/navigate/social-proof.md');
    expect(first[1]).toBe('2025-09-08');
    expect(first[2]).toBe('Social proof');
    expect(JSON.parse(first[3] as string)).toEqual(['monotykamary']);
    expect(JSON.parse(first[4] as string)).toEqual([
      'consulting',
      'navigate',
      'sales',
      'social-proof',
    ]);
    expect(first[5]).toBe('deadbeef');
    expect(UPSERT_MEMO_POST_SQL).toMatch(/ON CONFLICT\(file_path\) DO UPDATE/);
  });

  test('a re-run for the same posts replaces each row (idempotent, no new PK)', async () => {
    const { client, calls } = createRecordingD1Client();

    await uploadMemoPosts(client, samplePosts, { commitSha: 'deadbeef' });
    await uploadMemoPosts(client, samplePosts, { commitSha: 'cafef00d' });

    const upserts = calls.filter(c => c.sql === UPSERT_MEMO_POST_SQL);
    expect(upserts).toHaveLength(4);
    // same file_path (PK) both runs, only commit_sha/updated_at differ
    expect(upserts[0].params?.[0]).toBe(upserts[2].params?.[0]);
    expect(upserts[0].params?.[5]).toBe('deadbeef');
    expect(upserts[2].params?.[5]).toBe('cafef00d');
  });

  test('dry-run never touches the client (asserts against a client that throws if called)', async () => {
    const throwingClient: D1Client = {
      execute: async () => {
        throw new Error('execute must not be called during dry-run');
      },
    };

    await expect(
      uploadMemoPosts(throwingClient, samplePosts, { commitSha: 'deadbeef', dryRun: true }),
    ).resolves.toBe(samplePosts.length);
  });
});
