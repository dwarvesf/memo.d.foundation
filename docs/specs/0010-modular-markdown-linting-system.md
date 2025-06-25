# Modular Markdown Linting System Specification

## 1. Introduction

This document outlines the design and implementation of a refactored and enhanced Markdown linting system for the project. The goal is to replace the previous monolithic `note-lint.js` script with a modular, extensible, and configurable framework capable of enforcing documentation quality and consistency. This system is inspired by modern linting architectures like ESLint, providing a robust foundation for future rule development and automated content correction.

## 2. Goals

- Establish a highly extensible architecture for Markdown linting rules.
- Enable clear separation of concerns between the linter core and individual rules.
- Support configurable severity levels (error, warn) for each rule.
- Implement auto-fixing capabilities for common Markdown violations.
- Provide a rich `context` object to rules, allowing access to file content, reporting functions, and fixing mechanisms.
- Improve the clarity and utility of linting reports with detailed, color-coded output.
- Consolidate rule management through a central index.
- Ensure backward compatibility where feasible, or provide clear migration paths.

## 3. Non-Goals

- Full feature parity with enterprise-grade linters like `markdownlint` (focus is on project-specific needs).
- Complex AST-based parsing for Markdown (line-by-line and regex-based analysis is sufficient for current needs).
- Real-time linting within editors (focus is on CLI-based pre-commit/CI checks).

## 4. Architecture

### 4.1. Core Components

- **`NoteLint` Class (`scripts/formatter/note-lint.js`)**: The central linter engine.
  - Responsible for recursively scanning directories for Markdown files.
  - Loading and managing linting rules.
  - Applying rules to file content.
  - Aggregating and reporting violations.
  - Handling auto-fixing logic.
- **Rule Modules (`scripts/formatter/rules/*.js`)**: Individual JavaScript modules, each defining a specific linting rule.
  - Each module exports an object with `meta` (rule metadata) and `create` (rule implementation) properties.
  - The `create` function receives a `context` object and returns an object containing a `check` method and optionally a `fix` method.
- **`rules/index.js`**: A central entry point that imports and exports all available rule modules, simplifying their inclusion into the `NoteLint` class.

### 4.2. Data Flow

1.  User invokes `node scripts/formatter/note-lint.js <path> [--fix]`.
2.  `NoteLint` instance is created, loading all rules from `rules/index.js`.
3.  `NoteLint` recursively finds all `.md` files in the specified `<path>`.
4.  For each Markdown file:
    a. File content is read.
    b. A `context` object is prepared for the file, including its path, content, and reporting/fixing utilities.
    c. Each enabled rule's `create` function is called with the `context`.
    d. The rule's `check` method is executed, identifying violations.
    e. If violations are found, `context.report()` is called, which records the violation and its associated fix (if any).
    f. If `--fix` flag is present, `NoteLint` applies the suggested fixes to the file content.
5.  After processing all files, `NoteLint` generates a summary report of all errors, warnings, and applied fixes.

## 5. Detailed Design

### 5.1. `NoteLint` Class

- **Constructor**: Initializes `rules` from `allRules.rules` (imported from `rules/index.js`).
- **`lintFiles(filePaths, config)`**: Main entry point for linting multiple files.
  - Iterates through `filePaths`, calling `lintFile` for each.
  - Aggregates results and counts total errors/warnings.
- **`lintFile(filePath, fileContent, config)`**: Lints a single file.
  - Parses frontmatter using `gray-matter`.
  - Creates a `context` object for the rule, including `filePath`, `getSourceCode()`, `getMarkdownContent()`, `report()`, `severity`.
  - Iterates through configured rules, calling their `create` and `check` methods.
  - Collects violations and applies fixes if `--fix` is enabled.
- **`applyFixes(content, messages)`**: Applies fixes to the content based on reported messages with `fix` properties.
- **`formatResults(results)`**: Formats the linting results for console output, including colored messages and summaries.

### 5.2. Rule Interface

Each rule module (`scripts/formatter/rules/*.js`) exports an object with:

- **`meta`**: An object containing:
  - `type`: `'problem'`, `'suggestion'`, or `'layout'` (for categorization).
  - `docs`: `description`, `category`, `recommended`.
  - `fixable`: `'code'` or `'whitespace'` if auto-fixable, `null` otherwise.
  - `schema`: JSON schema for rule options.
- **`create(context)`**: A function that receives a `context` object and returns an object with:
  - **`check()`**: The main function containing the rule's logic to identify violations. It calls `context.report()` for each violation.
  - _(Optional)_ **`fix()`**: A function that returns a `fix` object with `range` and `text` properties for auto-correction.

### 5.3. `Context` Object

Provided to each rule's `create` function, it includes:

- `filePath`: Path to the file being linted.
- `getSourceCode()`: Returns the full content of the file.
- `getMarkdownContent()`: Returns the content of the file _after_ the frontmatter.
- `report({ ruleId, severity, message, line, column, nodeType, fix })`: Function to report a violation. The `fix` property is an object `{ range: [start, end], text: 'replacement' }`.
- `severity`: The configured severity for the current rule.

### 5.4. Rules Implemented/Refactored

- **`markdown/frontmatter`**: Checks for valid YAML frontmatter, required fields, balanced quotes/braces, and duplicate keys. Supports auto-fixing missing required fields.
- **`markdown/no-heading1`**: Warns/errors on H1 headings (`# `) and can auto-fix by converting them to H2 (`## `). Includes an `allowInRoot` option.
- **`markdown/relative-link-exists`**: Checks if relative Markdown links point to existing files. Does not support auto-fixing.

## 6. Configuration

- **Default Configuration**: A `DEFAULT_CONFIG` object in `note-lint.js` defines initial rule severities.
  ```javascript
  const DEFAULT_CONFIG = {
    rules: {
      'markdown/relative-link-exists': 'error',
      'markdown/no-heading1': 'warn',
      'markdown/frontmatter': 'warn',
    },
  };
  ```
- **Future Configuration Loading**: The architecture supports loading configurations from external files (e.g., `.notelintrc.js` or `package.json`) to allow project-specific overrides.

## 7. Testing

- **Unit Tests**: Each rule module should have dedicated unit tests to verify its `check` and `fix` logic against various valid and invalid Markdown snippets.
- **Integration Tests**: Tests for the `NoteLint` class to ensure it correctly loads rules, processes files, applies fixes, and reports results.
- **End-to-End Tests**: Running the CLI against a sample directory with known violations to confirm overall system functionality.

## 8. Future Work

- Implement external configuration loading (e.g., from `.notelintrc.js`).
- Add more linting rules as needed (e.g., line length, image alt text, consistent link styles).
- Integrate with CI/CD pipelines to enforce Markdown quality automatically.
- Consider a plugin system for community-contributed rules.
- Improve performance for very large repositories.
- Add a `--dry-run` option for fixes to preview changes without writing to disk.
