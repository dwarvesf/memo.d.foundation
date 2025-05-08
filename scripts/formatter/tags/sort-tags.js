#!/usr/bin/env node

import fs from 'fs/promises';
import matter from 'gray-matter';
import minimist from 'minimist';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sort tags by priority categories and alphabetically
 */
function sortTagsByPriority(tagsInput, priorities = {}) {
  try {
    const [tags, tag] = Object.values(tagsInput).map(tags => {
      const priorityFields = Object.keys(priorities);
      const priorityGroups = {
        ...priorityFields.reduce((acc, field) => {
          acc[field] = new Set();
          return acc;
        }, {}),
        other: new Set(),
      };

      const priorityMap = new Map();
      Object.entries(priorities).forEach(([category, variants]) => {
        variants.forEach(variant => {
          priorityMap.set(variant, category);
        });
      });

      tags.forEach(tag => {
        const category = priorityMap.get(tag);
        if (category) {
          priorityGroups[category].add(tag);
        } else {
          priorityGroups.other.add(tag);
        }
      });

      const sortedGroups = Object.fromEntries(
        Object.entries(priorityGroups).map(([key, set]) => [
          key,
          Array.from(set).sort((a, b) => a.localeCompare(b)),
        ]),
      );

      return [
        ...priorityFields.flatMap(field => sortedGroups[field]),
        ...sortedGroups.other,
      ];
    });
    return { tags, tag };
  } catch (error) {
    console.error(
      'Error in sortTagsByPriority:',
      error instanceof Error ? error.message : error,
    );
    const [tags, tag] = Object.values(tagsInput).map(tags => {
      return Array.from(new Set(tags)).sort();
    });
    return { tags, tag };
  }
}

/**
 * Process tags in a file using normalization rules
 */
function processTags(tagsInput, normalizedTags) {
  const normalized = normalizedTags.normalized;
  const deprecated = new Set(normalizedTags.deprecated);

  const [tags, tag] = Object.values(tagsInput).map(tags => {
    const result = new Set();
    tags.forEach(tag => {
      // Find normalized form if it exists
      let found = false;
      for (const [normalizedTag, variants] of Object.entries(normalized)) {
        if (tag === normalizedTag || variants.includes(tag)) {
          result.add(normalizedTag);
          found = true;
          break;
        }
      }

      // If no normalization found and not deprecated, keep original
      if (!found && !deprecated.has(tag)) {
        result.add(tag);
      }
    });
    return result;
  });

  return {
    tags: Array.from(tags),
    tag: Array.from(tag),
  };
}

/**
 * Update tags in file content while preserving frontmatter formatting
 */
function updateFileContent(fm, tagsInput) {
  const { data: originalData, content: body, matter: originalFrontmatter } = fm;

  // Get frontmatter content without the delimiters
  const frontmatterContent = originalFrontmatter.trim();
  const frontmatterLines = frontmatterContent.split('\n');
  const newFrontmatterLines = [];

  function handleAddTagsLines(i, labelName) {
    let index = i;
    const originalTagData = originalData[labelName];
    const line = frontmatterLines[index];
    const nextLine = frontmatterLines[index + 1];
    const isArrayTags = Array.isArray(originalTagData);
    const tagIndentation =
      (isArrayTags ? nextLine : line)?.match(/^\s*/)?.[0] ?? '';
    const tagLabelIndentation = line.match(/^\s*/)?.[0] ?? '';

    const newTags = tagsInput[labelName];

    // Determine format and create new tags block
    if (isArrayTags) {
      // Array format
      newFrontmatterLines.push(`${tagLabelIndentation}${labelName}:`);
      newTags.forEach(tag => {
        newFrontmatterLines.push(`${tagIndentation}- ${tag}`);
      });
    } else if (newTags.length > 0) {
      // String format
      const tagsStr = newTags.join(', ');
      newFrontmatterLines.push(
        `${tagLabelIndentation}${labelName}: ${tagsStr}`,
      );
    } else {
      const isNull = originalTagData === null || line.match(/^\s*null/);
      newFrontmatterLines.push(
        `${tagLabelIndentation}${labelName}:${isNull ? ' null' : ''}`,
      );
    }

    // Skip existing tag lines
    while (
      index + 1 < frontmatterLines.length &&
      (frontmatterLines[index + 1].startsWith(' ') ||
        frontmatterLines[index + 1].startsWith('-'))
    ) {
      index++;
    }
    return index;
  }

  // Process each line of the frontmatter
  for (let i = 0; i < frontmatterLines.length; i++) {
    const line = frontmatterLines[i];
    // Check if we're starting a tags block
    if (line.match(/^tags:/)) {
      i = handleAddTagsLines(i, 'tags');
    } else if (line.match(/^tag:/)) {
      i = handleAddTagsLines(i, 'tag');
    } else {
      // Keep non-tag lines as is
      newFrontmatterLines.push(line);
    }
  }

  // Reconstruct the document
  const newContent = `---\n${newFrontmatterLines.join('\n')}\n---\n${body}`;
  return newContent;
}

/**
 * Extract tags from markdown content using gray-matter
 */
function extractTags(data) {
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
    const tags = new Set();
    const tag = new Set();

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
      if (cleaned) addTag(tag, cleaned);
    }

    return {
      tags: Array.from(tags),
      tag: Array.from(tag),
    };
  } catch (error) {
    // Handle parsing errors gracefully
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: Error parsing frontmatter: ${errorMessage}`);
    return { tags: [], tag: [] };
  }
}

/**
 * Main file processing function
 */
async function processFile(filePath, normalizedTags, options) {
  try {
    const content = await fs.readFile(filePath, 'utf8');

    const fm = matter(content);

    if (!fm.data) {
      // No frontmatter, skip
      if (options.verbose) {
        console.log(
          `Skipped ${path.relative(process.cwd(), filePath)} (no frontmatter)`,
        );
      }
      return {
        modified: false,
        file: filePath,
      };
    }
    if (!('tags' in fm.data) && !('tag' in fm.data)) {
      // No tags, skip
      if (options.verbose) {
        console.log(
          `Skipped ${path.relative(process.cwd(), filePath)} (no tags)`,
        );
      }
      return {
        modified: false,
        file: filePath,
      };
    }

    // Extract current tags
    const currentTags = extractTags(fm.data);

    // Process and sort tags
    const processedTags = processTags(currentTags, normalizedTags);
    const sortedTags = sortTagsByPriority(
      processedTags,
      normalizedTags.priority,
    );

    // Generate new content
    const newContent = updateFileContent(fm, sortedTags);

    if (options.verbose) {
      console.log(`\nProcessing ${path.relative(process.cwd(), filePath)}:`);
      console.log('  Before:', currentTags);
      console.log('  After:', sortedTags);
    }

    if (!options.dryRun) {
      await fs.writeFile(filePath, newContent, 'utf8');
    }

    return {
      file: filePath,
      modified: newContent !== content,
    };
  } catch (error) {
    console.error(
      `Error processing file ${filePath}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Scan directory for markdown files
 */
async function scanDirectory(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await scanDirectory(fullPath)));
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Main function
 */
async function main() {
  try {
    // Parse command line arguments
    const argv = minimist(process.argv.slice(2), {
      string: ['input', 'i'],
      boolean: ['dry-run', 'verbose', 'v'],
      alias: {
        i: 'input',
        v: 'verbose',
      },
      default: {
        input: '',
        'dry-run': false,
        verbose: false,
      },
    });

    const targetDir = argv._[0];
    const inputPath = argv.input
      ? path.resolve(process.cwd(), argv.input)
      : path.resolve(__dirname, './tags.json');

    const options = {
      dryRun: argv['dry-run'],
      verbose: argv.verbose,
      inputPath,
    };

    if (!targetDir) {
      console.error('Usage: node sort-tags.js <directory-path> [options]');
      console.error('\nOptions:');
      console.error(
        '  --input, -i     Input normalized tags JSON file (default: ./tags.json)',
      );
      console.error('  --dry-run       Show changes without modifying files');
      console.error(
        '  --verbose, -v   Show detailed information about changes',
      );
      process.exit(1);
    }

    // Load normalized tags
    console.log('Loading tag definitions...');
    const normalizedTagsPath = path.resolve(process.cwd(), options.inputPath);
    const normalizedTags = JSON.parse(
      await fs.readFile(normalizedTagsPath, 'utf8'),
    );

    // Validate input structure
    if (
      !normalizedTags.normalized ||
      !normalizedTags.deprecated ||
      !normalizedTags.priority
    ) {
      throw new Error('Invalid normalized tags file structure');
    }

    // Process files
    console.log('Scanning files...');
    const files = await scanDirectory(targetDir);
    console.log(`Found ${files.length} files to process...`);

    const results = {
      processed: 0,
      modified: 0,
      errors: 0,
      skipped: 0,
    };

    for (const file of files) {
      try {
        const result = await processFile(file, normalizedTags, options);

        if (result) {
          results.processed++;
          if (result.modified) {
            results.modified++;
            if (options.verbose) {
              console.log(`Modified ${path.relative(process.cwd(), file)}`);
            }
          } else {
            results.skipped++;
            if (options.verbose) {
              console.log(
                `Skipped ${path.relative(process.cwd(), file)} (no changes needed)`,
              );
            }
          }
        } else {
          results.errors++;
          console.error(
            `Failed to process ${path.relative(process.cwd(), file)}`,
          );
        }
      } catch (error) {
        results.errors++;
        console.error(
          `Error processing ${path.relative(process.cwd(), file)}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    // Print summary
    console.log('\nProcessing complete:');
    console.log(`- Files processed: ${results.processed}`);
    console.log(`- Files modified: ${results.modified}`);
    console.log(`- Files skipped: ${results.skipped}`);
    console.log(`- Errors: ${results.errors}`);

    if (options.dryRun) {
      console.log('\nNote: No files were modified (dry run)');
    }
  } catch (error) {
    // Handle errors gracefully
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Fatal Error]: ', errorMessage);
    process.exit(1);
  }
}

// Run the script
main();
