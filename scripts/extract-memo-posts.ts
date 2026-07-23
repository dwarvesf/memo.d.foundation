/**
 * Extract per-post rows from db/vault.parquet, shaped to match EXACTLY what
 * fortress-api's Discord DuckDB path reads off this same file:
 *   fortress-api/pkg/handler/discord/discord.go
 *     - getMemosFromParquet: date, title, authors, tags, file_path (+ content,
 *       see note below)
 *     - resolveAuthorsFromParquetByTitle: title, authors
 *
 * `content` is NOT reproduced here: discord.go reads row["content"], but
 * vault.parquet has no "content" column (only "md_content"), so that field
 * is always empty in production today -- a pre-existing fortress-side no-op,
 * confirmed by cross-checking this repo's real schema, not carried forward
 * into memo_posts.
 *
 * Rows with no title or file_path are dropped (not real posts; vault.parquet
 * also carries author-profile rows with those columns unset).
 */

import { DuckDBInstance } from '@duckdb/node-api';

export interface MemoPostRow {
  filePath: string;
  date: string | null;
  title: string;
  authors: string[];
  tags: string[];
}

export async function extractMemoPosts(vaultParquetPath: string): Promise<MemoPostRow[]> {
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  try {
    // to_json() on the LIST columns is deliberate: @duckdb/node-api returns
    // LIST values as a `{ items: [...] }` wrapper, not a plain JS array, so
    // to_json()+JSON.parse gets a real string[] without depending on that
    // wrapper's shape. strftime() likewise turns the DuckDBDateValue struct
    // into a plain ISO string (or SQL NULL -> JS null) up front.
    const result = await connection.runAndReadAll(`
      SELECT
        file_path,
        strftime(date, '%Y-%m-%d') AS date,
        title,
        to_json(authors) AS authors_json,
        to_json(tags) AS tags_json
      FROM read_parquet('${vaultParquetPath}')
      WHERE title IS NOT NULL AND title != ''
        AND file_path IS NOT NULL AND file_path != ''
      ORDER BY file_path
    `);

    return result.getRowObjects().map(row => ({
      filePath: String(row.file_path),
      date: row.date == null ? null : String(row.date),
      title: String(row.title),
      authors: JSON.parse(String(row.authors_json ?? '[]')),
      tags: JSON.parse(String(row.tags_json ?? '[]')),
    }));
  } finally {
    connection.closeSync();
  }
}
