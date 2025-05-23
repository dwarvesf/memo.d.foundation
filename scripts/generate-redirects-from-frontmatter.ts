import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import crypto from 'crypto';
import minimist from 'minimist';

const VAULT_PATH = path.join(process.cwd(), 'vault');

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

/**
 * Generate a random short alias string of 6-8 characters
 */
function generateRandomAlias(): string {
  // Generate 4 random bytes and convert to base64url string, then take 6-8 chars
  const randomBytes = crypto.randomBytes(4);
  const base64url = randomBytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return base64url.slice(0, 7); // 7 chars for balance
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

/**
 * Main function to generate redirects map from frontmatter
 */
async function generateRedirectsFromFrontmatter() {
  const argv = minimist(process.argv.slice(2));

  const targetPath = argv._[0];

  if (!targetPath) {
    console.error('Please provide a target path to scan for markdown files.');
    process.exit(1);
  }

  const redirects: RedirectsMap = {};

  const files = await findMarkdownFiles(targetPath);

  // Map to track used aliases to detect duplicates
  const usedAliases = new Set<string>();

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
          alias = '/s/' + generateRandomAlias();
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
