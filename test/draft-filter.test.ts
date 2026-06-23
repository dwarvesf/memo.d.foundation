/**
 * @file draft-filter.test.ts
 * @description Tests that `draft: true` frontmatter un-publishes a page.
 *
 * Covers:
 * - the `isPublished` predicate (single source of truth for publishability)
 * - `getAllMarkdownContents({ excludeDrafts: true })` dropping draft pages
 *   while keeping published ones (negative control)
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { getAllMarkdownContents, isPublished } from '../src/lib/content/memo';

// getAllMarkdownContents reads from <cwd>/public/content, so the fixture has to
// live there. Use a uniquely-named subdir to avoid clobbering real content.
const FIXTURE_DIR = 'zzz-draft-filter-test';
const CONTENT_ROOT = path.join(process.cwd(), 'public/content', FIXTURE_DIR);

const PUBLISHED = `---
title: Published Probe
date: '2026-01-01'
---

Visible body.
`;

const DRAFT = `---
title: Draft Probe
date: '2026-01-01'
draft: true
---

Hidden body.
`;

beforeAll(async () => {
  await fs.mkdir(CONTENT_ROOT, { recursive: true });
  await fs.writeFile(path.join(CONTENT_ROOT, 'published.md'), PUBLISHED);
  await fs.writeFile(path.join(CONTENT_ROOT, 'draft.md'), DRAFT);
});

afterAll(async () => {
  await fs.rm(CONTENT_ROOT, { recursive: true, force: true });
});

describe('isPublished', () => {
  test('returns true when draft is absent or false', () => {
    expect(isPublished({})).toBe(true);
    expect(isPublished({ draft: false })).toBe(true);
    expect(isPublished(undefined)).toBe(true);
  });

  test('returns false when draft is true', () => {
    expect(isPublished({ draft: true })).toBe(false);
  });
});

describe('getAllMarkdownContents excludeDrafts', () => {
  test('excludes draft pages but keeps published ones', async () => {
    const memos = await getAllMarkdownContents(FIXTURE_DIR, {
      excludeDrafts: true,
      includeContent: false,
    });
    const titles = memos.map(m => m.title);
    expect(titles).toContain('Published Probe');
    expect(titles).not.toContain('Draft Probe');
  });

  test('negative control: default includes the draft page', async () => {
    const memos = await getAllMarkdownContents(FIXTURE_DIR, {
      includeContent: false,
    });
    const titles = memos.map(m => m.title);
    expect(titles).toContain('Published Probe');
    expect(titles).toContain('Draft Probe');
  });
});
