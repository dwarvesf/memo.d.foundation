/**
 * Rule: Check for frontmatter format issues.
 * Returns an array of violation messages if any.
 */
function checkFrontmatter(frontmatter) {
  const lines = frontmatter.split('\n');
  const keys = new Set();
  let curlyOpen = 0,
    curlyClose = 0;
  let squareOpen = 0,
    squareClose = 0;
  const forbiddenChars = ['\t', '\0', '\b', '\f', '\v'];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '') continue;

    for (const ch of forbiddenChars) {
      if (line.includes(ch)) {
        return [
          `Forbidden character (${JSON.stringify(ch)}) found on line ${i + 1}`,
        ];
      }
    }

    curlyOpen += (line.match(/{/g) || []).length;
    curlyClose += (line.match(/}/g) || []).length;
    squareOpen += (line.match(/\[/g) || []).length;
    squareClose += (line.match(/]/g) || []).length;

    if (/^\s*-\s/.test(trimmed)) continue;

    let colonCount = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    for (let char of line) {
      if (char === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
      else if (char === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
      else if (char === ':' && !inSingleQuote && !inDoubleQuote) colonCount++;
    }
    if (colonCount !== 1) {
      return [
        `Line ${i + 1} should contain exactly one colon outside quotes: "${line}"`,
      ];
    }
    const keyPart = trimmed.split(':')[0];
    if (!/^[\w\-\.]+$/.test(keyPart)) {
      return [`Invalid key format on line ${i + 1}: "${line}"`];
    }
    const valuePart = trimmed.slice(trimmed.indexOf(':') + 1).trim();
    if (/^(['"]).*\1$/.test(valuePart)) {
      continue;
    }
    const keyMatch = trimmed.match(/^([\w\-\.]+):/);
    if (keyMatch) {
      const key = keyMatch[1];
      if (keys.has(key))
        return [`Duplicate key "${key}" found on line ${i + 1}`];
      keys.add(key);
    }
    let lineForQuoteCheck = line
      .replace(/"([^"\\]|\\.)*"/g, '')
      .replace(/'([^'\\]|\\.)*'/g, '');
    let singleQuotes = (lineForQuoteCheck.match(/'/g) || []).length;
    let doubleQuotes = (lineForQuoteCheck.match(/"/g) || []).length;
    if (singleQuotes % 2 !== 0)
      return [`Unbalanced single quotes on line ${i + 1}`];
    if (doubleQuotes % 2 !== 0)
      return [`Unbalanced double quotes on line ${i + 1}`];
  }
  if (curlyOpen !== curlyClose)
    return ['Unbalanced curly braces in frontmatter'];
  if (squareOpen !== squareClose)
    return ['Unbalanced square brackets in frontmatter'];
  return [];
}

function check(file, content) {
  // Only check frontmatter if present
  if (!content.startsWith('---')) {
    return ['No frontmatter found'];
  }
  const end = content.indexOf('---', 3);
  if (end === -1) {
    return ['Missing closing --- for frontmatter'];
  }
  const frontmatter = content.substring(3, end).trim();
  return checkFrontmatter(frontmatter);
}

export { check };
