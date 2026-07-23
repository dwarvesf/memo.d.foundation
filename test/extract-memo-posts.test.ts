/**
 * @file extract-memo-posts.test.ts
 * @description Extracts per-post rows from the REAL db/vault.parquet (same
 * DuckDB approach #303 used for its rollup query) and checks the shape
 * matches EXACTLY what fortress-api's discord.go reads off this file
 * (date, title, authors, tags, file_path -- cross-checked against
 * getMemosFromParquet / resolveAuthorsFromParquetByTitle in
 * fortress-api/pkg/handler/discord/discord.go).
 */

import path from 'path';
import { describe, test, expect } from 'vitest';
import { extractMemoPosts } from '../scripts/extract-memo-posts';

const vaultPath = path.join(process.cwd(), 'db/vault.parquet');

describe('extractMemoPosts (real db/vault.parquet)', () => {
  test('returns per-post rows shaped for fortress discord.go: file_path/date/title/authors/tags', async () => {
    const rows = await extractMemoPosts(vaultPath);

    expect(rows.length).toBeGreaterThan(1000);

    for (const row of rows) {
      expect(typeof row.filePath).toBe('string');
      expect(row.filePath.length).toBeGreaterThan(0);
      expect(typeof row.title).toBe('string');
      expect(row.title.length).toBeGreaterThan(0);
      expect(Array.isArray(row.authors)).toBe(true);
      expect(Array.isArray(row.tags)).toBe(true);
      expect(row.date === null || typeof row.date === 'string').toBe(true);
      if (row.date !== null) {
        expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  test('drops rows with no title or no file_path (not real posts)', async () => {
    const rows = await extractMemoPosts(vaultPath);

    expect(rows.every(r => r.filePath !== '' && r.title !== '')).toBe(true);
  });

  test('a known real post resolves with real authors/tags (matches the committed vault)', async () => {
    const rows = await extractMemoPosts(vaultPath);
    const post = rows.find(r => r.filePath === 'consulting/navigate/social-proof.md');

    expect(post).toBeDefined();
    expect(post?.title).toBe('Social proof');
    expect(post?.authors).toEqual(['monotykamary']);
    expect(post?.tags).toEqual(
      expect.arrayContaining(['consulting', 'navigate', 'sales', 'social-proof']),
    );
    expect(post?.date).toBe('2025-09-08');
  });

  test('is stably ordered by file_path (deterministic re-runs)', async () => {
    const rows = await extractMemoPosts(vaultPath);
    const filePaths = rows.map(r => r.filePath);
    const sorted = [...filePaths].sort();

    expect(filePaths).toEqual(sorted);
  });
});
