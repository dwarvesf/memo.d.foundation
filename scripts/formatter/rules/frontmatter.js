const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Validates YAML/TOML frontmatter in markdown files, checking for format and required fields.',
      category: 'Markdown',
      recommended: true
    },
    fixable: 'code', // Can auto-fix by adding missing required fields
    schema: [
      {
        type: 'object',
        properties: {
          required: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'List of required frontmatter fields.'
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const options = context.options || {};
    const requiredFields = options.required || [];
    const fileContent = context.getSourceCode();
    const parsedFrontmatter = context.getFrontmatter(); // This is the parsed object

    // Helper to find the line number of a key in the raw frontmatter string
    const getLineNumberForKey = (key, rawFrontmatterString) => {
      const lines = rawFrontmatterString.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith(`${key}:`)) {
          return i + 1; // 1-based line number
        }
      }
      return 1; // Default to first line if not found (e.g., for missing fields)
    };

    return {
      check: () => {
        // 1. Check for existence of frontmatter block
        if (!fileContent.startsWith('---')) {
          context.report({
            ruleId: 'markdown/frontmatter',
            severity: context.severity,
            message: 'No frontmatter found.',
            line: 1,
            column: 1,
            nodeType: 'frontmatter'
          });
          return;
        }

        const endOfFrontmatterDelimiter = fileContent.indexOf('---', 3);
        if (endOfFrontmatterDelimiter === -1) {
          context.report({
            ruleId: 'markdown/frontmatter',
            severity: context.severity,
            message: 'Missing closing "---" for frontmatter.',
            line: fileContent.split('\n').length, // Report at the end of the file
            column: 1,
            nodeType: 'frontmatter'
          });
          return;
        }

        const rawFrontmatterString = fileContent.substring(3, endOfFrontmatterDelimiter).trim();
        const frontmatterLines = rawFrontmatterString.split('\n');

        // 2. Validate frontmatter format (adapted from original checkFrontmatter)
        const keys = new Set();
        let curlyOpen = 0, curlyClose = 0;
        let squareOpen = 0, squareClose = 0;
        const forbiddenChars = ['\t', '\0', '\b', '\f', '\v'];

        for (let i = 0; i < frontmatterLines.length; i++) {
          const line = frontmatterLines[i];
          const trimmed = line.trim();
          if (trimmed === '') continue;

          for (const ch of forbiddenChars) {
            if (line.includes(ch)) {
              context.report({
                ruleId: 'markdown/frontmatter',
                severity: context.severity,
                message: `Forbidden character (${JSON.stringify(ch)}) found on line ${i + 1}.`,
                line: i + 1,
                column: line.indexOf(ch) + 1,
                nodeType: 'frontmatter'
              });
            }
          }

          curlyOpen += (line.match(/{/g) || []).length;
          curlyClose += (line.match(/}/g) || []).length;
          squareOpen += (line.match(/\[/g) || []).length;
          squareClose += (line.match(/]/g) || []).length;

          if (/^\s*-\s/.test(trimmed)) continue; // Skip list items

          let colonCount = 0;
          let inSingleQuote = false;
          let inDoubleQuote = false;
          for (let char of line) {
            if (char === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
            else if (char === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
            else if (char === ':' && !inSingleQuote && !inDoubleQuote) colonCount++;
          }
          if (colonCount !== 1) {
            context.report({
              ruleId: 'markdown/frontmatter',
              severity: context.severity,
              message: `Line ${i + 1} should contain exactly one colon outside quotes: "${line}".`,
              line: i + 1,
              column: 1,
              nodeType: 'frontmatter'
            });
          }

          const keyMatch = trimmed.match(/^([\w\-\.]+):/);
          if (keyMatch) {
            const key = keyMatch[1];
            if (keys.has(key)) {
              context.report({
                ruleId: 'markdown/frontmatter',
                severity: context.severity,
                message: `Duplicate key "${key}" found on line ${i + 1}.`,
                line: i + 1,
                column: 1,
                nodeType: 'frontmatter'
              });
            }
            keys.add(key);
          }

          let lineForQuoteCheck = line
            .replace(/"([^"\\]|\\.)*"/g, '')
            .replace(/'([^'\\]|\\.)*'/g, '');
          let singleQuotes = (lineForQuoteCheck.match(/'/g) || []).length;
          let doubleQuotes = (lineForQuoteCheck.match(/"/g) || []).length;
          if (singleQuotes % 2 !== 0) {
            context.report({
              ruleId: 'markdown/frontmatter',
              severity: context.severity,
              message: `Unbalanced single quotes on line ${i + 1}.`,
              line: i + 1,
              column: 1,
              nodeType: 'frontmatter'
            });
          }
          if (doubleQuotes % 2 !== 0) {
            context.report({
              ruleId: 'markdown/frontmatter',
              severity: context.severity,
              message: `Unbalanced double quotes on line ${i + 1}.`,
              line: i + 1,
              column: 1,
              nodeType: 'frontmatter'
            });
          }
        }

        if (curlyOpen !== curlyClose) {
          context.report({
            ruleId: 'markdown/frontmatter',
            severity: context.severity,
            message: 'Unbalanced curly braces in frontmatter.',
            line: 1, // Can't pinpoint exact line, report at start of frontmatter
            column: 1,
            nodeType: 'frontmatter'
          });
        }
        if (squareOpen !== squareClose) {
          context.report({
            ruleId: 'markdown/frontmatter',
            severity: context.severity,
            message: 'Unbalanced square brackets in frontmatter.',
            line: 1, // Can't pinpoint exact line, report at start of frontmatter
            column: 1,
            nodeType: 'frontmatter'
          });
        }

        // 3. Check for required fields
        requiredFields.forEach(field => {
          if (parsedFrontmatter[field] === undefined) {
            const insertPosition = endOfFrontmatterDelimiter; // Insert before the closing '---'
            const defaultVal = `[${field.toUpperCase()}_VALUE]`; // Placeholder default value

            context.report({
              ruleId: 'markdown/frontmatter',
              severity: context.severity,
              message: `Required frontmatter field missing: '${field}'.`,
              line: getLineNumberForKey(field, rawFrontmatterString) + 1, // Report at the line where it would be inserted
              column: 1,
              nodeType: 'frontmatter',
              fix: { // Directly provide the fix object
                range: [insertPosition, insertPosition],
                text: `\n${field}: ${defaultVal}`
              }
            });
          }
        });
      }
    };
  }
};

export default rule;
