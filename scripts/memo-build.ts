import { execSync } from 'child_process';

// This script runs a series of commands to build the memo.d.foundation project.
// The commands are executed in sequence for valid build and deployment.
const commands = [
  'pnpm run generate-menu',
  'pnpm run generate-menu-path-sorted',
  'pnpm run generate-backlinks',
  'pnpm run generate-redirects-map',
  'pnpm run generate-shorten-map',
  'pnpm run generate-pageviews',
  'pnpm run fetch-prompts',
  'pnpm run fetch-contributors',
  'pnpm run generate-static-paths',
  'pnpm run generate-search-index',
  'next build',
  'pnpm run generate-rss',
  'pnpm run copy-404',
];

function runCommands() {
  for (const command of commands) {
    try {
      console.log(`Running command: ${command}`);
      execSync(command, { stdio: 'inherit' });
    } catch (error) {
      console.error(`Error running command "${command}":`, (error as any).message);
      process.exit(1);
    }
  }
}

runCommands();
