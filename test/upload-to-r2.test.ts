/**
 * @file upload-to-r2.test.ts
 * @description Unit tests + a dry-run against a mocked R2 client for
 * scripts/upload-to-r2.ts. Artifact paths mirror #302's build-inventory.md
 * exactly (db/vault.parquet, public/content/search-index.json, out/**).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { resolveArtifacts, uploadArtifacts, type R2Client } from '../scripts/upload-to-r2';

let repoRoot: string;

function writeFile(relPath: string, content: string) {
  const full = path.join(repoRoot, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function makeFullFixture() {
  writeFile('db/vault.parquet', 'fake-parquet-bytes');
  writeFile('public/content/search-index.json', '{"docs":[]}');
  writeFile('out/index.html', '<html>home</html>');
  writeFile('out/assets/app.js', 'console.log(1)');
}

beforeEach(() => {
  repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'memo-r2-test-'));
});

afterEach(() => {
  fs.rmSync(repoRoot, { recursive: true, force: true });
});

describe('resolveArtifacts', () => {
  test('finds exactly the #302 inventory paths when the build is complete', () => {
    makeFullFixture();

    const { found, missing } = resolveArtifacts(repoRoot);

    expect(missing).toEqual([]);
    const relKeys = found.map(a => a.relKey).sort();
    expect(relKeys).toEqual(
      ['db/vault.parquet', 'search-index.json', 'out/assets/app.js', 'out/index.html'].sort(),
    );

    const vaultDb = found.find(a => a.kind === 'vault-db');
    expect(vaultDb?.localPath).toBe(path.join(repoRoot, 'db/vault.parquet'));

    const searchIndex = found.find(a => a.kind === 'search-index');
    expect(searchIndex?.relKey).toBe('search-index.json');

    const rendered = found.filter(a => a.kind === 'rendered');
    expect(rendered).toHaveLength(2);
  });

  test('reports missing artifacts by their #302 path, no invented paths', () => {
    // Only the vault db exists; search index and out/ are absent.
    writeFile('db/vault.parquet', 'fake-parquet-bytes');

    const { found, missing } = resolveArtifacts(repoRoot);

    expect(found).toHaveLength(1);
    expect(missing).toEqual(['public/content/search-index.json', 'out/']);
  });

  test('treats an empty out/ dir as missing (nothing rendered to upload)', () => {
    writeFile('db/vault.parquet', 'x');
    writeFile('public/content/search-index.json', '{}');
    fs.mkdirSync(path.join(repoRoot, 'out'), { recursive: true });

    const { missing } = resolveArtifacts(repoRoot);

    expect(missing).toEqual(['out/ (empty)']);
  });
});

function createRecordingClient(existingShaByKey: Record<string, string> = {}): {
  client: R2Client;
  puts: Array<{ key: string; body: Buffer; contentType: string; contentSha256: string }>;
} {
  const puts: Array<{ key: string; body: Buffer; contentType: string; contentSha256: string }> = [];
  const client: R2Client = {
    async headObject(key) {
      const sha = existingShaByKey[key];
      return sha ? { contentSha256: sha } : null;
    },
    async putObject(key, body, opts) {
      puts.push({ key, body, ...opts });
    },
  };
  return { client, puts };
}

describe('uploadArtifacts', () => {
  test('uploads each artifact to a commit-scoped key and a latest key', async () => {
    makeFullFixture();
    const { found } = resolveArtifacts(repoRoot);
    const { client, puts } = createRecordingClient();

    const plans = await uploadArtifacts(client, found, { commitSha: 'abc1234' });

    // one commit-scoped + one latest key per artifact file
    expect(plans).toHaveLength(found.length * 2);
    expect(puts).toHaveLength(found.length * 2);

    const vaultPlans = plans.filter(p => p.relKey === 'db/vault.parquet');
    expect(vaultPlans.map(p => p.key).sort()).toEqual(
      ['derived/abc1234/db/vault.parquet', 'derived/latest/db/vault.parquet'].sort(),
    );
    expect(vaultPlans.every(p => p.action === 'upload')).toBe(true);

    const searchPut = puts.find(p => p.key === 'derived/latest/search-index.json');
    expect(searchPut?.contentType).toBe('application/json');

    const jsPut = puts.find(p => p.key === 'derived/latest/out/assets/app.js');
    expect(jsPut?.contentType).toBe('text/javascript; charset=utf-8');
  });

  test('is idempotent: a re-run with unchanged content skips the write (no duplicate)', async () => {
    makeFullFixture();
    const { found } = resolveArtifacts(repoRoot);
    const vaultBody = fs.readFileSync(path.join(repoRoot, 'db/vault.parquet'));
    const vaultSha = crypto.createHash('sha256').update(vaultBody).digest('hex');

    const { client, puts } = createRecordingClient({
      'derived/abc1234/db/vault.parquet': vaultSha,
      'derived/latest/db/vault.parquet': vaultSha,
    });

    const plans = await uploadArtifacts(client, found, { commitSha: 'abc1234' });

    const vaultPlans = plans.filter(p => p.relKey === 'db/vault.parquet');
    expect(vaultPlans.every(p => p.action === 'skip-unchanged')).toBe(true);
    expect(puts.some(p => p.key.endsWith('db/vault.parquet'))).toBe(false);

    // other artifacts (no matching sha recorded) still upload
    const searchPlans = plans.filter(p => p.relKey === 'search-index.json');
    expect(searchPlans.every(p => p.action === 'upload')).toBe(true);
  });

  test('changed content re-uploads even if the key already exists', async () => {
    makeFullFixture();
    const { found } = resolveArtifacts(repoRoot);
    const { client, puts } = createRecordingClient({
      'derived/abc1234/db/vault.parquet': 'stale-sha-does-not-match',
    });

    const plans = await uploadArtifacts(client, found, { commitSha: 'abc1234' });

    const scoped = plans.find(p => p.key === 'derived/abc1234/db/vault.parquet');
    expect(scoped?.action).toBe('upload');
    expect(puts.some(p => p.key === 'derived/abc1234/db/vault.parquet')).toBe(true);
  });

  test('dry-run never touches the client (asserts against a client that throws if called)', async () => {
    makeFullFixture();
    const { found } = resolveArtifacts(repoRoot);
    const throwingClient: R2Client = {
      headObject: async () => {
        throw new Error('headObject must not be called during dry-run');
      },
      putObject: async () => {
        throw new Error('putObject must not be called during dry-run');
      },
    };

    const plans = await uploadArtifacts(throwingClient, found, {
      commitSha: 'abc1234',
      dryRun: true,
    });

    expect(plans.every(p => p.action === 'dry-run')).toBe(true);
    expect(plans).toHaveLength(found.length * 2);
  });
});
