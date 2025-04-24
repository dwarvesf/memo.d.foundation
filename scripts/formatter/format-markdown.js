/**
 * Format all markdown files in a directory (recursively) using Prettier.
 *
 * Usage:
 *   node format-markdown.js <path>
 *
 * Example:
 *   node format-markdown.js ./vault/playground/notes
 */

import fs from "fs";
import path from "path";
import prettier from "prettier";

async function getMarkdownFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of list) {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      results = results.concat(await getMarkdownFiles(filePath));
    } else if (file.isFile() && file.name.endsWith('.md')) {
      results.push(filePath);
    }
  }
  return results;
}

async function formatFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const formatted = await prettier.format(content, { parser: 'markdown' });
    fs.writeFileSync(filePath, formatted, 'utf8');
    console.log(`✅ Formatted ${filePath}`);
    return true;
  } catch (err) {
    console.log(`❌ Failed to format ${filePath} - ${err.message}`);
    return false;
  }
}

async function main() {
  const targetPath = process.argv[2];
  if (!targetPath) {
    console.error('Please provide a path as the first argument.');
    process.exit(1);
  }
  const absPath = path.resolve(targetPath);
  if (!fs.existsSync(absPath)) {
    console.error(`Path does not exist: ${absPath}`);
    process.exit(1);
  }
  const stat = fs.statSync(absPath);
  let files = [];
  if (stat.isDirectory()) {
    files = await getMarkdownFiles(absPath);
  } else if (stat.isFile() && absPath.endsWith('.md')) {
    files = [absPath];
  } else {
    console.error('Provided path is neither a directory nor a markdown file.');
    process.exit(1);
  }

  if (files.length === 0) {
    console.log('No markdown files found.');
    return;
  }

  for (const file of files) {
    await formatFile(file);
  }
}

main();
