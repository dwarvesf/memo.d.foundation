import fs from 'fs';
import path from 'path';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Validates that relative links in markdown point to existing files.',
      category: 'Markdown',
      recommended: true
    },
    fixable: null, // This rule doesn't have a simple auto-fix that can be applied generically
    schema: []
  },
  create(context) {
    const filePath = context.filePath;
    const fileContent = context.getSourceCode();
    const fileDir = path.dirname(filePath);

    return {
      check: () => { // Removed destructuring here
        const linkRegex = /!?\[[^\]]*\]\(([^)]+)\)/g;
        const lines = fileContent.split('\n');
        let inCodeBlock = false;

        let match;
        while ((match = linkRegex.exec(fileContent)) !== null) {
          const matchIndex = match.index;
          let lineIndex = 0;
          let currentOffset = 0;

          while (lineIndex < lines.length && currentOffset + lines[lineIndex].length <= matchIndex) {
            if (/^```/.test(lines[lineIndex].trim())) {
              inCodeBlock = !inCodeBlock;
            }
            currentOffset += lines[lineIndex].length + 1; // +1 for newline character
            lineIndex++;
          }

          if (inCodeBlock) {
            continue;
          }

          let linkPath = match[1].trim();

          try {
            linkPath = decodeURIComponent(linkPath);
          } catch (e) {
            // If decoding fails, keep original linkPath
          }

          if (linkPath.startsWith('<') && linkPath.endsWith('>')) {
            linkPath = linkPath.slice(1, -1);
          }

          const hashIndex = linkPath.indexOf('#');
          if (hashIndex !== -1) {
            linkPath = linkPath.slice(0, hashIndex);
          }

          if (
            !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(linkPath) &&
            linkPath !== '' &&
            !path.isAbsolute(linkPath)
          ) {
            const resolvedPath = path.resolve(fileDir, linkPath);

            if (!fs.existsSync(resolvedPath)) {
              context.report({
                ruleId: 'markdown/relative-link-exists',
                severity: context.severity,
                message: `Relative link points to non-existent file: ${linkPath}`,
                line: lineIndex + 1, // Line numbers are 1-based
                column: match.index - currentOffset + 1, // Column numbers are 1-based
                nodeType: 'link',
              });
            }
          }
        }
      }
    };
  }
};

export default rule;
