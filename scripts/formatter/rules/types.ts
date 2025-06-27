// Define types for better type safety
export interface Colors {
  red: (text: string) => string;
  yellow: (text: string) => string;
  gray: (text: string) => string;
  green: (text: string) => string;
  blue: (text: string) => string;
}

export interface RuleConfig {
  [key: string]: string | [string | number, any];
}

export interface DefaultConfig {
  rules: RuleConfig;
}

export interface LintMessage {
  ruleId: string;
  severity: number;
  message: string;
  fixableCount?: number; // Number of fixable issues
  line: number;
  column: number;
  nodeType: string;
  fix?: {
    range: [number, number];
    text: string;
    format?: (content: string) => string | Promise<string>;
  };
}

export interface FileLintResult {
  filePath: string;
  messages: LintMessage[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
}

export interface LintResults {
  results: FileLintResult[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
}

export interface RuleContext {
  filePath: string;
  config: DefaultConfig;
  severity: number;
  options: any;
  report: (
    message: Omit<LintMessage, 'severity'> & {
      severity?: number;
    },
  ) => void;
  getSourceCode: () => string;
  getFrontmatter: () => { [key: string]: any };
  getMarkdownContent: () => string;
}

type CheckRuleModule = { check: () => void | Promise<void> };

export interface RuleModule {
  meta: {
    type: string;
    docs: {
      description: string;
      category: string;
      recommended: boolean;
    };
    fixable: 'code' | null;
    schema: any[];
    isRunFormatAfterAll?: boolean;
  };
  create: (context: RuleContext) => Promise<CheckRuleModule> | CheckRuleModule;
}
