#!/usr/bin/env tsx

/**
 * Upload the memo.d.foundation build's derived artifacts to Cloudflare R2.
 *
 * Artifact list is the exact set named in the #302 build-inventory
 * (docs/cf-migration/build-inventory.md): db/vault.parquet (carries the
 * embeddings), the search index, and the rendered `out/` tree. No other
 * paths are invented here.
 *
 * Each file is uploaded to two keys so a re-run never duplicates objects:
 *   derived/<commitSha>/<relKey>  - immutable, one object per commit
 *   derived/latest/<relKey>       - mutable pointer consumers should read
 * A HEAD-before-PUT content-hash check skips the write entirely when the
 * object at that key already has the same content (real R2 client only;
 * dry-run never touches the network).
 *
 * Usage:
 *   tsx scripts/upload-to-r2.ts             # real upload, needs R2_* env
 *   tsx scripts/upload-to-r2.ts --dry-run   # resolve + plan only, no network
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

export type ArtifactKind = 'vault-db' | 'search-index' | 'rendered';

export interface ArtifactSource {
  kind: ArtifactKind;
  localPath: string;
  relKey: string;
}

// Exactly the artifacts named in #302's build-inventory.md for N.4/N.5.
// Do not add paths here without a matching row in that inventory.
const CORE_ARTIFACTS: Array<{
  kind: ArtifactKind;
  localRelPath: string;
  relKey: string;
}> = [
  { kind: 'vault-db', localRelPath: 'db/vault.parquet', relKey: 'db/vault.parquet' },
  {
    kind: 'search-index',
    localRelPath: 'public/content/search-index.json',
    relKey: 'search-index.json',
  },
];

function walkDir(root: string, base = ''): string[] {
  const entries = fs.readdirSync(path.join(root, base), { withFileTypes: true });
  let out: string[] = [];
  for (const entry of entries) {
    const rel = base ? path.join(base, entry.name) : entry.name;
    if (entry.isDirectory()) {
      out = out.concat(walkDir(root, rel));
    } else {
      out.push(rel);
    }
  }
  return out;
}

function toPosix(relPath: string): string {
  return relPath.split(path.sep).join('/');
}

export function resolveArtifacts(repoRoot: string): {
  found: ArtifactSource[];
  missing: string[];
} {
  const found: ArtifactSource[] = [];
  const missing: string[] = [];

  for (const artifact of CORE_ARTIFACTS) {
    const localPath = path.join(repoRoot, artifact.localRelPath);
    if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
      found.push({ kind: artifact.kind, localPath, relKey: artifact.relKey });
    } else {
      missing.push(artifact.localRelPath);
    }
  }

  const outDir = path.join(repoRoot, 'out');
  if (fs.existsSync(outDir) && fs.statSync(outDir).isDirectory()) {
    const files = walkDir(outDir);
    if (files.length === 0) {
      missing.push('out/ (empty)');
    }
    for (const relFile of files) {
      found.push({
        kind: 'rendered',
        localPath: path.join(outDir, relFile),
        relKey: toPosix(path.join('out', relFile)),
      });
    }
  } else {
    missing.push('out/');
  }

  return { found, missing };
}

function guessContentType(relKey: string): string {
  const ext = path.extname(relKey).toLowerCase();
  switch (ext) {
    case '.parquet':
      return 'application/octet-stream';
    case '.json':
      return 'application/json';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.xml':
      return 'application/xml';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.txt':
      return 'text/plain; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

export interface R2Client {
  headObject(key: string): Promise<{ contentSha256?: string } | null>;
  putObject(
    key: string,
    body: Buffer,
    opts: { contentType: string; contentSha256: string },
  ): Promise<void>;
}

export interface UploadPlan {
  key: string;
  relKey: string;
  kind: ArtifactKind;
  sizeBytes: number;
  sha256: string;
  action: 'upload' | 'skip-unchanged' | 'dry-run';
}

export async function uploadArtifacts(
  client: R2Client,
  artifacts: ArtifactSource[],
  opts: { commitSha: string; dryRun?: boolean },
): Promise<UploadPlan[]> {
  const plans: UploadPlan[] = [];

  for (const artifact of artifacts) {
    const body = fs.readFileSync(artifact.localPath);
    const sha256 = crypto.createHash('sha256').update(body).digest('hex');
    const contentType = guessContentType(artifact.relKey);

    const keys = [
      `derived/${opts.commitSha}/${artifact.relKey}`,
      `derived/latest/${artifact.relKey}`,
    ];

    for (const key of keys) {
      let action: UploadPlan['action'] = 'upload';

      if (opts.dryRun) {
        action = 'dry-run';
      } else {
        const existing = await client.headObject(key);
        if (existing?.contentSha256 === sha256) {
          action = 'skip-unchanged';
        }
      }

      if (action === 'upload') {
        await client.putObject(key, body, { contentType, contentSha256: sha256 });
      }

      plans.push({
        key,
        relKey: artifact.relKey,
        kind: artifact.kind,
        sizeBytes: body.length,
        sha256,
        action,
      });
    }
  }

  return plans;
}

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function toAmzDate(now: Date): { amzDate: string; dateStamp: string } {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

// ponytail: hand-rolled SigV4 instead of pulling in aws4fetch (rung 3, stdlib
// crypto only; no new dependency to add/lock in this worktree). Untested
// against live R2 (deploy-gated, see goal Notes) - if R2 ever 403s on a real
// upload, verify against Cloudflare's R2 S3-API signing example first.
function createR2ClientFromEnv(env: NodeJS.ProcessEnv = process.env): R2Client {
  const accountId = requireEnv(env, 'R2_ACCOUNT_ID');
  const bucket = requireEnv(env, 'R2_BUCKET_NAME');
  const accessKeyId = requireEnv(env, 'R2_ACCESS_KEY_ID');
  const secretAccessKey = requireEnv(env, 'R2_SECRET_ACCESS_KEY');
  const region = 'auto';
  const service = 's3';
  const host = `${accountId}.r2.cloudflarestorage.com`;

  async function signedRequest(
    method: string,
    key: string,
    body: Buffer | undefined,
    extraHeaders: Record<string, string>,
  ): Promise<Response> {
    const now = new Date();
    const { amzDate, dateStamp } = toAmzDate(now);
    const payloadHash = sha256hex(body ?? Buffer.alloc(0));
    const canonicalUri = `/${bucket}/${key
      .split('/')
      .map(seg => encodeURIComponent(seg))
      .join('/')}`;

    const headers: Record<string, string> = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...extraHeaders,
    };
    const signedHeaderNames = Object.keys(headers)
      .map(h => h.toLowerCase())
      .sort();
    const headerByLower = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v.trim()]),
    );
    const canonicalHeaders = signedHeaderNames.map(h => `${h}:${headerByLower[h]}\n`).join('');
    const signedHeaders = signedHeaderNames.join(';');
    const canonicalRequest = [
      method,
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256hex(canonicalRequest),
    ].join('\n');

    const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, service);
    const kSigning = hmac(kService, 'aws4_request');
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return fetch(`https://${host}${canonicalUri}`, {
      method,
      headers: { ...headers, authorization },
      body,
    });
  }

  return {
    async headObject(key) {
      const res = await signedRequest('HEAD', key, undefined, {});
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`R2 HEAD ${key} failed: ${res.status}`);
      }
      const contentSha256 = res.headers.get('x-amz-meta-content-sha256') ?? undefined;
      return { contentSha256 };
    },
    async putObject(key, body, opts) {
      const res = await signedRequest('PUT', key, body, {
        'content-type': opts.contentType,
        'x-amz-meta-content-sha256': opts.contentSha256,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`R2 PUT ${key} failed: ${res.status} ${text}`);
      }
    },
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const repoRoot = process.cwd();
  const commitSha =
    process.env.GITHUB_SHA?.trim() ||
    execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim();

  const { found, missing } = resolveArtifacts(repoRoot);

  if (missing.length > 0) {
    console.error(`Required artifact(s) missing, cannot proceed: ${missing.join(', ')}`);
    process.exit(1);
    return;
  }

  console.log(
    `Resolved ${found.length} artifact file(s) for commit ${commitSha}${dryRun ? ' [dry-run]' : ''}`,
  );

  const client: R2Client = dryRun
    ? {
        headObject: async () => {
          throw new Error('R2Client.headObject should not be called in --dry-run');
        },
        putObject: async () => {
          throw new Error('R2Client.putObject should not be called in --dry-run');
        },
      }
    : createR2ClientFromEnv();

  const plans = await uploadArtifacts(client, found, { commitSha, dryRun });

  for (const plan of plans) {
    console.log(
      `${plan.action.padEnd(14)} ${plan.key} (${plan.sizeBytes}B, sha256:${plan.sha256.slice(0, 12)})`,
    );
  }
  console.log(`Done. ${plans.length} object write(s) planned/executed.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
