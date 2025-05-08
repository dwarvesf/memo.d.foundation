#!/usr/bin/env node

/**
 * sync-author.js
 *
 * This script synchronizes author aliases in markdown files' frontmatter
 * with the main author keys defined in author.json.
 *
 * Usage:
 *   node sync-author.js /path/to/markdown/folder
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import yaml from 'js-yaml';

// Load and flatten author.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authorJsonPath = path.resolve(__dirname, './author.json');
let authorDataRaw;
try {
  authorDataRaw = fs.readFileSync(authorJsonPath, 'utf-8');
} catch (err) {
  console.error(`Error reading author.json at ${authorJsonPath}:`, err);
  process.exit(1);
}

let authorData;
try {
  authorData = JSON.parse(authorDataRaw);
} catch (err) {
  console.error('Error parsing author.json:', err);
  process.exit(1);
}

// Flatten author dictionary: alias -> main author
const aliasToAuthor = {};
for (const [mainAuthor, aliases] of Object.entries(authorData)) {
  // Map main author to itself
  aliasToAuthor[mainAuthor] = mainAuthor;
  for (const alias of aliases) {
    aliasToAuthor[alias] = mainAuthor;
  }
}

// Helper: Recursively find markdown files in a directory
function findMarkdownFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const dirent of list) {
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      results = results.concat(findMarkdownFiles(fullPath));
    } else if (dirent.isFile() && fullPath.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

// Process a single markdown file
function processFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error(`Failed to read file ${filePath}:`, err);
    return;
  }

  let fm;
  try {
    fm = matter(content);
  } catch (err) {
    console.error(`Failed to parse frontmatter in ${filePath}:`, err);
    return;
  }

  if (!fm.data) {
    // No frontmatter
    return;
  }

  // Check if author or authors field exists
  if (!('author' in fm.data) && !('authors' in fm.data)) {
    // No author info, skip
    return;
  }

  let changed = false;

  // Normalize authors field to array for processing
  if ('author' in fm.data) {
    const authorVal = fm.data.author;
    if (typeof authorVal === 'string') {
      if (
        authorVal in aliasToAuthor &&
        aliasToAuthor[authorVal] !== authorVal
      ) {
        fm.data.author = aliasToAuthor[authorVal];
        changed = true;
        console.log(
          `File: ${filePath} - Replaced author "${authorVal}" with "${fm.data.author}"`,
        );
      }
    }
  }

  if ('authors' in fm.data) {
    let authorsVal = fm.data.authors;
    if (!Array.isArray(authorsVal)) {
      // If authors is a string, convert to array
      if (typeof authorsVal === 'string') {
        authorsVal = [authorsVal];
      } else {
        // Unexpected type, skip
        return;
      }
    }
    const newAuthors = authorsVal.map(a => {
      if (a in aliasToAuthor && aliasToAuthor[a] !== a) {
        changed = true;
        console.log(
          `File: ${filePath} - Replaced author "${a}" with "${aliasToAuthor[a]}"`,
        );
        return aliasToAuthor[a];
      }
      return a;
    });
    if (changed) {
      fm.data.authors = newAuthors;
    }
  }

  if (changed) {
    // Write back updated content preserving other frontmatter fields formatting
    // Get original frontmatter string
    const originalFrontmatter = fm.matter;
    // Convert updated authors field to YAML string
    let updatedAuthorsYaml = '';
    if ('authors' in fm.data) {
      updatedAuthorsYaml = yaml.dump({ authors: fm.data.authors }).trim();
    } else if ('author' in fm.data) {
      updatedAuthorsYaml = yaml.dump({ author: fm.data.author }).trim();
    }
    // Replace authors or author field in original frontmatter string
    const frontmatterLines = originalFrontmatter.split('\n');
    let newFrontmatterLines = [];
    for (let i = 0; i < frontmatterLines.length; i++) {
      const line = frontmatterLines[i];
      if (line.match(/^authors?:/)) {
        // Skip existing authors/author lines
        // Insert updated authors yaml lines instead
        const updatedLines = updatedAuthorsYaml.split('\n');
        newFrontmatterLines.push(...updatedLines);
        // Skip lines until next field or end of frontmatter
        i++;
        while (
          i < frontmatterLines.length &&
          (frontmatterLines[i].startsWith(' ') ||
            frontmatterLines[i].startsWith('-'))
        ) {
          i++;
        }
        i--;
      } else {
        newFrontmatterLines.push(line);
      }
    }
    const newFrontmatter = newFrontmatterLines.join('\n');
    const newContent = `---${newFrontmatter}\n---\n${fm.content}`;
    try {
      fs.writeFileSync(filePath, newContent, 'utf-8');
    } catch (err) {
      console.error(`Failed to write updated file ${filePath}:`, err);
    }
  }
}

// Main
function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Please provide a folder path as argument.');
    process.exit(1);
  }
  const folderPath = path.resolve(args[0]);
  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    console.error(`Provided path is not a valid directory: ${folderPath}`);
    process.exit(1);
  }

  console.log(`Loading author aliases from ${authorJsonPath}`);
  console.log(`Processing markdown files in folder: ${folderPath}`);

  const mdFiles = findMarkdownFiles(folderPath);
  console.log(`Found ${mdFiles.length} markdown files.`);

  for (const file of mdFiles) {
    processFile(file);
  }

  console.log('Author synchronization completed.');
}

main();
