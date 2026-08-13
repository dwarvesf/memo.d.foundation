import fs from 'fs/promises';
import path from 'path';
import { getMemosWithTags } from '../src/lib/content/memos-with-tags.js';

// Emits every tagged memo as a standalone static asset. The client fetches it
// once instead of the homepage inlining a copy into its props.
const outputPath = path.join(
  process.cwd(),
  'public/content/memos-with-tags.json',
);

async function main() {
  const memosWithTags = await getMemosWithTags();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(memosWithTags), 'utf-8');

  const { size } = await fs.stat(outputPath);
  console.log(
    `Memos with tags written to ${outputPath} (${(size / 1024).toFixed(1)} KB)`,
  );
}

main().catch(error => {
  console.error('Error generating memos with tags:', error);
  process.exit(1);
});
