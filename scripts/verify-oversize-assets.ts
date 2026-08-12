// Fails loud when the build is about to silently drop an oversize asset that
// has no R2 proxy entry. Companion tripwire to verify-submodules.sh: the
// publish-pages.yml "Exclude files over the Pages 25 MiB per-file limit" step
// strips any file >25 MiB from `out/` before deploy (Pages hard-rejects the
// whole upload otherwise) with no failure and no map update, so a reader
// could hit a 404 for content that used to work. See PR #312,
// docs/cf-migration/M4-02-PAGES-CUTOVER-RECORD.md "Deviations and known gaps" #2.
//
// Usage: pnpm exec tsx scripts/verify-oversize-assets.ts [out-dir]
// Reads the paths about to be stripped (relative to repo root, e.g.
// "out/content/research/assets/foo.pdf", one per line, matching `find
// out -type f -size +25M` output) from stdin.
import path from 'path';
import { OVERSIZE_ASSET_MAP } from '../functions/lib/oversize-assets.js';

// OVERSIZE_ASSET_MAP keys on the request pathname (e.g.
// "/content/research/assets/foo.pdf"), so a stripped `out/`-relative file
// path maps to a map key by dropping the out-dir prefix and adding a
// leading slash.
function toUrlPath(filePath: string, outDir: string): string {
  const rel = path.relative(outDir, path.resolve(filePath));
  return '/' + rel.split(path.sep).join('/');
}

export function findUnmapped(
  strippedPaths: string[],
  outDir: string,
  map: Record<string, string> = OVERSIZE_ASSET_MAP,
): string[] {
  return strippedPaths.filter(f => !(toUrlPath(f, outDir) in map));
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function main(): Promise<void> {
  const outDir = path.resolve(process.argv[2] || 'out');
  const strippedPaths = (await readStdin())
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  if (strippedPaths.length === 0) {
    console.log('No files over 25 MiB were stripped; nothing to verify.');
    return;
  }

  const unmapped = findUnmapped(strippedPaths, outDir);

  if (unmapped.length > 0) {
    console.error(
      `ERROR: ${unmapped.length} oversize file(s) stripped from the deploy have no R2 proxy entry in functions/lib/oversize-assets.ts:`,
    );
    for (const f of unmapped) console.error(`  ${f}`);
    console.error(
      'Upload the file to R2 and add its path(s) to OVERSIZE_ASSET_MAP before this can deploy, or the content 404s for readers.',
    );
    process.exit(1);
  }

  console.log(
    `All ${strippedPaths.length} stripped oversize file(s) are covered by the R2 proxy map.`,
  );
}

main().catch(error => {
  console.error('Error verifying oversize assets:', error);
  process.exit(1);
});
