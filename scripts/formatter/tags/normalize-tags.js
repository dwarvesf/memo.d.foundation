#!/usr/bin/env node

import fs from 'fs/promises';
import matter from 'gray-matter';
import minimist from 'minimist';
import path from 'path';
import { fileURLToPath } from 'url';
import { generatePriorityCategories, processTags } from './analyze-tags.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extract tags from markdown content using gray-matter
 */
function extractTags(content) {
  function addTag(tags, data) {
    const arrayTags = data.split(/[,\n]/);
    if (arrayTags.length > 1) {
      arrayTags.forEach(tag => {
        const cleaned = tag.trim();
        if (cleaned) tags.add(cleaned);
      });
    } else {
      const cleaned = String(data).trim();
      if (cleaned) tags.add(cleaned);
    }
  }

  try {
    const { data } = matter(content);
    const tags = new Set();

    // Handle different possible tag formats in frontmatter
    if (Array.isArray(data.tags)) {
      data.tags.forEach(tag => {
        const cleaned = String(tag).trim();
        if (cleaned) addTag(tags, cleaned);
      });
    } else if (typeof data.tags === 'string') {
      data.tags.split(/[,\n]/).forEach(tag => {
        const cleaned = tag.trim();
        if (cleaned) addTag(tags, cleaned);
      });
    }

    // Also check for singular 'tag' field
    if (data.tag) {
      const cleaned = String(data.tag).trim();
      if (cleaned) addTag(tags, cleaned);
    }

    return Array.from(tags);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.warn(`Warning: Error parsing frontmatter:`, errorMessage);
    return [];
  }
}

/**
 * Process a markdown file
 */
async function processFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return extractTags(content);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error processing file ${filePath}:`, errorMessage);
    return [];
  }
}

/**
 * Recursively scan directory for markdown files
 */
async function scanDirectory(dir, tagMap = {}) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await scanDirectory(fullPath, tagMap);
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
        const tags = await processFile(fullPath);
        tags.forEach(tag => {
          if (!tagMap[tag]) tagMap[tag] = new Set();
          tagMap[tag].add(fullPath);
        });
      }
    }

    return tagMap;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error scanning directory ${dir}:`, errorMessage);
    return tagMap;
  }
}

function sortTags(keyedTags) {
  const keyedSorted = Object.keys(keyedTags).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
  const sortedTags = {};
  for (const key of keyedSorted) {
    const files = Array.from(keyedTags[key] ?? []);
    sortedTags[key] = files.sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
  }
  return sortedTags;
}

async function processAndGenerateOutput(tagMap, outputPath) {
  try {
    // Process tags with OpenAI
    console.log('Analyzing tags...');
    const { normalized = {}, deprecated = [] } = await processTags(tagMap);

    console.log('Sorting tags...');
    const sortedNormalized = sortTags(normalized);
    const sortedDeprecated = sortTags({ deprecated }).deprecated;

    // Generate priority categories
    console.log('Generating priority categories...');
    const priority = await generatePriorityCategories(sortedNormalized);

    const output = {
      normalized: sortedNormalized,
      deprecated: sortedDeprecated,
      priority,
    };

    // Write output file
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(
      `Tags normalized and saved to ${path.relative(process.cwd(), outputPath)}`,
    );

    return output;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing tags:', errorMessage);
    throw error;
  }
}

async function main() {
  try {
    // Parse command line arguments
    const argv = minimist(process.argv.slice(2), {
      string: ['output', 'o'],
      alias: { o: 'output' },
    });

    const targetDir = argv._[0];
    const outputPath = argv.output
      ? path.resolve(process.cwd(), argv.output)
      : path.resolve(__dirname, './tags.json');

    if (!targetDir) {
      console.error(
        'Usage: node normalize-tags.js <directory-path> [--output <file-path>]',
      );
      console.error('\nOptions:');
      console.error(
        '  --output, -o    Output file path (default: ./tags.json)',
      );
      process.exit(1);
    }

    // Scan directory and collect tags
    console.log('Scanning files...');
    const tagMap = await scanDirectory(targetDir);

    // Process and generate output
    await processAndGenerateOutput(tagMap, outputPath);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', errorMessage);
    process.exit(1);
  }
}

// Run the script
main();
