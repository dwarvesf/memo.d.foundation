/**
 * note-lint.js
 *
 * A modular note convention checker for Markdown files.
 *
 * Function:
 * - Recursively scans a target directory for Markdown (.md) files.
 * - Loads all rule modules from the 'rules' subdirectory.
 * - Applies each rule's check function to every Markdown file.
 * - Reports any violations found by the rules.
 * - Exits with code 2 if any violations are found, otherwise exits normally.
 *
 * How to run:
 *   node scripts/formatter/note-lint.js <path-to-directory> [comma-separated-rule-names]
 *
 * Example:
 *   node scripts/formatter/note-lint.js vault/
 *   node scripts/formatter/note-lint.js vault frontmatter,no-heading1
 *
 * Rules:
 * - Each rule is a separate module in the 'rules' directory.
 * - Each rule module exports a 'check(file, content)' function that returns an array of violation messages.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rulesDir = path.join(__dirname, 'rules');

async function loadRules(enabledRules) {
  let ruleFiles = fs.readdirSync(rulesDir).filter(f => f.endsWith('.js'));
  if (enabledRules && enabledRules.length > 0) {
    // Filter ruleFiles to only those in enabledRules (match by filename without extension)
    ruleFiles = ruleFiles.filter(f =>
      enabledRules.includes(path.basename(f, '.js')),
    );
  }
  const rules = [];
  for (const f of ruleFiles) {
    const mod = await import(path.join(rulesDir, f).replace(/\\/g, '/'));
    rules.push(mod);
  }
  return rules;
}

function searchFiles(dir, results) {
  const filesAndDirs = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of filesAndDirs) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      searchFiles(fullPath, results);
    } else if (entry.isFile() && fullPath.endsWith('.md')) {
      results.push(fullPath);
    }
  }
}

const args = process.argv.slice(2);
const targetPath = args[0];

if (!targetPath) {
  console.error('Usage: node note-lint.js <path> [comma-separated-rule-names]');
  process.exit(1);
}

const enabledRulesArg = args[1];
const enabledRules = enabledRulesArg
  ? enabledRulesArg.split(',').map(r => r.trim())
  : [];

const files = [];
searchFiles(targetPath, files);

let hasError = false;

(async () => {
  const rules = await loadRules(enabledRules);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const rule of rules) {
      const violations = rule.check(file, content);
      if (violations && violations.length > 0) {
        hasError = true;
        for (const v of violations) {
          console.log(`❌ ${file}: ${v}`);
        }
      }
    }
  }
  if (hasError) {
    process.exit(2);
  }
})();
