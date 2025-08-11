#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { main as noteLinter } from './note-lint.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// GitHub Actions context
const isGithubActions =
  process.env.GITHUB_ACTIONS === 'true' || !!process.env.GITHUB_ACTIONS;

/**
 * Get markdown files to lint.
 * - On GitHub Actions: use GITHUB_SHA and GITHUB_BASE_REF to get changed files in the PR or push.
 * - Locally: use git diff --cached --name-only for staged files.
 */
async function getMarkdownFiles(): Promise<string[]> {
  if (isGithubActions) {
    try {
      let files: string[] = [];

      // Get changed files from the GitHub Actions context
      const changedFiles = process.env.CHANGED_FILES;
      if (changedFiles) {
        files = changedFiles.split(',');
      }

      // Filter for .md and .mdx files that exist
      return files
        .filter(file => ['.md', '.mdx'].some(ext => file.endsWith(ext)) && file.trim() !== '')
        .filter(file => fs.existsSync(file))
        .map(file => path.resolve(process.cwd(), file));
    } catch (error: any) {
      console.error('Error getting changed files on GitHub Actions:', error.message);
      process.exit(1);
    }
  }

  // Local pre-commit context
  try {
    const stdout = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    const files = stdout.split('\n').filter(file => ['.md', '.mdx'].some(ext => file.endsWith(ext)) && file.trim() !== '');
    return files.map(file => path.resolve(process.cwd(), file));
  } catch (error: any) {
    console.error('Error getting git staged files:', error.message);
    process.exit(1);
  }
}

// Check if the event is a pull request
// by checking the GITHUB_EVENT_NAME environment variable
function getIsPullRequestEvent() {
  return process.env.GITHUB_EVENT_NAME === 'pull_request';
}

/**
 * Modular CI lint/format runner for markdown files.
 * Uses rule-based architecture (see rules/ directory).
 * - Linting: checks for rule violations.
 * - Formatting: applies rule-based formatting if lint passes.
 */
async function main(): Promise<void> {
  const filePaths = await getMarkdownFiles();

  if (filePaths.length === 0) {
    console.log('No markdown files found to lint.');
    process.exit(0);
  }

  // Doing automatic formatting with Prettier
  // This is disabled in GitHub Actions to avoid unnecessary changes in PRs.
  // In local development, we want to format files automatically.
  const gitHookFixes = !isGithubActions || getIsPullRequestEvent();

  console.log(`Linting markdown files...`);
  await noteLinter(filePaths, gitHookFixes);
}

main().catch((error: any) => {
  console.error('An unexpected error occurred:', error);
  process.exit(1);
});
