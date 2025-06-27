import { RuleModule, RuleContext } from './types.js';

// Helper: Convert string to hyphen-case (kebab-case)
function toHyphenCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase();
}

// Canonical frontmatter builder (from original format-note.ts)
function formatDateToYMD(
  dateValue: string | Date | null | undefined,
): string | null {
  if (!dateValue) return null;
  let d: Date;
  if (typeof dateValue === 'string') {
    d = new Date(dateValue);
  } else if (dateValue instanceof Date) {
    d = dateValue;
  } else {
    return null;
  }
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function yamlValue(val: any): string {
  if (val === null) return 'null';
  if (typeof val === 'string') {
    if (
      val.includes("'") ||
      val.includes('#') ||
      val.includes('`') ||
      val.includes(':')
    ) {
      return `"${val.replace(/"/g, '\\"')}"`;
    }
    return val;
  }
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return JSON.stringify(val);
}

function buildFrontmatter(
  data: { [key: string]: any },
  requiredFields: string[],
  orders: string[],
): string {
  const fm: { [key: string]: any } = {};
  for (const key of requiredFields) {
    const defaultValue = `["${key.toUpperCase()}_VALUE"]`;
    if (data[key] === undefined || data[key] === null || data[key] === '') {
      fm[key] = defaultValue;
    } else if (key === 'date') {
      const formatted = formatDateToYMD(data[key]);
      fm[key] =
        formatted === null && data[key] !== defaultValue ? null : formatted;
    } else {
      fm[key] = data[key];
    }
  }
  let authors: string[] | undefined;
  if (typeof data.authors === 'string') {
    authors = data.authors
      .split(',')
      .map((a: string) => a.trim())
      .filter((a: string) => a.length > 0);
  } else if (Array.isArray(data.authors)) {
    authors = data.authors
      .map((a: any) => (typeof a === 'string' ? a.trim() : a))
      .filter((a: string) => a && a.length > 0);
  } else {
    authors = undefined;
  }
  if (authors && authors.length === 0) authors = undefined;

  let tags: string[] | undefined;
  if (typeof data.tags === 'string') {
    tags = data.tags
      .split(',')
      .map((t: string) => toHyphenCase(t.trim()))
      .filter((t: string) => t.length > 0);
  } else if (Array.isArray(data.tags)) {
    tags = data.tags
      .map((t: any) => toHyphenCase(typeof t === 'string' ? t.trim() : t))
      .filter((t: string) => t && t.length > 0);
  } else {
    tags = undefined;
  }
  if (tags && tags.length === 0) tags = undefined;

  const originalKeys = Object.keys(data);
  const keysToExclude = orders.filter(k => k !== '...');
  const extraKeys = originalKeys.filter(k => !keysToExclude.includes(k));
  extraKeys.sort();

  let yaml = '---\n';
  for (const key of orders) {
    if (key === '...') {
      for (const extraKey of extraKeys) {
        yaml += `${extraKey}: ${yamlValue(data[extraKey])}\n`;
      }
    } else if (key === 'authors') {
      if (authors) {
        yaml += 'authors:\n';
        authors.forEach(a => {
          yaml += `  - ${a}\n`;
        });
      }
    } else if (key === 'tags') {
      if (tags) {
        yaml += 'tags:\n';
        tags.forEach(t => {
          yaml += `  - ${t}\n`;
        });
      }
    } else {
      if (key in fm) {
        yaml += `${key}: ${yamlValue(fm[key])}\n`;
      } else if (key in data && key !== 'authors' && key !== 'tags') {
        yaml += `${key}: ${yamlValue(data[key])}\n`;
      }
    }
  }
  yaml += '---\n';
  return yaml;
}
// Helper to get current order of original frontmatter keys
const getCompareFrontmatterOrder = (
  frontmatterLines: string[],
  orders: string[],
): {
  currentOrder: string[];
  expectedOrder: string[];
  isMatched: boolean;
} => {
  if (!orders.length) {
    return {
      currentOrder: [],
      expectedOrder: [],
      isMatched: true,
    }; // No orders specified, so everything is matched
  }
  const currentOrder: string[] = [];
  for (const line of frontmatterLines) {
    const match = line.match(/^([\w\-\.]+):/);
    if (match) {
      const key = match[1];
      if (!currentOrder.includes(key)) {
        currentOrder.push(key);
      }
    }
  }
  const isIncluded3Dots = orders.includes('...');

  const notIncludedExtra = currentOrder.filter(key => !orders.includes(key));
  let expectedOrder = orders.reduce((acc, o) => {
    if (o === '...') {
      return acc.concat(notIncludedExtra);
    }
    if (currentOrder.includes(o)) {
      acc.push(o);
    }
    return acc;
  }, [] as string[]);
  if (!isIncluded3Dots) {
    expectedOrder = expectedOrder.concat(notIncludedExtra);
  }
  let isMatched = true;
  for (const orderKey of expectedOrder) {
    const currentIndex = expectedOrder.indexOf(orderKey);
    isMatched = currentIndex !== -1 && currentOrder[currentIndex] === orderKey;
    if (!isMatched) {
      break; // No need to check further if already not matched
    }
  }
  return {
    currentOrder,
    expectedOrder,
    isMatched,
  };
};

const rule: RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Validates YAML/TOML frontmatter in markdown files, checking for format, order and required fields.',
      category: 'Markdown',
      recommended: true,
    },
    fixable: 'code', // Can auto-fix by adding missing required fields
    isRunFormatAfterAll: true, // This rule should run after all formatting
    schema: [
      {
        type: 'object',
        properties: {
          required: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'List of required frontmatter fields.',
          },
          orders: {
            // Added orders to schema
            type: 'array',
            items: {
              type: 'string',
            },
            description:
              'List of preferred frontmatter field order, use "..." for other fields.',
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context: RuleContext) {
    const options = context.options || {};
    const requiredFields: string[] = options.required || [];
    const orders: string[] = options.orders || [];
    const fileContent = context.getSourceCode();
    const parsedFrontmatter: { [key: string]: any } = context.getFrontmatter(); // This is the parsed object

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
            nodeType: 'frontmatter',
          });
          return; // No frontmatter, no further checks needed
        }

        const endOfFrontmatterDelimiter = fileContent.indexOf('---', 3);
        if (endOfFrontmatterDelimiter === -1) {
          context.report({
            ruleId: 'markdown/frontmatter',
            severity: context.severity,
            message: 'Missing closing "---" for frontmatter.',
            line: fileContent.split('\n').length, // Report at the end of the file
            column: 1,
            nodeType: 'frontmatter',
          });
          return; // No closing delimiter, no further checks needed
        }

        const rawFrontmatterString = fileContent
          .substring(3, endOfFrontmatterDelimiter)
          .trim();
        const frontmatterLines = rawFrontmatterString.split('\n');
        const isContainSpaceAfterEndDelimiter =
          fileContent[endOfFrontmatterDelimiter + 3] === '\n';

        // 2. Validate frontmatter format (adapted from original checkFrontmatter)
        const keys = new Set<string>();
        let curlyOpen = 0,
          curlyClose = 0;
        let squareOpen = 0,
          squareClose = 0;
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
                nodeType: 'frontmatter',
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
            else if (char === '"' && !inSingleQuote)
              inDoubleQuote = !inDoubleQuote;
            else if (char === ':' && !inSingleQuote && !inDoubleQuote)
              colonCount++;
          }
          if (colonCount !== 1) {
            context.report({
              ruleId: 'markdown/frontmatter',
              severity: context.severity,
              message: `Line ${i + 1} should contain exactly one colon outside quotes: "${line}".`,
              line: i + 1,
              column: 1,
              nodeType: 'frontmatter',
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
                nodeType: 'frontmatter',
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
              nodeType: 'frontmatter',
            });
          }
          if (doubleQuotes % 2 !== 0) {
            context.report({
              ruleId: 'markdown/frontmatter',
              severity: context.severity,
              message: `Unbalanced double quotes on line ${i + 1}.`,
              line: i + 1,
              column: 1,
              nodeType: 'frontmatter',
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
            nodeType: 'frontmatter',
          });
        }
        if (squareOpen !== squareClose) {
          context.report({
            ruleId: 'markdown/frontmatter',
            severity: context.severity,
            message: 'Unbalanced square brackets in frontmatter.',
            line: 1, // Can't pinpoint exact line, report at start of frontmatter
            column: 1,
            nodeType: 'frontmatter',
          });
        }

        // 3. Check for frontmatter order, canonical form, and missing required fields (all in one)
        const builtFrontmatterString = buildFrontmatter(
          parsedFrontmatter,
          requiredFields,
          orders,
        );

        // Find missing required fields
        const missingFields = requiredFields.filter(
          field =>
            parsedFrontmatter[field] === undefined ||
            parsedFrontmatter[field] === null ||
            parsedFrontmatter[field] === '',
        );

        const { currentOrder, expectedOrder, isMatched } =
          getCompareFrontmatterOrder(frontmatterLines, orders);

        if (!isMatched || missingFields.length > 0) {
          let matchMsg = '';
          if (!isMatched) {
            matchMsg +=
              'Frontmatter fields are not in the expected order. ' +
              'Expected: ' +
              `[${expectedOrder.join(', ')}]; ` +
              'Current: ' +
              `[${currentOrder.join(', ')}]`;
          }
          let missingMsg = '';
          if (missingFields.length > 0) {
            missingMsg += missingFields
              .map(field => `Required frontmatter field missing: '${field}'`)
              .join('\n');
          }

          const message = [matchMsg, missingMsg].filter(Boolean).join('\n');

          context.report({
            ruleId: 'markdown/frontmatter',
            severity: context.severity,
            message,
            fixableCount: [matchMsg, missingMsg].filter(Boolean).length,
            line: 2, // Report at the start of the delimiter line
            column: 1,
            nodeType: 'frontmatter',
            fix: {
              range: [
                0,
                endOfFrontmatterDelimiter +
                  (isContainSpaceAfterEndDelimiter ? 4 : 3),
              ], // Replace the entire frontmatter block including delimiters
              text: builtFrontmatterString,
            },
          });
        }
      },
    };
  },
};

export default rule;
