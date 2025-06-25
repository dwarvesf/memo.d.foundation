# Modular Markdown Linting System

## Overview

The project's Markdown linting system (`scripts/formatter/note-lint.js`) has undergone a significant refactor to introduce a modular, extensible, and configurable architecture. This enhancement improves the maintainability and effectiveness of our documentation quality checks, allowing for easier addition of new rules and automated fixes.

## Key Features

- **Modular Rules**: Each linting rule (e.g., `frontmatter`, `no-heading1`, `relative-link-exists`) is now an independent module, making the system highly extensible. New rules can be added by simply creating a new file in `scripts/formatter/rules/` and exporting it via `rules/index.js`.
- **Configurable Severity**: Rules can now be configured with different severity levels (`error` or `warn`), providing flexibility in how violations are enforced.
- **Auto-Fixing Capabilities**: Many rules now support automatic correction of issues, reducing manual effort. For example, the `no-heading1` rule can automatically convert H1 headings to H2.
- **Improved Reporting**: The linter provides clearer, color-coded output, summarizing errors, warnings, and fixable issues for better developer experience.
- **ESLint-Inspired Architecture**: The internal design is inspired by ESLint, providing a `Linter` class and a `Rule` interface that offers a `context` object to rules for rich interaction with the file content and reporting mechanisms.

## How to Use

### Running the Linter

From the project root, you can run the linter with a target directory:

```bash
node scripts/formatter/note-lint.js <path-to-directory>
```

Example:

```bash
node scripts/formatter/note-lint.js vault/
```

### Applying Fixes

To automatically fix issues where rules support it, use the `--fix` flag:

```bash
node scripts/formatter/note-lint.js vault/ --fix
```

### Customizing Rules (Future)

While a default configuration is provided, the new architecture supports loading custom configurations. This will allow teams to enable/disable specific rules or change their severity based on project needs.

## Impact

This refactor significantly enhances our ability to maintain high-quality Markdown documentation. It streamlines the process of enforcing writing conventions, reduces manual correction time through auto-fixing, and provides a robust foundation for future expansion of linting capabilities. This leads to more consistent, readable, and reliable project documentation.
