/**
 * This script performs the following operations:
 *
 * 1. Takes two parameters:
 *    - The first parameter is the path of the update folder.
 *    - The second parameter is the path of the search folder.
 *
 * 2. It scans through all markdown files in the update folder path. For each markdown file,
 *    it checks if the file contains internal image links from the /assets folder.
 *    If a markdown file does NOT contain any internal image links from /assets,
 *    it remembers those image links for the next step.
 *
 * 3. It then scans through all files in the search folder.
 *    For each file in the search folder, it checks if the file name matches any of the remembered
 *    image links from step 2 but the file path is different.
 *    If so, it moves the matched file from the search folder to the assets folder referenced
 *    in the update folder's markdown files.
 */

import fs from "fs";
import path from "path";

/**
 * Extract internal image links from markdown content that reference /assets folder
 * @param {string} content - Markdown file content
 * @returns {Set<string>} - Set of image file names referenced
 */
function extractAssetImageLinks(content) {
  const regex = /!\[[^\]]*\]\((\/assets\/[^)]+)\)/g;
  const links = new Set();
  let match;
  while ((match = regex.exec(content)) !== null) {
    const assetPath = match[1];
    const fileName = path.basename(assetPath);
    links.add(fileName);
  }
  return links;
}

/**
 * Recursively find all markdown files in a directory
 * @param {string} dir - Directory path
 * @returns {string[]} - Array of markdown file paths
 */
function findMarkdownFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  list.forEach((file) => {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      results = results.concat(findMarkdownFiles(filePath));
    } else if (file.isFile() && file.name.endsWith(".md")) {
      results.push(filePath);
    }
  });
  return results;
}

/**
 * Recursively find all files in a directory
 * @param {string} dir - Directory path
 * @returns {string[]} - Array of file paths
 */
function findAllFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  list.forEach((file) => {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      results = results.concat(findAllFiles(filePath));
    } else if (file.isFile()) {
      results.push(filePath);
    }
  });
  return results;
}

/**
 * Main function to move assets based on parameters
 * @param {string} updateFolder - Path to update folder
 * @param {string} searchFolder - Path to search folder
 */
function moveAssets(updateFolder, searchFolder) {
  // Step 2: Find markdown files in update folder and extract asset image links if no internal /assets links
  const markdownFiles = findMarkdownFiles(updateFolder);
  // We will process each markdown file and handle its own assets folder separately
  markdownFiles.forEach((mdFile) => {
    const content = fs.readFileSync(mdFile, "utf-8");
    const assetLinks = extractAssetImageLinks(content);
    if (assetLinks.size === 0) {
      // No internal /assets image links, so find all image links (not from /assets) to remember
      const allImageLinks = new Set();
      const imageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
      let match;
      while ((match = imageRegex.exec(content)) !== null) {
        const imgPath = match[1];
        if (!imgPath.startsWith("/assets/")) {
          const fileName = path.basename(imgPath);
          allImageLinks.add(fileName);
        }
      }
      // Determine the directory of the markdown file
      const mdDir = path.dirname(mdFile);
      // Determine the assets folder for this markdown file
      const assetsFolder = path.join(mdDir, "assets");
      // For each remembered link, move matching files from search folder to this assets folder
      allImageLinks.forEach((fileName) => {
        const searchFiles = findAllFiles(searchFolder);
        searchFiles.forEach((filePath) => {
          if (path.basename(filePath) === fileName) {
            const destPath = path.join(assetsFolder, fileName);
            if (path.resolve(filePath) !== path.resolve(destPath)) {
              // Ensure assets folder exists
              if (!fs.existsSync(assetsFolder)) {
                fs.mkdirSync(assetsFolder, { recursive: true });
              }
              fs.renameSync(filePath, destPath);
              console.log(`Moved ${filePath} to ${destPath}`);
            }
          }
        });
      });
    }
  });
}


const [updateFolder, searchFolder] = process.argv.slice(2);
if (!updateFolder || !searchFolder) {
  console.error("Usage: node move-assets.js <updateFolder> <searchFolder>");
  process.exit(1);
}
moveAssets(updateFolder, searchFolder);
