import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import crypto from 'crypto';
import minimist from 'minimist';

const VAULT_PATH = path.join(process.cwd(), 'vault');
const ALIAS_PREFIX = '/';
const ALIAS_LENGTH = 7; // Length of the alias to generate
const ALIAS_RANDOM_BYTES = 4; // Number of random bytes to generate for alias
const ALIAS_MAX_RANDOM_BYTES = 20; // Maximum bytes to generate for alias

interface RedirectsMap {
  [alias: string]: string;
}

/**
 * Recursively find all markdown/mdx files in a directory
 */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  let files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '.git') {
        const subFiles = await findMarkdownFiles(fullPath);
        files = files.concat(subFiles);
      }
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalizeRandomAlias(alias: string): string {
  return alias.replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Generate a random short alias string of 6-8 characters
 */
function generateRandomAlias(): string {
  const randomBytes = crypto.randomBytes(ALIAS_RANDOM_BYTES);
  let base64 = randomBytes.toString('base64');
  // Remove non-alphanumeric characters
  let alphanumericAlias = normalizeRandomAlias(base64);
  let bytesNeeded = ALIAS_RANDOM_BYTES;
  
  // Ensure the alias is long enough, if not, generate more bytes
  while (alphanumericAlias.length < 6) {
    const bytesToGenerate = Math.min(bytesNeeded, ALIAS_MAX_RANDOM_BYTES);
    base64 = crypto.randomBytes(bytesToGenerate).toString('base64');
    alphanumericAlias = normalizeRandomAlias(base64);
    bytesNeeded++;
  }
  
  return alphanumericAlias.slice(0, ALIAS_LENGTH);
}

/**
 * Format a file path to a URL path starting with '/'
 * Remove vault prefix and file extension
 */
function formatFilePathToUrl(filePath: string): string {
  const relativePath = path.relative(VAULT_PATH, filePath);
  const noExt = relativePath.replace(/\.mdx?$/, '');
  // Use forward slashes for URLs
  return '/' + noExt.split(path.sep).join('/');
}

async function getInitialGeneratedAlias(): Promise<string[]> {
  const files = await findMarkdownFiles(VAULT_PATH);
  const aliases: string[] = [];
  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const { data: frontmatter } = matter(content);
      if (frontmatter.redirect && Array.isArray(frontmatter.redirect)) {
        for (const aliasRaw of frontmatter.redirect) {
          if (typeof aliasRaw === 'string') {
            aliases.push(aliasRaw);
          }
        }
      }
    } catch (error) {
      // console.error(`Error reading file ${file}:`, error);
    }
  }
  return aliases;
}

/**
 * Generates and manages redirects from frontmatter in markdown files.
 *
 * This function scans markdown files, processes their frontmatter,
 * and performs the following operations:
 *
 * - For files with existing 'redirect' arrays in frontmatter: validates and tracks aliases
 * - For files without redirects: generates a random alias with prefix, adds it to the frontmatter,
 *   and records it in the redirects map
 *
 * The function preserves formatting when updating frontmatter and maintains a registry
 * of used aliases to prevent duplicates.
 *
 * @remarks
 * Command line usage:
 * - `node script.js --path=<targetPath>` to scan a directory
 * - `node script.js --files=<file1>,<file2>,...` to process specific files
 *
 * @throws Will exit process with code 1 if no valid input is provided
 * @throws Logs errors for files that cannot be processed but continues execution
 *
 * @example
 * ```
 * await generateRedirectsFromFrontmatter();
 * // When called with: node script.js --path=./content/posts
 * // Or: node script.js --files=./content/post1.md,./content/post2.md
 * ```
 */
async function generateRedirectsFromFrontmatter() {
  const argv = minimist(process.argv.slice(2));

  let files: string[] = [];

  // Handle target path
  if (argv.path || argv._[0]) {
    const targetPath = argv.path || argv._[0];
    files = await findMarkdownFiles(targetPath);
  }
  // Handle list of files
  else if (argv.files) {
    const filesListInput =
      typeof argv.files === 'string' ? argv.files.split(',') : argv.files;
    const filesList = Array.isArray(filesListInput)
      ? filesListInput
      : [filesListInput];
    files = filesList.map(f => path.resolve(f));

    // Validate files exist and are markdown
    for (const file of files) {
      try {
        const stat = await fs.stat(file);
        if (
          !stat.isFile() ||
          (!file.endsWith('.md') && !file.endsWith('.mdx'))
        ) {
          console.warn(`Warning: ${file} is not a markdown file, skipping.`);
        }
      } catch (error) {
        console.warn(`Warning: Could not access file ${file}, skipping.`);
      }
    }

    // Filter out invalid files
    files = files.filter(file => file.endsWith('.md') || file.endsWith('.mdx'));
  }

  if (files.length === 0) {
    console.error('Please provide a valid target path or list of files.');
    process.exit(1);
  }

  const initialUsedAliases = await getInitialGeneratedAlias();

  const redirects: RedirectsMap = {};

  // Map to track used aliases to detect duplicates
  const usedAliases = new Set<string>(initialUsedAliases);

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const { data: frontmatter } = matter(content);

      const canonicalPath = formatFilePathToUrl(file);

      // If frontmatter has redirect property and is array
      if (frontmatter.redirect && Array.isArray(frontmatter.redirect)) {
        for (const aliasRaw of frontmatter.redirect) {
          if (typeof aliasRaw === 'string') {
            const alias = aliasRaw.startsWith('/') ? aliasRaw : '/' + aliasRaw;
            if (usedAliases.has(alias)) {
              console.warn(
                `Duplicate alias detected: ${alias} in file ${file}. Skipping.`,
              );
            } else {
              usedAliases.add(alias);
            }
          }
        }
      } else {
        // No redirect property, generate a random alias
        let alias: string;
        do {
          alias = ALIAS_PREFIX + generateRandomAlias();
        } while (usedAliases.has(alias));
        redirects[alias] = canonicalPath;
        usedAliases.add(alias);

        // Update the file frontmatter to add the generated alias
        // Read original content again to preserve formatting
        const originalContent = await fs.readFile(file, 'utf-8');
        const parsed = matter(originalContent);
        const newRedirects = [alias];
        if (parsed.data.redirect && Array.isArray(parsed.data.redirect)) {
          newRedirects.push(...parsed.data.redirect);
        }

        // Helper function to update redirect property in frontmatter preserving formatting
        function updateRedirectFrontmatter(
          content: string,
          newRedirects: string[],
        ): string {
          const lines = content.split('\n');
          let inFrontmatter = false;
          let frontmatterStart = -1;
          let frontmatterEnd = -1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === '---') {
              if (!inFrontmatter) {
                inFrontmatter = true;
                frontmatterStart = i;
              } else {
                frontmatterEnd = i;
                break;
              }
            }
          }
          if (frontmatterStart === -1 || frontmatterEnd === -1) {
            // No frontmatter found, return original content
            return content;
          }

          // Extract frontmatter lines
          const fmLines = lines.slice(frontmatterStart + 1, frontmatterEnd);

          // Find redirect property lines
          let redirectStart = -1;
          let redirectEnd = -1;
          for (let i = 0; i < fmLines.length; i++) {
            if (fmLines[i].match(/^redirect:/)) {
              redirectStart = i;
              // Find end of redirect block (next non-indented line or end)
              for (let j = i + 1; j < fmLines.length; j++) {
                if (!fmLines[j].match(/^\s+-\s+/)) {
                  redirectEnd = j - 1;
                  break;
                }
              }
              if (redirectEnd === -1) {
                redirectEnd = fmLines.length - 1;
              }
              break;
            }
          }

          // Determine indentation
          const indent =
            redirectStart !== -1
              ? (fmLines[redirectStart].match(/^(\s*)/)?.[1] ?? '')
              : '';

          // Build new redirect block lines
          const newRedirectLines = [];
          if (newRedirects.length === 0) {
            newRedirectLines.push(`${indent}redirect: []`);
          } else {
            newRedirectLines.push(`${indent}redirect:`);
            const itemIndent = indent + '  ';
            for (const alias of newRedirects) {
              newRedirectLines.push(`${itemIndent}- ${alias}`);
            }
          }

          // Replace or insert redirect block
          let newFmLines;
          if (redirectStart !== -1) {
            newFmLines = [
              ...fmLines.slice(0, redirectStart),
              ...newRedirectLines,
              ...fmLines.slice(redirectEnd + 1),
            ];
          } else {
            // Insert redirect block at the end of frontmatter
            newFmLines = [...fmLines, ...newRedirectLines];
          }

          // Rebuild content
          const newLines = [
            ...lines.slice(0, frontmatterStart + 1),
            ...newFmLines,
            ...lines.slice(frontmatterEnd),
          ];

          return newLines.join('\n');
        }

        const newContent = updateRedirectFrontmatter(
          originalContent,
          newRedirects,
        );

        await fs.writeFile(file, newContent, 'utf-8');
        console.log(`Added redirect alias ${alias} to ${file}`);
      }
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
    }
  }

  console.log('Shorten alias generated: ', Object.keys(redirects).length);
}

generateRedirectsFromFrontmatter();
