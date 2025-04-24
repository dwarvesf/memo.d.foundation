/**
 * Usage: node move-notes.js migration-file.json
 * (If using ESM, run: node --experimental-modules move-notes.js migration-file.json)
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.argv.length < 3) {
  console.error("Usage: node move-notes.js <migration-file.json>");
  process.exit(1);
}

const migrationFile = process.argv[2];
const migrationPath = path.resolve(__dirname, migrationFile);

if (!fs.existsSync(migrationPath)) {
  console.error(`Migration file not found: ${migrationPath}`);
  process.exit(1);
}

let migration;
try {
  migration = JSON.parse(fs.readFileSync(migrationPath, "utf8"));
} catch (err) {
  console.error("Failed to parse migration file:", err);
  process.exit(1);
}

const VAULT_ROOT = path.resolve(__dirname, "../.."); // Adjust as needed

function findAssetImages(mdContent, assetFolderName) {
  // Markdown image: ![alt](assets/filename.ext) or ![alt](./assets/filename.ext)
  // Also support images with relative path: ![alt](../assets/filename.ext)
  const regex = new RegExp(`!\\[[^\\]]*\\]\\((\\.?\\/?${assetFolderName}\\/[^)]+)\\)`, "g");
  const images = [];
  let match;
  while ((match = regex.exec(mdContent)) !== null) {
    images.push(match[1]);
  }
  return images;
}

for (const [destDir, files] of Object.entries(migration)) {
  for (const srcRel of files) {
    // Remove leading slash if present
    const src = srcRel.startsWith("/") ? srcRel.slice(1) : srcRel;
    const srcAbs = path.join(VAULT_ROOT, src);
    const destAbs = path.join(VAULT_ROOT, destDir, path.basename(src));
    const destRel = path.relative(VAULT_ROOT, destAbs);

    // Ensure destination directory exists
    const destDirAbs = path.dirname(destAbs);
    if (!fs.existsSync(destDirAbs)) {
      fs.mkdirSync(destDirAbs, { recursive: true });
    }

    // Run git mv for the markdown file
    try {
      console.log(`Moving: ${src} -> ${destRel}`);
      execSync(`git mv "${srcAbs}" "${destAbs}"`, { stdio: "inherit" });
    } catch (err) {
      console.error(`Failed to move ${src} to ${destRel}:`, err.message);
      continue; // Skip asset move if note move failed
    }

    // --- Asset image handling ---
    // Find asset folder for the source and destination
    const srcMdDir = path.dirname(srcAbs);
    const destMdDir = path.dirname(destAbs);
    const assetFolderName = "assets";
    const srcAssetDir = path.join(srcMdDir, assetFolderName);
    const parentAssetDir = path.join(path.dirname(srcMdDir), assetFolderName);
    const destAssetDir = path.join(destMdDir, assetFolderName);

    // Read the moved markdown file content (now at destAbs)
    let mdContent;
    try {
      mdContent = fs.readFileSync(destAbs, "utf8");
    } catch (err) {
      console.error(`Failed to read moved markdown file: ${destAbs}`, err.message);
      continue;
    }

    // Find all image links in the assets folder
    const assetImages = findAssetImages(mdContent, assetFolderName);

    if (assetImages.length === 0) {
      console.log(`No asset images found in ${destRel}`);
      continue;
    }

    // Ensure destination assets folder exists
    if (!fs.existsSync(destAssetDir)) {
      fs.mkdirSync(destAssetDir, { recursive: true });
    }

    for (const imgRel of assetImages) {
      // imgRel is like 'assets/filename.png' or './assets/filename.png'
      // Normalize to just the filename
      const imgName = path.basename(imgRel);
      let srcImgAbs = path.join(srcAssetDir, imgName);
      let foundIn = null;

      if (fs.existsSync(srcImgAbs)) {
        foundIn = srcAssetDir;
      } else {
        // Try parent assets folder
        const parentImgAbs = path.join(parentAssetDir, imgName);
        if (fs.existsSync(parentImgAbs)) {
          srcImgAbs = parentImgAbs;
          foundIn = parentAssetDir;
        }
      }

      const destImgAbs = path.join(destAssetDir, imgName);
      const destImgRel = path.relative(VAULT_ROOT, destImgAbs);

      if (!foundIn) {
        console.error(`Image not found in current or parent assets: ${imgName} (skipped)`);
        continue;
      }

      // Move the image using git mv
      try {
        execSync(`git mv "${srcImgAbs}" "${destImgAbs}"`, { stdio: "inherit" });
        console.log(`Moved image: ${imgName} from ${foundIn} -> ${destImgRel}`);
      } catch (err) {
        console.error(`Failed to move image ${imgName} to ${destImgRel}:`, err.message);
      }
    }
  }
}
