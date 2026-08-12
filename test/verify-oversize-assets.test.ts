import path from 'path';
import { describe, expect, it } from 'vitest';
import { findUnmapped } from '../scripts/verify-oversize-assets';

// scripts/verify-oversize-assets.ts is the fail-loud tripwire the
// publish-pages.yml strip step runs before deploy: it turns a silently
// dropped oversize asset (no R2 proxy entry) into a non-zero exit instead of
// a 404 readers only discover in production. Exercises findUnmapped (the
// pure map-lookup, no filesystem/process dependency) against a synthetic map
// so it doesn't depend on the real OVERSIZE_ASSET_MAP staying in sync.
describe('findUnmapped (oversize asset R2 proxy map coverage)', () => {
  const outDir = path.resolve('out');
  const map = {
    '/content/research/assets/mapped.pdf': 'assets/oversize/mapped.pdf',
  };

  it('passes a stripped file that already has a map entry (positive control)', () => {
    const stripped = [path.join('out', 'content/research/assets/mapped.pdf')];
    expect(findUnmapped(stripped, outDir, map)).toEqual([]);
  });

  it('fails a stripped file with no map entry (negative control)', () => {
    const stripped = [
      path.join('out', 'content/research/assets/mapped.pdf'),
      path.join('out', 'content/research/assets/unmapped.pdf'),
    ];
    expect(findUnmapped(stripped, outDir, map)).toEqual([
      path.join('out', 'content/research/assets/unmapped.pdf'),
    ]);
  });
});
