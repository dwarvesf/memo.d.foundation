import fs from 'fs';
import path from 'path';

function searchFiles(dir, tags, results) {
  const filesAndDirs = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of filesAndDirs) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      searchFiles(fullPath, tags, results);
    } else if (entry.isFile()) {
      const content = fs.readFileSync(fullPath, 'utf8');
      // Only search in frontmatter section (YAML between --- and --- at the top)
      let frontmatter = '';
      if (content.startsWith('---')) {
        const end = content.indexOf('---', 3);
        if (end !== -1) {
          frontmatter = content.substring(0, end + 3);
        }
      }
      if (
        frontmatter &&
        tags.some(tag => frontmatter.includes(tag))
      ) {
        results.push(fullPath);
      }
    }
  }
}

const args = process.argv.slice(2);
const targetPath = args[0];
const tagsArg = args[1];

if (!targetPath || !tagsArg) {
  console.error('Usage: node find-by-tag.js <path> <tag1,tag2,tag3>');
  process.exit(1);
}

const tags = tagsArg.split(',').map(tag => tag.trim()).filter(Boolean);

const results = [];
searchFiles(targetPath, tags, results);

results.forEach(filePath => console.log(filePath));
