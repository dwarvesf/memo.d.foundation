/**
 * rename-files-to-hyphen-case.js
 *
 * Recursively renames all .md files in a given directory (and its subdirectories) to lowercase hyphen-case using `git mv`.
 *
 * Input:
 *   - base path: The root directory to start searching for .md files. All subfolders will be included.
 *
 * Output:
 *   - For each .md file found, if its name is not already in lowercase hyphen-case, it will be renamed using `git mv`.
 *   - Logs each rename operation:
 *       :white_check_mark: <old path> → <new path>   (success)
 *       :x: <old path> → <new path> (<error message>) (failure)
 *   - Files already in the correct format are skipped.
 *
 * Example usage:
 *   node rename-files-to-hyphen-case.js ./vault/playground/notes
 *
 *   This will rename all .md files under ./vault/playground/notes and its subfolders to lowercase hyphen-case.
 */

import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";

async function findMarkdownFiles(dir) {
  let results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(await findMarkdownFiles(fullPath));
    } else if (
      entry.isFile() &&
      path.extname(entry.name).toLowerCase() === '.md'
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

function toHyphenCase(filename) {
  // Remove extension, convert to lowercase, replace non-alphanumerics/spaces with hyphens, collapse multiple hyphens
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  return (
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + ext
  );
}

function gitMv(oldPath, newPath) {
  return new Promise((resolve) => {
    exec(`git mv "${oldPath}" "${newPath}"`, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
      } else {
        resolve({ success: true });
      }
    });
  });
}

async function main() {
  const basePath = process.argv[2];
  if (!basePath) {
    console.error('Usage: node rename-files-to-hyphen-case.js <base-path>');
    process.exit(1);
  }

  const absBasePath = path.resolve(basePath);
  let files;
  try {
    files = await findMarkdownFiles(absBasePath);
  } catch (err) {
    console.error(`Failed to read directory: ${err.message}`);
    process.exit(1);
  }

  // First pass: perform renames and build a map of old relative paths to new relative paths
  const renameMap = new Map(); // key: old absolute path, value: new absolute path

  for (const file of files) {
    const dir = path.dirname(file);
    const origName = path.basename(file);
    const baseName = path.basename(origName, path.extname(origName));
    // Skip files starting with §, ¶, or ≈
    if (/^[§¶≈]/.test(baseName)) {
      continue;
    }
    const newName = toHyphenCase(origName);
    if (origName === newName) {
      // Already hyphen-case, skip
      continue;
    }
    const newPath = path.join(dir, newName);
    try {
      const { success, error } = await gitMv(file, newPath);
      if (success) {
        console.log(`:white_check_mark: ${file} → ${newPath}`);
        renameMap.set(file, newPath);
      } else {
        console.log(`:x: ${file} → ${newPath} (${error.trim()})`);
      }
    } catch (err) {
      console.log(`:x: ${file} → ${newPath} (${err.message})`);
    }
  }

  // Second pass: update links in all .md files if they point to a renamed file
  if (renameMap.size > 0) {
    // Build a map of old relative paths to new relative paths (relative to each .md file's directory)
    const allMdFiles = await findMarkdownFiles(absBasePath);
    for (const mdFile of allMdFiles) {
      let content = await fs.readFile(mdFile, "utf8");
      let updated = false;
      for (const [oldAbs, newAbs] of renameMap.entries()) {
        // Compute relative paths from the current mdFile's directory
        const mdDir = path.dirname(mdFile);
        const oldRel = path.relative(mdDir, oldAbs);
        const newRel = path.relative(mdDir, newAbs);

        // Escape special regex characters in oldRel for safe replacement
        const oldRelEscaped = oldRel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Replace markdown links: [text](oldRel)
        const linkRegex = new RegExp(`(\\[[^\\]]*\\]\\()${oldRelEscaped}(\\))`, "g");
        if (linkRegex.test(content)) {
          content = content.replace(linkRegex, `$1${newRel}$2`);
          updated = true;
        }
      }
      if (updated) {
        await fs.writeFile(mdFile, content, "utf8");
        console.log(`:white_check_mark: Updated links in ${mdFile}`);
      }
    }
  }
}

await main();
