import { RuleModule, RuleContext } from './types.js';
import prettier from 'prettier/standalone';
import parserMarkdown from 'prettier/parser-markdown';
import path from 'path';
import fs, { existsSync } from 'fs';

const DEFAULT_CONFIG = {
  arrowParens: 'avoid',
  trailingComma: 'all',
  semi: true,
  singleQuote: true,
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
} as const;

// Get project's prettier config
async function getPrettierConfig() {
  const possiblesConfigs = [
    'prettier.config.js',
    'prettier.config.cjs',
    'prettier.config.mjs',
    '.prettierrc',
    '.prettierrc.js',
    '.prettierrc.cjs',
    '.prettierrc.mjs',
    '.prettierrc.json',
  ];
  for (const configFile of possiblesConfigs) {
    try {
      const configPath = path.join(process.cwd(), configFile);
      const stats = fs.statSync(configPath);
      if (existsSync(configPath) && !stats.isFile()) {
        continue;
      }
      // Check if the file is a JavaScript module
      if (configFile.endsWith('.js') || configFile.endsWith('.cjs') || configFile.endsWith('.mjs')) {
        const configModule = await import(configPath);
        return configModule.default;
      }
      if (configFile.endsWith('.json') || configFile === '.prettierrc') {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch {
      continue;
    }
  }
  return DEFAULT_CONFIG;
}

const rule: RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Formats frontmatter and the entire markdown file using Prettier.',
      category: 'Markdown',
      recommended: false
    },
    fixable: 'code',
    schema: [],
    // Field to indicate that this rule should be run after all of other rules
    isRunFormatAfterAll: true,
  },
  async create(context: RuleContext) {
    const fileContent = context.getSourceCode();
    const config = await getPrettierConfig();
    // Delete plugins if it exists in the config
    if (config.plugins) {
      delete config.plugins;
    }

    const isFixContext = context.fix;
    const prettierOptions = {
      parser: 'markdown',
      plugins: [parserMarkdown],
      ...config,
    };
    let prettierError: Error | null = null;
    let isFormatted = true;

    try {
      // Use prettier.check to determine if the file is formatted
      isFormatted = await prettier.check(fileContent, prettierOptions);
    } catch (e: any) {
      prettierError = e;
      // Print out what prettier throws out
      console.error(
        `[markdown/prettier] Error during prettier.check for ${context.filePath}:`,
        e.message || e,
      );
    }

    return {
      check: async () => {
        if (prettierError && !isFixContext || !isFormatted) {
          const errorMessage = prettierError
            ? `Prettier check failed: ${prettierError.message || prettierError}`
            : 'The markdown file is not formatted according to Prettier standards.';
          context.report({
            ruleId: 'markdown/prettier',
            severity: context.severity,
            message: errorMessage,
            line: 1,
            column: 1,
            nodeType: 'document',
            fix: {
              range: [0, fileContent.length],
              text: fileContent,
              format: async (latestContent: string) => {
                const formattedContent = await prettier.format(
                  latestContent,
                  prettierOptions,
                );
                return formattedContent;
              },
            },
          });
          return;
        }
      },
    };
  }
};

export default rule;
