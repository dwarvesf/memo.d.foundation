/**
 * Rule: Warn if the file contains a heading 1 ("# ").
 * Returns an array of violation messages if any.
 */
function check(file, content) {
  // Skip frontmatter if present
  let body = content;
  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3);
    if (end !== -1) {
      body = content.slice(end + 3);
    }
  }
  const lines = body.split('\n');
  const violations = [];
  let inCodeBlock = false;
  lines.forEach((line, idx) => {
    if (/^```/.test(line)) {
      inCodeBlock = !inCodeBlock;
    }
    if (!inCodeBlock && /^#\s+/.test(line)) {
      violations.push(`Heading 1 found on line ${idx + 1}: "${line.trim()}"`);
    }
  });
  return violations;
}

export { check };
