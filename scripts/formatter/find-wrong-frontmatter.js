import fs from 'fs';
import path from 'path';
function checkFrontmatter(frontmatter) {
  // Returns { valid: boolean, reason: string|null }
  const lines = frontmatter.split('\n');
  const keys = new Set();
  let curlyOpen = 0, curlyClose = 0;
  let squareOpen = 0, squareClose = 0;
  const forbiddenChars = ['\t', '\0', '\b', '\f', '\v']; // Add any other forbidden chars here
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '') continue; // skip empty lines

    // Check for forbidden characters anywhere in the line
    for (const ch of forbiddenChars) {
      if (line.includes(ch)) {
        return { valid: false, reason: `Forbidden character (${JSON.stringify(ch)}) found on line ${i + 1}` };
      }
    }

    // Count brackets/braces
    curlyOpen += (line.match(/{/g) || []).length;
    curlyClose += (line.match(/}/g) || []).length;
    squareOpen += (line.match(/\[/g) || []).length;
    squareClose += (line.match(/]/g) || []).length;

    // Skip list items
    if (/^\s*-\s/.test(trimmed)) continue;

    // Check for missing colon (should be key: value)
    // Also ensure only one colon per line (key: value), ignoring colons inside quotes
    let colonCount = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    for (let char of line) {
      if (char === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
      else if (char === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
      else if (char === ':' && !inSingleQuote && !inDoubleQuote) colonCount++;
    }
    if (colonCount !== 1) {
      return { valid: false, reason: `Line ${i + 1} should contain exactly one colon outside quotes: "${line}"` };
    }
    // Check key-value format only on the part before the first colon
    const keyPart = trimmed.split(':')[0];
    if (!/^[\w\-\.]+$/.test(keyPart)) {
      return { valid: false, reason: `Invalid key format on line ${i + 1}: "${line}"` };
    }
    // If value is quoted, skip forbidden character checks on value
    const valuePart = trimmed.slice(trimmed.indexOf(':') + 1).trim();
    if (/^(['"]).*\1$/.test(valuePart)) {
      continue;
    }

    // Check for duplicate keys at top level
    const keyMatch = trimmed.match(/^([\w\-\.]+):/);
    if (keyMatch) {
      const key = keyMatch[1];
      if (keys.has(key)) return { valid: false, reason: `Duplicate key "${key}" found on line ${i + 1}` };
      keys.add(key);
    }

    // Check for unbalanced quotes, but ignore quotes inside double-quoted or single-quoted strings
    // Remove all double-quoted and single-quoted substrings before counting
    let lineForQuoteCheck = line.replace(/"([^"\\]|\\.)*"/g, '').replace(/'([^'\\]|\\.)*'/g, '');
    let singleQuotes = (lineForQuoteCheck.match(/'/g) || []).length;
    let doubleQuotes = (lineForQuoteCheck.match(/"/g) || []).length;
    if (singleQuotes % 2 !== 0)
      return { valid: false, reason: `Unbalanced single quotes on line ${i + 1}` };
    if (doubleQuotes % 2 !== 0)
      return { valid: false, reason: `Unbalanced double quotes on line ${i + 1}` };
  }
  // Check for unbalanced brackets/braces
  if (curlyOpen !== curlyClose)
    return { valid: false, reason: "Unbalanced curly braces in frontmatter" };
  if (squareOpen !== squareClose)
    return { valid: false, reason: "Unbalanced square brackets in frontmatter" };
  return { valid: true, reason: null };
}

function searchFiles(dir, results) {
  const filesAndDirs = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of filesAndDirs) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      searchFiles(fullPath, results);
    } else if (entry.isFile() && fullPath.endsWith('.md')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      // Extract frontmatter section (YAML between --- and --- at the top)
      let frontmatter = '';
      if (content.startsWith('---')) {
        const end = content.indexOf('---', 3);
        if (end !== -1) {
          frontmatter = content.substring(3, end).trim();
        } else {
          // Missing closing ---
          results.push(fullPath);
          continue;
        }
      } else {
        // No frontmatter found
        results.push(fullPath);
        continue;
      }
      // Validate frontmatter format and log reason if wrong
      const check = checkFrontmatter(frontmatter);
      if (!check.valid) {
        if (check.reason) {
          console.log(`${fullPath}: ${check.reason}`);
        } else {
          console.log(`${fullPath}: Unknown frontmatter format error`);
        }
        results.push(fullPath);
      }
    }
  }
}

const args = process.argv.slice(2);
const targetPath = args[0];

if (!targetPath) {
  console.error('Usage: node find-wrong-frontmatter.js <path>');
  process.exit(1);
}

const results = [];
searchFiles(targetPath, results);

results.forEach(filePath => console.log(filePath));
