#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import path from 'path';
import { main as noteLinter } from './note-lint.js';

async function getMarkdownFilesFromGit(): Promise<string[]> {
  try {
    const stdout = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    const files = stdout.split('\n').filter(file => ['.md', '.mdx'].some(ext => file.endsWith(ext)) && file.trim() !== '');
    return files.map(file => path.resolve(process.cwd(), file));
  } catch (error: any) {
    console.error('Error getting git staged files:', error.message);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const filePaths = await getMarkdownFilesFromGit();

  if (filePaths.length === 0) {
    console.log('No staged markdown files found to lint.');
    process.exit(0);
  }

  await noteLinter(filePaths);
}

main().catch((error: any) => {
  console.error('An unexpected error occurred:', error);
  process.exit(1);
});
