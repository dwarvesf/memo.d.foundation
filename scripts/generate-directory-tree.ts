import fs from 'fs/promises';
import path from 'path';
import { getDirectoryTree } from '../src/lib/content/utils.js';

// Emits the sidebar nav tree as a standalone static asset. The client fetches it
// once instead of every page inlining a copy into its props.
const outputPath = path.join(
  process.cwd(),
  'public/content/directory-tree.json',
);

async function main() {
  const directoryTree = await getDirectoryTree();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(directoryTree), 'utf-8');

  const { size } = await fs.stat(outputPath);
  console.log(
    `Directory tree written to ${outputPath} (${(size / 1024).toFixed(1)} KB)`,
  );
}

main().catch(error => {
  console.error('Error generating directory tree:', error);
  process.exit(1);
});
