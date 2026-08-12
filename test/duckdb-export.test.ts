/**
 * @file duckdb-export.test.ts
 * @description Unit coverage for the TypeScript port of the Elixir `mix duckdb.export`
 * reindexer (scripts/duckdb-export.ts). Locks the pure functions whose behaviour the
 * parquet parity depends on: the Erlang-compatible Jaro similarity that decides whether a
 * note is reprocessed, Elixir float and grapheme-length semantics, the frontmatter
 * coercions, and the SQL value serializers.
 *
 * Every expected number here was produced by running the Elixir/Erlang function on the
 * same input; the full-vault parity run against the Elixir oracle is documented in the PR.
 */

import { describe, test, expect } from 'vitest';
import {
  Duck,
  batchUpsertIntoDuckdb,
  vaultTableDdl,
  jaroDistance,
  elixirFloat,
  graphemeLength,
  normalizeArrayValue,
  normalizeValueForComparison,
  transformValue,
  escapeString,
  escapeMultilineText,
  extractFrontmatter,
  needsEmbeddingsUpdate,
  parseArgs,
} from '../scripts/duckdb-export';

describe('jaroDistance (Erlang :string.jaro_similarity parity)', () => {
  // Reference values from String.jaro_distance/2 on Elixir 1.20.3.
  const cases: Array<[string, string, string]> = [
    ['martha', 'marhta', '0.944444444444'],
    ['dwayne', 'duane', '0.822222222222'],
    ['dixon', 'dicksonx', '0.766666666667'],
    ['abcdefghij', 'jihgfedcba', '0.433333333333'],
    ['a\nb\nc', 'a\\nb\\nc', '0.676190476190'],
    ['hello world', 'hello  world', '0.972222222222'],
  ];
  test.each(cases)('jaro(%j, %j)', (a, b, expected) => {
    expect(jaroDistance(a, b).toFixed(12)).toBe(expected);
  });

  test('identical strings short-circuit to 1.0, empty to 0.0', () => {
    expect(jaroDistance('same', 'same')).toBe(1.0);
    expect(jaroDistance('', 'abc')).toBe(0.0);
    expect(jaroDistance('abc', '')).toBe(0.0);
  });

  test('transposition count is halved as a float, not floored', () => {
    // An odd transposition count is where a floor(t/2) implementation diverges.
    expect(jaroDistance('abcde', 'baced').toFixed(12)).toBe('0.866666666667');
  });
});

describe('elixirFloat (Erlang shortest round-trip formatting)', () => {
  test.each([
    [0, '0.0'],
    [1, '1.0'],
    [1.5, '1.5'],
    [0.1, '0.1'],
    [3e-4, '0.0003'],
    [0.00012345, '1.2345e-4'],
    [5e-5, '5.0e-5'],
    [1e-7, '1.0e-7'],
    [123456789, '123456789.0'],
    [1e15, '1.0e15'],
    [1e21, '1.0e21'],
    [0.021121589466929436, '0.021121589466929436'],
  ])('elixirFloat(%p)', (input, expected) => {
    expect(elixirFloat(input)).toBe(expected);
  });
});

describe('graphemeLength (Elixir String.length)', () => {
  test('counts extended grapheme clusters, not UTF-16 units', () => {
    expect(graphemeLength('hello')).toBe(5);
    expect(graphemeLength('Tiếng Việt')).toBe(10);
    expect(graphemeLength('👨‍👩‍👧')).toBe(1);
    // CRLF is one cluster, which is why the ASCII fast path must exclude it.
    expect(graphemeLength('a\r\nb')).toBe(3);
  });
});

describe('normalizeArrayValue', () => {
  test('sorts by UTF-8 byte order, drops empties', () => {
    expect(normalizeArrayValue(['b', '', 'a', 'C'], 'tags')).toEqual([
      'C',
      'a',
      'b',
    ]);
  });
  test('parses bracketed and comma-separated string forms', () => {
    expect(normalizeArrayValue('[\'a\', "b"]', 'tags')).toEqual(['a', 'b']);
    expect(normalizeArrayValue('a, b', 'tags')).toEqual(['a', 'b']);
    expect(normalizeArrayValue('solo', 'authors')).toEqual(['solo']);
    expect(normalizeArrayValue('   ', 'tags')).toEqual([]);
    expect(normalizeArrayValue(null, 'tags')).toEqual([]);
  });
  test('ai_generated_summary is flattened to sorted words', () => {
    expect(
      normalizeArrayValue(['Hello, World!', 'hello'], 'ai_generated_summary'),
    ).toEqual(['hello', 'hello', 'world']);
  });
});

describe('normalizeValueForComparison', () => {
  test('booleans and nil pass through', () => {
    expect(normalizeValueForComparison(true, 'draft')).toBe(true);
    expect(normalizeValueForComparison(null, 'title')).toBe(null);
  });
  test('DATE columns collapse a datetime to its date', () => {
    expect(normalizeValueForComparison('2024-01-15T10:20:30Z', 'date')).toBe(
      '2024-01-15',
    );
    expect(normalizeValueForComparison('2024-01-15', 'date')).toBe(
      '2024-01-15',
    );
    expect(normalizeValueForComparison('not a date', 'date')).toBe(
      'not a date',
    );
  });
  test('numeric strings and numbers converge on one representation', () => {
    expect(normalizeValueForComparison('007', 'title')).toBe('7.0');
    expect(normalizeValueForComparison(7, 'icy')).toBe('7.0');
    expect(normalizeValueForComparison(1.5, 'icy')).toBe('1.5');
    expect(normalizeValueForComparison("it''s", 'title')).toBe("it's");
  });
  test('array columns compare order-insensitively', () => {
    expect(normalizeValueForComparison(['b', 'a'], 'tags')).toEqual(
      normalizeValueForComparison(['a', 'b'], 'tags'),
    );
  });
});

describe('SQL value serializers', () => {
  test('escapeString normalizes doubled quotes before escaping', () => {
    expect(escapeString("it's")).toBe("it''s");
    expect(escapeString("it''s")).toBe("it''s");
  });
  test('md_content is trimmed and newlines become a literal backslash-n', () => {
    expect(escapeMultilineText('\n a\nb \n')).toBe("'a\\nb'");
  });
  test('list columns render as a DuckDB list literal, empty becomes NULL', () => {
    expect(transformValue(['a', "b's"], 'tags')).toBe("['a', 'b''s']");
    expect(transformValue([], 'tags')).toBe('NULL');
    expect(transformValue('solo', 'authors')).toBe("['solo']");
  });
  test('non-listed array columns round-trip as a JSON string literal', () => {
    // social/PICs/redirect/ai_generated_summary fall through to the JSON encoder, which is
    // why an empty one is stored as an empty array rather than NULL.
    expect(transformValue([], 'social')).toBe("'[]'");
    expect(transformValue(['x'], 'redirect')).toBe('\'["x"]\'');
  });
  test('embeddings become an explicitly cast ARRAY literal', () => {
    expect(transformValue([1, -0.5], 'embeddings_gemini')).toBe(
      'ARRAY[1.0::FLOAT, -0.5::FLOAT]',
    );
  });
  test('nil is NULL for every column', () => {
    expect(transformValue(null, 'md_content')).toBe('NULL');
    expect(transformValue(undefined, 'embeddings_gemini')).toBe('NULL');
  });
  test('scalars keep their Elixir rendering', () => {
    expect(transformValue(true, 'draft')).toBe('true');
    expect(transformValue(1234, 'estimated_tokens')).toBe('1234');
    expect(transformValue('a', 'title')).toBe("'a'");
  });
});

describe('extractFrontmatter', () => {
  test('splits frontmatter from body', () => {
    const r = extractFrontmatter(
      '---\ntitle: A\ntags:\n  - x\n---\nbody\nmore\n',
    );
    expect(r?.frontmatter).toEqual({ title: 'A', tags: ['x'] });
    expect(r?.mdContent).toBe('body\nmore\n');
  });
  test('dates stay strings, matching YamlElixir rather than the js-yaml 1.1 schema', () => {
    const r = extractFrontmatter(
      '---\ntitle: A\ndate: 2024-01-15\nb: yes\n---\nx\n',
    );
    expect(r?.frontmatter.date).toBe('2024-01-15');
    expect(r?.frontmatter.b).toBe('yes');
  });
  test('no frontmatter and unterminated frontmatter both return null', () => {
    expect(extractFrontmatter('no frontmatter here')).toBeNull();
    expect(extractFrontmatter('---\ntitle: A\n')).toBeNull();
  });
});

describe('needsEmbeddingsUpdate (change-detection predicate)', () => {
  const paragraph =
    'The reindexer walks the vault and rebuilds the content database.\n' +
    'Each note is parsed, its frontmatter coerced, and its summary carried forward.\n' +
    'Only notes whose content actually moved are sent to the model again.\n';
  const prose = paragraph.repeat(6);
  const vector = [0.1];

  test('missing spr_content always forces a rebuild', () => {
    expect(needsEmbeddingsUpdate({}, prose)).toBe(true);
    expect(needsEmbeddingsUpdate({ spr_content: '' }, prose)).toBe(true);
  });
  test('unchanged content with both vectors present is skipped', () => {
    const existing = {
      spr_content: 'summary',
      md_content: prose,
      embeddings_gemini: vector,
      embeddings_spr_custom: vector,
    };
    expect(needsEmbeddingsUpdate(existing, prose)).toBe(false);
    // Stored md_content carries literal backslash-n where the file has real newlines. The
    // similarity has to stay above the 0.7 threshold or every note would reprocess forever
    // (Elixir reports 0.835245055997 for this pair).
    expect(
      needsEmbeddingsUpdate(
        { ...existing, md_content: prose.replaceAll('\n', '\\n') },
        prose,
      ),
    ).toBe(false);
  });
  test('a missing vector forces a rebuild even when the content matches', () => {
    expect(
      needsEmbeddingsUpdate(
        {
          spr_content: 's',
          md_content: prose,
          embeddings_gemini: null,
          embeddings_spr_custom: vector,
        },
        prose,
      ),
    ).toBe(true);
  });
  test('substantially different content forces a rebuild', () => {
    expect(
      needsEmbeddingsUpdate(
        {
          spr_content: 's',
          md_content: 'aaaaaaaaaaaaaaaaaaaaaaaaa',
          embeddings_gemini: vector,
          embeddings_spr_custom: vector,
        },
        'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
      ),
    ).toBe(true);
  });
});

describe('batchUpsertIntoDuckdb (frontmatter-only path)', () => {
  const seed = async (): Promise<Duck> => {
    const db = await Duck.open();
    await db.exec(vaultTableDdl());
    await db.exec(
      `INSERT INTO vault (file_path, md_content, spr_content, keywords, title)
       VALUES ('a.md', 'body', 'stored summary', ['alpha', 'beta'], 'Old')`,
    );
    return db;
  };
  const fileRow = (db: Duck) =>
    db
      .rows<{
        title: string;
        keywords: string[] | null;
        spr_content: string | null;
      }>(`SELECT title, keywords, spr_content FROM vault WHERE file_path = 'a.md'`)
      .then(r => r[0]);

  test('a changed frontmatter updates its own columns but carries keywords forward', async () => {
    // The AI columns are only ever written by the regeneration path, so a note that skips
    // regeneration must keep the stored keywords. The Elixir omits keywords from that
    // carry-forward and blanks them on every incremental run; this port does not.
    const db = await seed();
    await batchUpsertIntoDuckdb(db, [
      {
        filePath: 'a.md',
        mdContent: 'body',
        frontmatter: { file_path: 'a.md', md_content: 'body', title: 'New' },
        embeddingsUpdated: false,
        frontmatterChanged: true,
      },
    ]);
    const row = await fileRow(db);
    expect(row.title).toBe('New');
    expect(row.keywords).toEqual(['alpha', 'beta']);
    expect(row.spr_content).toBe('stored summary');
  });

  test('the regeneration path still writes keywords', async () => {
    const db = await seed();
    await batchUpsertIntoDuckdb(db, [
      {
        filePath: 'a.md',
        mdContent: 'body',
        frontmatter: {
          file_path: 'a.md',
          md_content: 'body',
          title: 'New',
          keywords: ['gamma'],
          spr_content: 'fresh summary',
        },
        embeddingsUpdated: true,
        frontmatterChanged: true,
      },
    ]);
    const row = await fileRow(db);
    expect(row.keywords).toEqual(['gamma']);
    expect(row.spr_content).toBe('fresh summary');
  });
});

describe('parseArgs', () => {
  test('defaults are repo-root relative', () => {
    expect(parseArgs([])).toEqual({
      vault: 'vault',
      db: 'db',
      format: 'parquet',
      ignoreFilter: false,
      ignoreEmbeddingsCheck: false,
    });
  });
  test('flags map onto the Mix task switches', () => {
    const o = parseArgs([
      '--vault',
      'v',
      '--db',
      'd',
      '-f',
      'csv',
      '--ignore-filter',
      '--ignore-embeddings-check',
    ]);
    expect(o).toEqual({
      vault: 'v',
      db: 'd',
      format: 'csv',
      ignoreFilter: true,
      ignoreEmbeddingsCheck: true,
    });
  });
});
