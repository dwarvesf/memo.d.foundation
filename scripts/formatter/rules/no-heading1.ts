import { RuleModule, RuleContext } from './types.js';

const rule: RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prevents usage of H1 headings (#) in markdown files and can auto-fix by converting to H2.',
      category: 'Markdown',
      recommended: true
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          allowInRoot: {
            type: 'boolean',
            default: false
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context: RuleContext) {
    const options = context.options || {};
    const allowInRoot: boolean = options.allowInRoot === true;
    const fileContent: string = context.getSourceCode();
    const markdownContent: string = context.getMarkdownContent(); // Content after frontmatter

    return {
      check: () => {
        const lines = fileContent.split('\n');
        let inCodeBlock = false;
        let frontmatterOffset = fileContent.indexOf(markdownContent);
        if (frontmatterOffset === -1) frontmatterOffset = 0; // If no frontmatter, content starts at 0

        lines.forEach((line, idx) => {
          const originalLineNumber = idx + 1;
          const isContentLine = (fileContent.indexOf(line) >= frontmatterOffset);

          if (/^```/.test(line.trim())) {
            inCodeBlock = !inCodeBlock;
          }

          if (!inCodeBlock && /^#\s+/.test(line)) {
            // Check if it's an H1 heading
            const isH1 = line.trim().startsWith('# ') && !line.trim().startsWith('##');

            if (isH1) {
              // If allowInRoot is true, only report if it's not the very first line of the content
              if (allowInRoot && isContentLine && originalLineNumber === 1) {
                return; // Allow H1 if it's the first line of content and option is enabled
              }

              const start = fileContent.indexOf(line);
              // The range for replacing the first '#' character
              const range: [number, number] = [start, start + 1];

              context.report({
                ruleId: 'markdown/no-heading1',
                severity: context.severity,
                message: 'H1 headings are not allowed in this document',
                line: originalLineNumber,
                column: 1,
                nodeType: 'heading',
                fix: { // Directly provide the fix object
                  range: range,
                  text: '##'
                }
              });
            }
          }
        });
      }
    };
  }
};

export default rule;
