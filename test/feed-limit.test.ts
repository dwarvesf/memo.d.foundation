import { describe, expect, it } from 'vitest';
import { feedLimitFilename } from '../functions/lib/feed-limit';

describe('feedLimitFilename (CF Pages RSS ?limit= handling)', () => {
  it('defaults to 20 when limit is missing', () => {
    expect(feedLimitFilename('rss', null)).toBe('/rss_20.xml');
  });

  it('defaults to 20 when limit is not a positive integer', () => {
    expect(feedLimitFilename('rss', '0')).toBe('/rss_20.xml');
    expect(feedLimitFilename('rss', '-5')).toBe('/rss_20.xml');
    expect(feedLimitFilename('rss', 'abc')).toBe('/rss_20.xml');
    expect(feedLimitFilename('rss', '')).toBe('/rss_20.xml');
  });

  it('uses the exact requested limit when it is a positive integer', () => {
    expect(feedLimitFilename('rss', '50')).toBe('/rss_50.xml');
    expect(feedLimitFilename('atom', '10')).toBe('/atom_10.xml');
  });

  it('does not clamp to a pre-generated step; caller falls back on 404', () => {
    // 37 isn't one of the pre-generated multiples of 5 (10..100); the
    // middleware's serveWithFallback is what falls back to the unlimited
    // feed when this path 404s, mirroring nginx's try_files chain.
    expect(feedLimitFilename('feed', '37')).toBe('/feed_37.xml');
  });

  it('respects basename for each feed type', () => {
    for (const basename of ['rss', 'atom', 'feed', 'index']) {
      expect(feedLimitFilename(basename, '20')).toBe(`/${basename}_20.xml`);
    }
  });
});
