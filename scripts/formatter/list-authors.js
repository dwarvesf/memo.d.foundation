import fs from 'fs';
import path from 'path';

function searchFiles(dir, authorMap) {
  const filesAndDirs = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of filesAndDirs) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      searchFiles(fullPath, authorMap);
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
      if (frontmatter) {
        // Extract authors or author field from frontmatter
        // We'll parse the frontmatter lines to find authors or author
        const lines = frontmatter.split('\n');
        let inAuthorsList = false;
        let authors = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('authors:')) {
            // authors field found, could be list or single
            if (line === 'authors:') {
              // list starts in next lines
              inAuthorsList = true;
              continue;
            } else {
              // inline authors field, e.g. authors: [a, b]
              // or authors: single author
              const inlineAuthors = line.substring('authors:'.length).trim();
              if (
                inlineAuthors.startsWith('[') &&
                inlineAuthors.endsWith(']')
              ) {
                // parse as array
                try {
                  const parsed = JSON.parse(inlineAuthors.replace(/'/g, '"'));
                  if (Array.isArray(parsed)) {
                    authors = authors.concat(parsed);
                  }
                } catch {
                  // fallback: split by comma
                  authors = authors.concat(
                    inlineAuthors
                      .slice(1, -1)
                      .split(',')
                      .map(a => a.trim()),
                  );
                }
              } else {
                authors.push(inlineAuthors);
              }
              inAuthorsList = false;
              break;
            }
          } else if (inAuthorsList) {
            if (line.startsWith('- ')) {
              authors.push(line.substring(2).trim());
            } else if (line === '') {
              // empty line ends list
              inAuthorsList = false;
            } else if (!line.startsWith('-')) {
              // no longer in list
              inAuthorsList = false;
            }
          } else if (line.startsWith('author:')) {
            // single author field
            const authorName = line.substring('author:'.length).trim();
            if (authorName) {
              authors.push(authorName);
            }
          }
        }
        // Add authors to map
        authors.forEach(author => {
          if (!authorMap[author]) {
            authorMap[author] = [];
          }
          authorMap[author].push(fullPath);
        });
      }
    }
  }
}

const args = process.argv.slice(2);
const targetPath = args[0];
const noFilePathFlag = args.includes('--no-file-path');

if (!targetPath) {
  console.error('Usage: node list-authors.js <path> [--no-file-path]');
  process.exit(1);
}

const authorMap = {};
searchFiles(targetPath, authorMap);

Object.entries(authorMap).forEach(([author, files]) => {
  console.log(author);
  if (!noFilePathFlag) {
    files.forEach(file => {
      console.log(`- ${file}`);
    });
  }
  console.log('');
});
