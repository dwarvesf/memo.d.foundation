import fs from 'fs';
import path from 'path';

/**
 * Rule: Check if relative link paths (images and other files) exist.
 * Returns an array of violation messages if any linked file does not exist.
 */

function check(file, content) {
  const violations = [];
  // Regex to match markdown links and images syntax: ![alt](path) or [text](path)
  // Capture the path inside parentheses
  const linkRegex = /!?\[[^\]]*\]\(([^)]+)\)/g;

  // Directory of the markdown file
  const fileDir = path.dirname(file);

  // Split content into lines for code block detection
  const lines = content.split('\n');
  let inCodeBlock = false;
  let lineIndex = 0;

  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    // Find the line number of the match
    const matchIndex = match.index;

    // Reset lineIndex and inCodeBlock for each match to correctly detect code blocks
    lineIndex = 0;
    inCodeBlock = false;

    while (
      lineIndex < lines.length &&
      content.indexOf(
        lines[lineIndex],
        lineIndex === 0
          ? 0
          : content.indexOf(lines[lineIndex - 1]) + lines[lineIndex - 1].length,
      ) <= matchIndex
    ) {
      const line = lines[lineIndex];
      if (/^```/.test(line)) {
        inCodeBlock = !inCodeBlock;
      }
      lineIndex++;
    }

    if (inCodeBlock) {
      // Skip links inside code blocks
      continue;
    }

    let linkPath = match[1].trim();

    // Decode URI components to handle escape symbols like %20
    try {
      linkPath = decodeURIComponent(linkPath);
    } catch (e) {
      // If decoding fails, keep original linkPath
    }

    // Normalize linkPath by removing enclosing angle brackets if any
    if (linkPath.startsWith('<') && linkPath.endsWith('>')) {
      linkPath = linkPath.slice(1, -1);
    }

    // Remove anchor part after '#' if present for file existence check
    const hashIndex = linkPath.indexOf('#');
    if (hashIndex !== -1) {
      linkPath = linkPath.slice(0, hashIndex);
    }

    // Ignore links with protocols like http://, https://, mailto:, ftp:, etc.
    if (
      !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(linkPath) && // no protocol scheme
      linkPath !== '' && // not empty after removing anchor
      !path.isAbsolute(linkPath)
    ) {
      // Resolve the absolute path of the linked file
      const resolvedPath = path.resolve(fileDir, linkPath);

      if (!fs.existsSync(resolvedPath)) {
        violations.push(`Link path does not exist: "${linkPath}"`);
      }
    }
  }

  return violations;
}

export { check };
