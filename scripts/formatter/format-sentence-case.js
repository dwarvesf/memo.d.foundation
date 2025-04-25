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
const BULLET_DEFINITION_REGEX = /^\s*(?:[-*]|\d+\.)\s+\*\*(.+?)\*\*:/gm;
// New regex for markdown links [text](url)
const MARKDOWN_LINK_REGEX = /^-\s+\[([^\]]+)\]\([^)]+\)/gm;

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

function extractItems(content) {
  // Remove code blocks to avoid matching inside them
  const contentWithoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '');

  const items = new Set();

  // Extract frontmatter title
  const frontmatterMatch = contentWithoutCodeBlocks.match(
    /^---\n([\s\S]+?)\n---/,
  );
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const titleMatch = frontmatter.match(FRONTMATTER_TITLE_REGEX);
    if (titleMatch) {
      items.add(titleMatch[1]);
    }
  }

  // Extract headings
  let match;
  while ((match = HEADING_REGEX.exec(contentWithoutCodeBlocks)) !== null) {
    items.add(match[2].trim());
  }

  // Extract bullet point definitions "- hello world: message"
  while (
    (match = BULLET_DEFINITION_REGEX.exec(contentWithoutCodeBlocks)) !== null
  ) {
    items.add(match[1].trim());
  }

  // Extract markdown link texts [text](url)
  while (
    (match = MARKDOWN_LINK_REGEX.exec(contentWithoutCodeBlocks)) !== null
  ) {
    items.add(match[1].trim());
  }

  // Extract markdown link texts [text](url)
  while ((match = MARKDOWN_LINK_REGEX.exec(content)) !== null) {
    items.add(match[1].trim());
  }

  return Array.from(items);
}

if (typeof fetch === 'undefined') {
  // For Node.js versions < 18, fetch is not available globally
  // Use dynamic import of node-fetch only if needed
  import('node-fetch').then(({ default: fetch }) => {
    global.fetch = fetch;
  });
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4.1-mini';

if (!OPENAI_API_KEY) {
  console.error(
    'Error: OPENAI_API_KEY environment variable is not set. Set it in your shell or in a .env file.',
  );
  process.exit(1);
}

// Function to call OpenAI API to convert array of strings to sentence case
async function convertToSentenceCaseWithLLM(items) {
  const PROMPT = `
You are an expert at formatting titles. Given a list of titles (each is a short phrase, not a sentence):
- Convert each to SENTENCE CASE
- Keep the proper nouns, acronyms and short forms as standard (like Google, JavaScript, Golang, HOC etc).
- DO NOT remove any words, characters (e.g do not remove colon in "TL;DR: Speedrunning MCP auth with SSE transport") or add any extra text, explanation, or formatting
- DO NOT add punctuation.
- Return the result as a JSON array of strings, in the same order as input.

Input: ${JSON.stringify(items)}
Output:
`;

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: PROMPT }],
      max_tokens: 3000,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('No output from OpenAI.');

  // Try to parse the JSON array from the response
  let arr;
  try {
    arr = JSON.parse(content);
    if (!Array.isArray(arr)) throw new Error('Not an array');
  } catch {
    throw new Error('Failed to parse OpenAI output as JSON array: ' + content);
  }
  return arr;
}

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
    // For markdown links: replace only the text inside square brackets

    // We'll do a global replace for all occurrences of the original string,
    // but only when it appears in the contexts we extracted.

    // To be safe, replace all exact matches of original string in the content
    // but only whole word matches to avoid partial replacements.

    // Special handling for markdown links
    // Replace [original] with [converted] but keep the URL intact
    const markdownLinkRegex = new RegExp(
      `\\[${escapedOriginal}\\](\\([^\\)]+\\))`,
      'g',
    );
    newContent = newContent.replace(markdownLinkRegex, `[${converted}]$1`);

    // Use a regex with word boundaries for other replacements
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
      console.log(`✅ Updated file: ${filePath}`);
    } else {
      console.log(`👍 No changes needed for ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error processing file ${filePath}:`, error);
  }
}

async function main() {
  console.log('➡️ Starting sentence case formatting...');

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
  console.log('🔥 Sentence case formatting completed.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
