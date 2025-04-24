/**
 * Usage: OPENAI_API_KEY=xxx node fill-title.js /path/to/dir
 *
 * Set the OPENAI_API_KEY environment variable in your shell or prefix the command.
 */

import fs from 'fs/promises';
import path from 'path';

const fetch = globalThis.fetch || (await import('node-fetch')).default;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4.1-mini';

if (!OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is not set. Set it in your shell or in a .env file.');
  process.exit(1);
}

if (process.argv.length < 3) {
  console.error('Usage: OPENAI_API_KEY=xxx node fill-title.js /path/to/dir');
  process.exit(1);
}

const rootDir = process.argv[2];

// Simple frontmatter parser: returns { data: {key: value}, content: string }
function parseFrontmatter(fileContent) {
  if (!fileContent.startsWith('---')) {
    return { data: {}, content: fileContent };
  }
  const parts = fileContent.split('---');
  if (parts.length < 3) {
    return { data: {}, content: fileContent };
  }
  const rawFrontmatter = parts[1].trim();
  const content = parts.slice(2).join('---').trimStart();

  const data = {};
  const lines = rawFrontmatter.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();
    // Remove surrounding quotes if any
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, content };
}

// Simple frontmatter stringifier: given data object and content string, returns full file content
function stringifyFrontmatter(data, content) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(data)) {
    // Quote value if it contains special characters or spaces
    let val = value;
    if (typeof val === 'string' && (val.includes(':') || val.includes('"') || val.includes("'") || val.includes(' '))) {
      val = `"${val.replace(/"/g, '\\"')}"`;
    }
    lines.push(`${key}: ${val}`);
  }
  lines.push('---\n');
  lines.push(content);
  return lines.join('\n');
}

async function findMarkdownFiles(dir) {
  let results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(await findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

function hyphenToSpace(str) {
  return str.replace(/-/g, ' ').replace(/\.md$/, '');
}

function getRecommendedTitle(filePath) {
  const base = path.basename(filePath, '.md');
  return hyphenToSpace(base);
}

async function getFilesWithEmptyTitle(files) {
  const map = {};
  for (const file of files) {
    try {
      const raw = await fs.readFile(file, 'utf8');
      const { data } = parseFrontmatter(raw);
      const title = data.title;
      if (
        title === undefined ||
        title === null ||
        title === 'null' ||
        (typeof title === 'string' && title.trim() === '')
      ) {
        map[file] = getRecommendedTitle(file);
      }
    } catch (err) {
      console.error(`❌ Failed to read/parse: ${file} - ${err.message}`);
    }
  }
  return map;
}

const PROMPT = `
You are an expert at formatting titles. Given a list of titles (each is a short phrase, not a sentence), convert each to sentence case.
- Only capitalize the first word and proper nouns (like Google, JavaScript, etc).
- Do not add punctuation.
- Return the result as a JSON array of strings, in the same order as input.
- Do not include any extra text, explanation, or formatting.

Input: ["hello world", "how google works"]
Output: ["Hello world", "How Google works"]
`;

async function convertTitlesToSentenceCase(titles) {
  // Fallback: if function_call does not work as expected, use prompt completion and parse JSON array from text
  const userPrompt = `Convert the following titles to sentence case:\n${JSON.stringify(titles)}\nReturn only a JSON array of strings.`;
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 3000,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
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

async function updateFileTitle(filePath, newTitle) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const { data, content } = parseFrontmatter(raw);
    data.title = newTitle;
    const newRaw = stringifyFrontmatter(data, content);
    await fs.writeFile(filePath, newRaw, 'utf8');
    console.log(`✅ Updated title: ${filePath}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to update: ${filePath} - ${err.message}`);
    return false;
  }
}

async function main() {
  try {
    const files = await findMarkdownFiles(rootDir);
    if (files.length === 0) {
      console.log('No markdown files found.');
      return;
    }

    const fileToTitleMap = await getFilesWithEmptyTitle(files);
    const filePaths = Object.keys(fileToTitleMap);
    if (filePaths.length === 0) {
      console.log('No markdown files with empty title found.');
      return;
    }

    const recommendedTitles = filePaths.map(f => fileToTitleMap[f]);
    let sentenceCaseTitles;
    try {
      console.log(recommendedTitles)
      sentenceCaseTitles = await convertTitlesToSentenceCase(recommendedTitles);
      console.log(sentenceCaseTitles)
    } catch (err) {
      console.error('❌ OpenAI API failed:', err.message);
      return;
    }

    let updatedCount = 0;
    for (let i = 0; i < filePaths.length; i++) {
      const file = filePaths[i];
      const newTitle = sentenceCaseTitles[i];
      const updated = await updateFileTitle(file, newTitle);
      if (updated) updatedCount++;
    }
    console.log(`\nProcess completed. ${updatedCount} file(s) updated out of ${filePaths.length}.`);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
