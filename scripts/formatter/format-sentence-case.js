/**
 * Script to format certain text elements in markdown files to sentence case using an LLM.
 *
 * It processes all markdown files found under the 'vault' directory.
 * For each file, it extracts:
 *  1. title in frontmatter
 *  2. headings
 *  3. highlights such as **word**
 *  4. bullet point definitions like "- hello world: message..."
 *
 * Then it sends these extracted items to an LLM to convert them to sentence case,
 * and replaces the original items in the file content with the converted ones.
 *
 * Usage: node scripts/formatter/format-sentence-case.js
 */

import fs from 'fs/promises';
import path from 'path';

// Directory to process
const VAULT_DIR = path.resolve(process.cwd(), 'vault');

// Regex patterns
const FRONTMATTER_TITLE_REGEX = /^title:\s*["']?(.+?)["']?\s*$/m;
const HEADING_REGEX = /^(#{1,6})\s*(.+)$/gm;
const HIGHLIGHT_REGEX = /\*\*(.+?)\*\*/g;
const BULLET_DEFINITION_REGEX = /^-\s*([^:\n]+):\s*(.+)$/gm;

// Helper to recursively find markdown files in a directory
async function findMarkdownFiles(dir) {
  let results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subResults = await findMarkdownFiles(fullPath);
      results = results.concat(subResults);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

// New helper to check if a path is a markdown file
async function isMarkdownFile(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && filePath.endsWith('.md');
  } catch {
    return false;
  }
}

// Extract items to rename from file content
function extractItems(content) {
  const items = new Set();

  // Extract frontmatter title
  const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const titleMatch = frontmatter.match(FRONTMATTER_TITLE_REGEX);
    if (titleMatch) {
      items.add(titleMatch[1]);
    }
  }

  // Extract headings
  let match;
  while ((match = HEADING_REGEX.exec(content)) !== null) {
    items.add(match[2].trim());
  }

  // Extract highlights **word**
  while ((match = HIGHLIGHT_REGEX.exec(content)) !== null) {
    items.add(match[1].trim());
  }

  // Extract bullet point definitions "- hello world: message"
  while ((match = BULLET_DEFINITION_REGEX.exec(content)) !== null) {
    items.add(match[1].trim());
  }

  return Array.from(items);
}

// Placeholder function to call LLM to convert array of strings to sentence case
// For now, we simulate by converting first letter uppercase, rest lowercase
async function convertToSentenceCaseWithLLM(items) {
  // TODO: Replace this with actual LLM API call
  return items.map(item => {
    if (!item) return item;
    return item.charAt(0).toUpperCase() + item.slice(1).toLowerCase();
  });
}

// Replace original items with converted items in content
function replaceItemsInContent(content, originalItems, convertedItems) {
  let newContent = content;
  for (let i = 0; i < originalItems.length; i++) {
    const original = originalItems[i];
    const converted = convertedItems[i];
    if (original === converted) continue; // no change

    // Escape special regex characters in original string
    const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Replace all occurrences carefully:
    // For frontmatter title: replace only in frontmatter title line
    // For headings: replace in heading lines
    // For highlights: replace inside ** **
    // For bullet definitions: replace only the definition part before colon

    // We'll do a global replace for all occurrences of the original string,
    // but only when it appears in the contexts we extracted.

    // To be safe, replace all exact matches of original string in the content
    // but only whole word matches to avoid partial replacements.

    // Use a regex with word boundaries
    const regex = new RegExp(`\\b${escapedOriginal}\\b`, 'g');

    newContent = newContent.replace(regex, converted);
  }
  return newContent;
}

async function processFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const originalItems = extractItems(content);
    if (originalItems.length === 0) {
      console.log(`No items to rename found in ${filePath}`);
      return;
    }
    const convertedItems = await convertToSentenceCaseWithLLM(originalItems);
    const newContent = replaceItemsInContent(
      content,
      originalItems,
      convertedItems,
    );
    if (newContent !== content) {
      await fs.writeFile(filePath, newContent, 'utf-8');
      console.log(`Updated file: ${filePath}`);
    } else {
      console.log(`No changes needed for ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
  }
}

async function main() {
  console.log('Starting sentence case formatting...');

  // Accept a path argument from command line or default to VAULT_DIR
  const inputPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : VAULT_DIR;

  const isFile = await isMarkdownFile(inputPath);
  let files = [];

  if (isFile) {
    files = [inputPath];
  } else {
    files = await findMarkdownFiles(inputPath);
  }

  for (const file of files) {
    await processFile(file);
  }
  console.log('Sentence case formatting completed.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
