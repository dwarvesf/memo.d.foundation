/**
 * @file export-markdown.test.ts
 * @description Unit coverage for the TypeScript port of the Elixir `mix export_markdown`
 * compiler (scripts/export-markdown.ts). Locks the transform behaviors that byte-parity
 * with the Elixir oracle depends on. The full 655/655 byte-parity run against the real
 * vault is documented in docs/cf-migration/compiler-rewrite.md; these are the fast unit
 * guards for the individual transforms.
 */

import { describe, test, expect } from 'vitest';
import {
  slugify,
  slugifyPath,
  slugifyLinkPath,
  wrapMultilineKatex,
  extractLinks,
} from '../scripts/export-markdown';

describe('slugify', () => {
  test('lowercases, strips punctuation, collapses spaces/dashes', () => {
    expect(slugify('My Cool Note!')).toBe('my-cool-note');
    expect(slugify('  a--b  ')).toBe('a-b');
  });
  test('is lossy on non-ASCII (matches the Elixir a-z0-9 strip)', () => {
    // Elixir Slugify.slugify strips anything outside [a-z0-9\s_-] AFTER downcase, so
    // Vietnamese diacritics are dropped rather than transliterated.
    expect(slugify('Đặng Anh')).toBe('ng-anh');
  });
});

describe('slugifyPath / slugifyLinkPath', () => {
  test('slugifies directory + filename, preserves extension', () => {
    expect(slugifyPath('Some Dir/My File.md')).toBe('some-dir/my-file.md');
  });
  test('leaves external URLs and anchors untouched, keeps fragment casing', () => {
    expect(slugifyLinkPath('https://x.com/A')).toBe('https://x.com/A');
    expect(slugifyLinkPath('Some Note.md#Heading')).toBe('some-note.md#Heading');
  });
});

describe('wrapMultilineKatex', () => {
  test('single-line block is untouched', () => {
    expect(wrapMultilineKatex('$$a+b$$')).toBe('$$a+b$$');
  });
  test('multi-line block gets surrounding newlines', () => {
    expect(wrapMultilineKatex('$$a\nb$$')).toBe('\n$$a\nb$$\n');
  });
});

describe('extractLinks (Elixir arity-drop parity)', () => {
  test('extracts image embeds, [[x.md|alt]] paths, and [[x|alt]] files', () => {
    expect(extractLinks('![[img.png]]')).toEqual(['img.png']);
    expect(extractLinks('[[deep/note.md|Alt]]')).toEqual(['deep/note.md']);
    expect(extractLinks('[[Some Note|Alt]]')).toEqual(['Some Note']);
  });
  test('does NOT extract plain [[x]] or [[x.md]] (Elixir drops these)', () => {
    // The Elixir flat_map clauses match on the Regex.scan result arity; plain wikilinks
    // land on clauses that never fire, so they are silently dropped. Extracting them here
    // would over-populate the fuzzy resolver and break byte-parity on short ambiguous
    // keys (e.g. [[Go]] matching an unrelated asset filename by substring).
    expect(extractLinks('[[Go]]')).toEqual([]);
    expect(extractLinks('[[plain-note.md]]')).toEqual([]);
    expect(extractLinks('see [[1]] and [[2]] refs')).toEqual([]);
  });
});
