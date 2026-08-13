import { describe, expect, it } from 'vitest';
import {
  ATOM_BASENAME,
  FEED_LIMITS,
  RSS_ALIAS_BASENAMES,
  RSS_CANONICAL_BASENAME,
  RSS_LIMIT_VARIANTS,
} from '../scripts/feed-config';

describe('feed-config (shared by generate-rss.ts and generate-cf-redirects.ts)', () => {
  it('generates every multiple of 5 from 10 to 100 inclusive', () => {
    expect(RSS_LIMIT_VARIANTS).toEqual([
      10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,
      100,
    ]);
    expect(RSS_LIMIT_VARIANTS).toHaveLength(
      (FEED_LIMITS.MAX - FEED_LIMITS.MIN) / FEED_LIMITS.STEP + 1,
    );
  });

  it('keeps the alias basenames distinct from the canonical one', () => {
    expect(RSS_CANONICAL_BASENAME).toBe('feed');
    expect(RSS_ALIAS_BASENAMES).toEqual(['rss', 'index']);
    expect(RSS_ALIAS_BASENAMES).not.toContain(RSS_CANONICAL_BASENAME);
    expect(ATOM_BASENAME).toBe('atom');
  });
});
