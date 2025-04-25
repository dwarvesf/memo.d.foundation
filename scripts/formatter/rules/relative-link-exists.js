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

  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    let linkPath = match[1].trim();

    // Decode URI components to handle escape symbols like %20
    try {
      linkPath = decodeURIComponent(linkPath);
    } catch (e) {
      // If decoding fails, keep original linkPath
    }

    // Ignore links with protocols like http://, https://, mailto:, ftp:, etc.
    if (
      !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(linkPath) && // no protocol scheme
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
