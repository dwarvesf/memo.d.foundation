#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import { main as noteLinter } from './note-lint.js';

async function getMarkdownFilesFromGit() {
  try {
    // Get staged markdown files (for pre-commit hook)
    // Or, for files changed in the last commit:
    // const stdout = execSync('git diff --name-only HEAD HEAD~1', { encoding: 'utf8' });
    // For simplicity and common pre-commit use case, we'll use staged files.
    const stdout = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    const files = stdout.split('\n').filter(file => ['.md', '.mdx'].some(ext => file.endsWith(ext)) && file.trim() !== '');
    return files.map(file => path.resolve(process.cwd(), file));
  } catch (error) {
    console.error('Error getting git staged files:', error.message);
    process.exit(1);
  }
}

async function main() {
  const filePaths = await getMarkdownFilesFromGit();

  if (filePaths.length === 0) {
    console.log('No staged markdown files found to lint.');
    process.exit(0);
  }

  await noteLinter(filePaths);
}

main().catch(error => {
  console.error('An unexpected error occurred:', error);
  process.exit(1);
});
