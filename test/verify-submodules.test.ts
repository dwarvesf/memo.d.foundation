import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// scripts/verify-submodules.sh is the fail-loud tripwire git-fetch.sh now
// runs after every submodule update: it turns a partial/broken submodule
// tree (the dwarvesf/opensource#1 dead-pointer failure mode) into a non-zero
// exit instead of a silently "successful" run. This exercises it against
// synthetic `git submodule status --recursive` output so it doesn't depend
// on the real (500MB+) vault submodule tree being checked out.
const SCRIPT = path.join(__dirname, '..', 'scripts', 'verify-submodules.sh');

function run(stdin: string) {
  try {
    const stdout = execFileSync('bash', [SCRIPT], { input: stdin, encoding: 'utf-8' });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { code: e.status, stdout: e.stdout, stderr: e.stderr };
  }
}

describe('scripts/verify-submodules.sh', () => {
  it('exits 0 when every submodule is initialized and in sync', () => {
    const clean = [
      ' bc8945d9a9a3e41f113aa790d9e9080824a5dba6 vault (heads/main)',
      ' 9453bd9ce69111cdb1ad71277a5e908132bf1511 vault/opensource (heads/main)',
    ].join('\n');
    const result = run(clean);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/verified OK/);
  });

  it('exits 1 and names the submodule when one is uninitialized (`-`)', () => {
    const broken = [
      ' bc8945d9a9a3e41f113aa790d9e9080824a5dba6 vault (heads/main)',
      '-9453bd9ce69111cdb1ad71277a5e908132bf1511 vault/opensource',
    ].join('\n');
    const result = run(broken);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/vault\/opensource/);
  });

  it('exits 1 when a submodule is checked out at the wrong commit (`+`)', () => {
    const outOfSync = [
      ' bc8945d9a9a3e41f113aa790d9e9080824a5dba6 vault (heads/main)',
      '+e7fed86b4aa3d1ee7f42279c77c5d683d7413c01 vault/research (heads/master)',
    ].join('\n');
    const result = run(outOfSync);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/vault\/research/);
  });
});
