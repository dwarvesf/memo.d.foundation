import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The R2 and D1 stages sit after a ~15-minute build, so a single transient
// Cloudflare 502 used to red a run whose Pages deploy had already succeeded.
// retry() is what absorbs that. The script guards `main` behind a
// BASH_SOURCE check so this can source it and exercise the function alone.
const SCRIPT = path.join(__dirname, '..', 'scripts', 'build-and-deploy.sh');

function run(body: string) {
  // `sleep` is stubbed out so the backoff does not slow the suite down.
  const script = [
    'set -euo pipefail',
    `source ${JSON.stringify(SCRIPT)}`,
    'sleep() { :; }',
    body,
  ].join('\n');
  try {
    const stdout = execFileSync('bash', ['-c', script], { encoding: 'utf-8' });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { code: e.status, stdout: e.stdout, stderr: e.stderr };
  }
}

describe('scripts/build-and-deploy.sh retry()', () => {
  it('succeeds once the command stops failing', () => {
    const result = run(
      [
        'attempts=0',
        'flaky() { attempts=$((attempts + 1)); [ "$attempts" -ge 3 ]; }',
        'retry flaky',
        'echo "attempts=$attempts"',
      ].join('\n'),
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/attempts=3/);
  });

  it('gives up with a non-zero exit after the attempt cap', () => {
    const result = run(
      ['always_fails() { return 1; }', 'retry always_fails'].join('\n'),
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/failed after 3 attempts/);
  });

  it('passes the command stdout through untouched', () => {
    const result = run(['retry echo hello-from-retry'].join('\n'));
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/hello-from-retry/);
  });
});
