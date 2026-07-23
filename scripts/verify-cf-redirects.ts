import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';

// Proves the CF Pages redirect map has no gaps vs the nginx map memo.d.foundation
// deploys today: parses public/content/nginx_redirect_map.conf (the artifact
// scripts/generate-nginx-redirect-map.ts produces for Railway) and diffs it
// against functions/_generated-redirect-map.ts (the full map
// scripts/generate-cf-redirects.ts produces for Cloudflare Pages). Every
// source -> target pair in the nginx map must be present, with the same
// target, in the generated map.
//
// Usage:
//   tsx scripts/verify-cf-redirects.ts [content-dir] [functions-dir]
// Both default to ./public/content and ./functions under cwd. Point
// content-dir at any fully-built public/content tree (e.g. from a sibling
// worktree that ran the full mix export + build) to verify against real data.

const NGINX_LINE = /^\s*"([^"]+)"\s+"([^"]+)";\s*$/;

async function parseNginxMap(confPath: string): Promise<Record<string, string>> {
  const content = await fs.readFile(confPath, 'utf-8');
  const map: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const match = line.match(NGINX_LINE);
    if (match) {
      map[match[1]] = match[2];
    }
  }
  return map;
}

async function loadGeneratedMap(mapPath: string): Promise<Record<string, string>> {
  const mod = await import(pathToFileURL(mapPath).href);
  return mod.REDIRECT_MAP;
}

async function main() {
  const contentDir = path.resolve(process.argv[2] || 'public/content');
  const functionsDir = path.resolve(process.argv[3] || 'functions');
  const nginxConfPath = path.join(contentDir, 'nginx_redirect_map.conf');
  const generatedMapPath = path.join(functionsDir, '_generated-redirect-map.ts');

  const nginxMap = await parseNginxMap(nginxConfPath);
  const generatedMap = await loadGeneratedMap(generatedMapPath);

  const missing: string[] = [];
  const mismatched: string[] = [];

  for (const [source, target] of Object.entries(nginxMap)) {
    if (!(source in generatedMap)) {
      missing.push(source);
    } else if (generatedMap[source] !== target) {
      mismatched.push(source);
    }
  }

  console.log(`nginx map rules:                        ${Object.keys(nginxMap).length}`);
  console.log(`generated map rules (full, pre-cap):     ${Object.keys(generatedMap).length}`);
  console.log(`missing from generated map:               ${missing.length}`);
  console.log(`present but target mismatch:              ${mismatched.length}`);

  if (missing.length > 0) {
    console.error('Missing rules (first 20):', missing.slice(0, 20));
  }
  if (mismatched.length > 0) {
    console.error('Mismatched targets (first 20):');
    for (const source of mismatched.slice(0, 20)) {
      console.error(
        `  ${source}: nginx="${nginxMap[source]}" generated="${generatedMap[source]}"`,
      );
    }
  }

  if (missing.length > 0 || mismatched.length > 0) {
    console.error(
      'FAIL: the generated CF redirect map does not fully cover the nginx map.',
    );
    process.exit(1);
  }
  console.log(
    'PASS: every nginx map rule is present in the generated CF redirect map with the same target.',
  );
}

main().catch(error => {
  console.error('Error verifying CF redirects:', error);
  process.exit(1);
});
