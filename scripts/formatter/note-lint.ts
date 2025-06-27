import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
} from 'fs';
import path from 'path';
import matter from 'gray-matter';
import allRules, { MARKDOWN_RULES_NAME } from './rules/index.js';
import {
  Colors,
  RuleContext,
  DefaultConfig,
  LintMessage,
  FileLintResult,
  LintResults,
  RuleModule,
} from './rules/types.js';

// ANSI escape codes for colors
const colors: Colors = {
  red: text => `\x1b[31m${text}\x1b[0m`,
  yellow: text => `\x1b[33m${text}\x1b[0m`,
  gray: text => `\x1b[90m${text}\x1b[0m`,
  green: text => `\x1b[32m${text}\x1b[0m`,
  blue: text => `\x1b[34m${text}\x1b[0m`,
};

const DEFAULT_CONFIG: DefaultConfig = {
  rules: {
    [MARKDOWN_RULES_NAME.RELATIVE_LINK_EXISTS]: 'off',
    [MARKDOWN_RULES_NAME.NO_HEADING1]: 'error',
    [MARKDOWN_RULES_NAME.FRONTMATTER]: [
      'error',
      { required: ['title', 'description', 'date'] },
    ],
    [MARKDOWN_RULES_NAME.PRETTIER]: 'warn',
  },
};


class NoteLint {
  private rules: { [key: string]: RuleModule };

  constructor() {
    this.rules = allRules.rules;
  }

  async lintFiles(
    filePaths: string[],
    config: DefaultConfig,
  ): Promise<LintResults> {
    const results: FileLintResult[] = [];
    let totalErrorCount = 0;
    let totalWarningCount = 0;
    let totalFixableErrorCount = 0;
    let totalFixableWarningCount = 0;

    for (const filePath of filePaths) {
      const fileContent = readFileSync(filePath, 'utf8');
      const fileResults = await this.lintFile(filePath, fileContent, config);
      results.push(fileResults);

      totalErrorCount += fileResults.errorCount;
      totalWarningCount += fileResults.warningCount;
      totalFixableErrorCount += fileResults.fixableErrorCount;
      totalFixableWarningCount += fileResults.fixableWarningCount;
    }

    return {
      results,
      errorCount: totalErrorCount,
      warningCount: totalWarningCount,
      fixableErrorCount: totalFixableErrorCount,
      fixableWarningCount: totalFixableWarningCount,
    };
  }

  async lintFile(
    filePath: string,
    fileContent: string,
    config: DefaultConfig,
  ): Promise<FileLintResult> {
    const messages: LintMessage[] = [];
    let errorCount = 0;
    let warningCount = 0;
    let fixableErrorCount = 0;
    let fixableWarningCount = 0;

    const parsed = matter(fileContent);
    const frontmatter = parsed.data;
    const markdownContent = parsed.content;

    // Sort config rules by runFormatAfterAll
    const sortedRules = Object.fromEntries(
      Object.entries(config.rules).sort(([a], [b]) => {
        const aIsFormat = this.rules[a]?.meta.isRunFormatAfterAll ? 1 : 0;
        const bIsFormat = this.rules[b]?.meta.isRunFormatAfterAll ? 1 : 0;
        return aIsFormat - bIsFormat; // Sort formatting rules to the end
      }),
    );

    for (const ruleName in sortedRules) {
      const ruleConfig = sortedRules[ruleName];
      const severity = this.getSeverity(ruleConfig);
      const options = Array.isArray(ruleConfig) ? ruleConfig[1] : {};

      if (severity === 0) continue; // Rule is off

      const ruleModule = this.rules[ruleName];
      if (ruleModule) {
        const ruleContext: RuleContext = {
          filePath,
          config, // Overall config
          severity, // Severity for this specific rule
          options, // Options for this specific rule
          report: message => {
            const finalMessage: LintMessage = {
              ...message,
              severity: ruleContext.severity,
            };
            if (typeof message.fix === 'function') {
              finalMessage.fix = (message.fix as Function)();
            } else if (message.fix) {
              finalMessage.fix = message.fix;
            }
            messages.push(finalMessage);
            if (finalMessage.severity === 2) {
              errorCount++;
              if (finalMessage.fixableCount) {
                errorCount += finalMessage.fixableCount - 1;
                fixableErrorCount += finalMessage.fixableCount;
              } else if (finalMessage.fix) {
                fixableErrorCount++;
              }
            } else if (finalMessage.severity === 1) {
              warningCount++;
              if (finalMessage.fixableCount) {
                warningCount += finalMessage.fixableCount - 1;
                fixableWarningCount += finalMessage.fixableCount;
              } else if (finalMessage.fix) {
                fixableWarningCount++;
              }
            }
          },
          getSourceCode: () => fileContent,
          getFrontmatter: () => frontmatter,
          getMarkdownContent: () => markdownContent,
        };

        const ruleCreator = await ruleModule.create(ruleContext);
        if (typeof ruleCreator.check === 'function') {
          await ruleCreator.check();
        }
      }
    }

    return {
      filePath,
      messages,
      errorCount,
      warningCount,
      fixableErrorCount,
      fixableWarningCount,
    };
  }

  getSeverity(ruleConfig: string | number | [string | number, any]): number {
    if (Array.isArray(ruleConfig)) {
      const severity = ruleConfig[0];
      if (typeof severity === 'string') {
        if (severity === 'off') return 0;
        if (severity === 'warn') return 1;
        if (severity === 'error') return 2;
      } else if (typeof severity === 'number') {
        return severity;
      }
    } else if (typeof ruleConfig === 'string') {
      if (ruleConfig === 'off') return 0;
      if (ruleConfig === 'warn') return 1;
      if (ruleConfig === 'error') return 2;
    } else if (typeof ruleConfig === 'number') {
      return ruleConfig;
    }
    return 0; // Default to off if invalid config
  }

  async applyFixes(results: LintResults): Promise<void> {
    for (const fileResult of results.results) {
      if (
        fileResult.fixableErrorCount > 0 ||
        fileResult.fixableWarningCount > 0
      ) {
        let fileContent = readFileSync(fileResult.filePath, 'utf8');
        const fixes = fileResult.messages
          .filter(m => m.fix && m.fix.range && !m.fix.format) // Ensure fix is defined and has a range
          .sort((a, b) => b.fix!.range[0] - a.fix!.range[0]); // Use non-null assertion
        const relativePath = path.relative(
          process.cwd(),
          fileResult.filePath,
        );
        // console.log(
        //   colors.green(`Applying fixes for ${relativePath}...`),
        // );

        for (const message of fixes) {
          const { range, text } = message.fix!; // Use non-null assertion
          fileContent =
            fileContent.substring(0, range[0]) +
            text +
            fileContent.substring(range[1]);
        }

        const formatFixes = fileResult.messages.filter(
          m => m.fix && m.fix.format,
        ); // Ensure fix is defined and has

        for (const message of formatFixes) {
          if (message.fix?.format) {
            console.log(
              colors.gray(`  Applying format fix for ${relativePath} ...`),
            );
            fileContent = (await message.fix.format(fileContent)) as string;
          }
        }
        writeFileSync(fileResult.filePath, fileContent, 'utf8');
      }
    }
  }
}

// CLI functionality starts here
async function loadConfig(configPath: string | null): Promise<DefaultConfig> {
  if (!configPath) {
    const defaultJsConfig = path.resolve(process.cwd(), '.notelintrc.js');
    const defaultJsonConfig = path.resolve(process.cwd(), '.notelintrc.json');
    const packageJsonPath = path.resolve(process.cwd(), 'package.json');

    if (existsSync(defaultJsConfig)) {
      const configModule = await import(defaultJsConfig);
      return configModule.default;
    } else if (existsSync(defaultJsonConfig)) {
      return JSON.parse(readFileSync(defaultJsonConfig, 'utf8'));
    } else if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      if (packageJson.notelint) {
        return packageJson.notelint;
      }
    }
    return DEFAULT_CONFIG;
  }

  const resolvedPath = path.resolve(process.cwd(), configPath);
  if (!existsSync(resolvedPath)) {
    console.error(
      colors.red(`Error: Configuration file not found at ${resolvedPath}`),
    );
    process.exit(1);
  }

  if (resolvedPath.endsWith('.js')) {
    const configModule = await import(resolvedPath);
    return configModule.default;
  } else if (resolvedPath.endsWith('.json')) {
    return JSON.parse(readFileSync(resolvedPath, 'utf8'));
  } else {
    console.error(
      colors.red(
        `Error: Unsupported configuration file format for ${resolvedPath}`,
      ),
    );
    process.exit(1);
  }
}

function findMarkdownFiles(
  dir: string,
  ignorePatterns: string[] = ['node_modules'],
): string[] {
  let files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (ignorePatterns.some(pattern => fullPath.includes(pattern))) {
      continue;
    }

    if (entry.isDirectory()) {
      files = files.concat(findMarkdownFiles(fullPath, ignorePatterns));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

export async function main(
  inputFiles: string[] = [],
  prettierFix?: boolean,
): Promise<void> {
  const args = process.argv.slice(2);
  const files: string[] = inputFiles;
  let fix = false;
  let configPath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--fix') {
      fix = true;
    } else if (arg === '-c' || arg === '--config') {
      if (i + 1 < args.length) {
        configPath = args[++i];
      } else {
        console.error(colors.red('Error: --config requires a path.'));
        process.exit(1);
      }
    }
  }

  if (files.length === 0) {
    console.log(
      colors.yellow('[Note Linter] No markdown files found to lint.'),
    );
    process.exit(0);
  }

  let filePaths: string[] = [];
  for (const pattern of files) {
    if (pattern.includes('**') || pattern.includes('*')) {
      const baseDir = path.dirname(
        pattern.split('**')[0] || pattern.split('*')[0] || '.',
      );
      filePaths = filePaths.concat(
        findMarkdownFiles(path.resolve(process.cwd(), baseDir)).filter(
          filePath => {
            return filePath.endsWith('.md') || filePath.endsWith('.mdx');
          },
        ),
      );
    } else {
      const resolvedPath = path.resolve(process.cwd(), pattern);
      if (
        existsSync(resolvedPath) &&
        statSync(resolvedPath).isFile() &&
        (resolvedPath.endsWith('.md') || resolvedPath.endsWith('.mdx'))
      ) {
        filePaths.push(resolvedPath);
      } else {
        console.warn(
          colors.yellow(
            `Warning: File not found or not a markdown file: ${pattern}`,
          ),
        );
      }
    }
  }
  filePaths = [...new Set(filePaths)];

  if (filePaths.length === 0) {
    console.log(
      colors.yellow(
        '[Note Linter] No markdown files matched paths found to lint.',
      ),
    );
    process.exit(0);
  }

  const config = await loadConfig(configPath);
  const linter = new NoteLint();
  const results = await linter.lintFiles(filePaths, config);

  if (fix) {
    await linter.applyFixes(results);
    const fixedErrors = results.fixableErrorCount;
    const fixedWarnings = results.fixableWarningCount;
    const fixedFiles = results.results.filter(
      r => r.fixableErrorCount > 0 || r.fixableWarningCount > 0,
    ).length;

    if (fixedErrors > 0 || fixedWarnings > 0) {
      console.log(
        colors.green(
          `✓ Fixed ${fixedErrors} errors and ${fixedWarnings} warnings in ${fixedFiles} files`,
        ),
      );
      for (const fileResult of results.results) {
        if (
          fileResult.fixableErrorCount > 0 ||
          fileResult.fixableWarningCount > 0
        ) {
          console.log(
            colors.gray(
              `  ${fileResult.filePath}: ${fileResult.fixableErrorCount + fileResult.fixableWarningCount} issues fixed`,
            ),
          );
        }
      }
    } else {
      const colorSummary =
        results.errorCount > 0
          ? colors.red
          : results.warningCount > 0
            ? colors.yellow
            : colors.green;
      console.log(
        colorSummary(
          `✖ ${results.errorCount} errors, ${results.warningCount} warnings (0 fixable)`,
        ),
      );
    }
  } else {
    let totalErrors = results.errorCount;
    let totalWarnings = results.warningCount;
    let totalFixableErrors = results.fixableErrorCount;
    let totalFixableWarnings = results.fixableWarningCount;

    for (const fileResult of results.results) {
      if (fileResult.messages.length > 0) {
        console.log(colors.gray(fileResult.filePath));
        for (const message of fileResult.messages) {
          const isPrettierFix =
            Boolean(message.ruleId === MARKDOWN_RULES_NAME.PRETTIER && prettierFix && message.fix?.format);
          if (isPrettierFix) {
            const { messages: _ignoredMsgs, ...rest } = fileResult;
            // Apply Prettier fixes
            await linter.applyFixes({
              results: [
                {
                  ...rest,
                  // This is a hack to apply Prettier fixes only
                  messages: [message],
                },
              ],
            } as LintResults);
            // Adjust counts for Prettier fixes
            if (message.severity === 2) {
              totalErrors--;
              totalFixableErrors--;
            }
            if (message.severity === 1) {
              totalWarnings--;
              totalFixableWarnings--;
            }
            continue; // Skip logging for Prettier fixes
          }
          const severityColor =
            message.severity === 2 ? colors.red : colors.yellow;
          const severityText = message.severity === 2 ? 'error' : 'warning';
          const isIncludedBreakLine =
            message.message.includes('\n') ||
            message.message.includes('\r\n');
          if (isIncludedBreakLine) {
            const lines = message.message.split(/\r?\n/);
            lines.forEach((line, index) => {
              console.log(
                `  ${colors.blue(`${message.line}:${message.column}`)}   ${severityColor(severityText)}    ${line}  ${colors.gray(message.ruleId)}`,
              );
            })
          } else {
            console.log(
              `  ${colors.blue(`${message.line}:${message.column}`)}   ${severityColor(severityText)}    ${message.message}  ${colors.gray(message.ruleId)}`,
            );
          }
        }
      }
    }

    const summaryColor =
      totalErrors > 0
        ? colors.red
        : totalWarnings > 0
          ? colors.yellow
          : colors.green;
    const summaryText: string[] = [];
    if (totalErrors > 0) summaryText.push(`${totalErrors} errors`);
    if (totalWarnings > 0) summaryText.push(`${totalWarnings} warnings`);

    const fixableSummary: string[] = [];
    if (totalFixableErrors > 0)
      fixableSummary.push(`${totalFixableErrors} errors`);
    if (totalFixableWarnings > 0)
      fixableSummary.push(`${totalFixableWarnings} warnings`);

    let finalSummary = '';
    if (totalErrors > 0 || totalWarnings > 0) {
      finalSummary = `✖ ${summaryText.join(', ')}`;
      if (fixableSummary.length > 0) {
        finalSummary += ` (${fixableSummary.join(', ')} potentially fixable with --fix)`;
      } else {
        finalSummary += ` (0 fixable)`;
      }
    } else {
      finalSummary = `✓ No issues found!`;
    }
    console.log(summaryColor(finalSummary));

    if (totalErrors > 0) {
      process.exit(1);
    }
  }
}
