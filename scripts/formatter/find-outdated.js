import fs from 'fs/promises';
import path from 'path';

const fetch = globalThis.fetch || (await import('node-fetch')).default;

const OPENAI_API_KEY = process.env.OPEN_AI_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4.1-mini';

if (!OPENAI_API_KEY) {
  console.error('Error: OPEN_AI_KEY environment variable is not set.');
  process.exit(1);
}

const promptChecklist = `Checklist for Identifying Outdated Tech Content in the Age of AI/LLMs
Use this checklist to evaluate your technical memos and determine if they contain content that may be considered less relevant or outdated due to advancements in AI and LLMs.
Mark each item that applies to the content being reviewed:
[ ] Focus on Manual Execution of Automatable Tasks: Does the content primarily detail step-by-step manual procedures for tasks that can now be significantly automated or handled by AI/AI-powered tools (e.g., basic configuration, repetitive coding tasks, simple data processing)?
[ ] Reliance on Static Information Easily Retrieved by AI: Does the content mainly consist of factual information (syntax, commands, basic definitions) that can be easily and accurately retrieved through a simple query to an LLM or search engine?
[ ] Basic Explanations of Widely Understood Concepts (without deeper insight): Does the content offer only basic, introductory explanations of common technologies or concepts without providing unique perspectives, practical applications, advanced nuances, or critical analysis?
[ ] Emphasis on Skills Primarily Replaced by AI Capabilities: Does the content focus on developing skills (like writing boilerplate code or simple data entry automation) that AI now performs more effectively or efficiently?
[ ] Troubleshooting Based on Exhaustive, Static Lists: Does the content provide troubleshooting guides that rely on long, static lists of potential issues and generic solutions, rather than guiding dynamic diagnosis or leveraging diagnostic tools (potentially AI-powered)?
[ ] Content Lacking Analysis, Synthesis, or Critical Thinking: Does the content primarily present information without offering analysis, synthesizing information from multiple sources, providing critical evaluations, exploring complex trade-offs, or offering strategic insights?
[ ] Outdated Tool-Specific Knowledge (when newer, AI-integrated tools exist): Does the content focus on using older versions of tools, or tools that have been largely superseded by newer ones with significant AI integration and enhanced capabilities?
Outcome:
If any of the items above are checked, the content is considered outdated. Return: yes
If none of the items above are checked, the content is considered not outdated. Return: no`;

async function findMarkdownFiles(dir) {
  let results = [];
  const list = await fs.readdir(dir, { withFileTypes: true });
  for (const file of list) {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      const res = await findMarkdownFiles(filePath);
      results = results.concat(res);
    } else if (file.isFile() && file.name.endsWith('.md')) {
      results.push(filePath);
    }
  }
  return results;
}

async function isContentOutdated(content, filePath) {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are an assistant that evaluates if technical content is outdated based on a checklist.' },
        { role: 'user', content: promptChecklist + '\n\nContent:\n' + content }
      ],
      max_tokens: 4000,
      temperature: 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const result = data.choices?.[0]?.message?.content?.trim().toLowerCase();
  if (result.endsWith('yes')) {
    console.log(`
      ❌ ${filePath} has outdated content
      ${data.choices?.[0]?.message?.content}
      `

    )
    return true;
  } else if (result.endsWith('no')) {
    return false;
  } else {
    console.warn('Unexpected response from OpenAI:', result);
    return false;
  }
}

async function main() {
  const targetPath = process.argv[2];
  if (!targetPath) {
    console.error('Usage: OPEN_AI_KEY=xxx node find-outdated.js <path>');
    process.exit(1);
  }

  const absolutePath = path.resolve(targetPath);
  let markdownFiles = [];
  try {
    markdownFiles = await findMarkdownFiles(absolutePath);
  } catch (err) {
    console.error('Error reading directory:', err);
    process.exit(1);
  }

  if (markdownFiles.length === 0) {
    console.log('No markdown files found in the specified path.');
    return;
  }

  const outdatedFiles = [];

  for (const filePath of markdownFiles) {
    let content = '';
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (err) {
      console.error(`Failed to read file ${filePath}:`, err);
      continue;
    }

    let outdated = false;
    try {
      outdated = await isContentOutdated(content, filePath);
    } catch (err) {
      console.error(`OpenAI API error for file ${filePath}:`, err);
      continue;
    }

    if (outdated) {
      outdatedFiles.push(filePath);
    }
  }

  if (outdatedFiles.length > 0) {
    console.log('Outdated markdown files:');
    outdatedFiles.forEach((file) => console.log(file));
  } else {
    console.log('No outdated markdown files found.');
  }
}

main();
