# 0012 - Modular Markdown Linting System

## Status

Accepted

## Context

As the project's documentation and knowledge base grow, maintaining consistency, quality, and adherence to specific conventions within Markdown files becomes increasingly important. Manual checks are inefficient and prone to human error. An automated system is needed to enforce rules such as frontmatter presence, heading levels, and valid relative links, while also providing extensibility for future rule additions.

Previously, `note-lint.js` existed but lacked a robust, extensible architecture, proper severity levels, auto-fixing capabilities, and a clear configuration mechanism. Its rule implementation was tightly coupled, making it difficult to add or modify rules.

## Decision

To establish a robust and extensible system for linting Markdown notes, the existing `note-lint.js` script has been refactored and enhanced into a modular, configurable linting framework. This new system is inspired by ESLint's architecture, providing a `Linter` class, a `Rule` interface, and a configuration mechanism.

Key aspects of this decision include:

1.  **Modular Rule System**: Each linting rule is now an independent module, exporting a `meta` object (for rule metadata like description, type, fixability) and a `create` function (which returns an object with `check` and optional `fix` methods).
2.  **Context Object**: Rules receive a `context` object providing access to file content, severity, reporting functions, and auto-fixing capabilities.
3.  **Severity Levels**: Support for `error` and `warn` severities, allowing for flexible enforcement.
4.  **Auto-Fixing**: Rules can define a `fix` property in their reported violations, enabling automatic correction of issues.
5.  **Configuration**: A default configuration is provided, and the system can be extended to load configurations from external files (e.g., `.notelintrc.js` or `package.json`).
6.  **Consolidated Rules**: All rules are imported and exposed via a central `rules/index.js` file, simplifying rule management.
7.  **Improved Reporting**: Enhanced console output with colored messages for better readability and clear summaries of errors, warnings, and fixable issues.

## Consequences

### Positive

- **Extensibility**: New linting rules can be easily added as separate modules without modifying the core linter logic.
- **Maintainability**: Rules are self-contained, making them easier to understand, test, and maintain.
- **Configurability**: Allows project-specific customization of rules and their severity.
- **Automated Corrections**: Auto-fixing capabilities reduce manual effort for common issues.
- **Improved Code Quality**: Ensures higher consistency and quality of Markdown documentation.
- **Clearer Feedback**: Detailed and color-coded output helps developers quickly identify and address violations.

### Negative

- **Increased Complexity**: The new architecture is more complex than the previous monolithic script, requiring a deeper understanding of the linter's internal workings for rule development.
- **Learning Curve**: Developers writing new rules need to understand the `Rule` interface and `context` object.
- **Performance**: While optimized, processing large numbers of Markdown files with many rules might introduce a slight performance overhead compared to a simpler script.

## Alternatives Considered

- **Existing Markdown Linters**: Evaluating and integrating an existing Markdown linter (e.g., `markdownlint`). While powerful, this might introduce external dependencies and potentially limit customization to project-specific rules that are not covered by off-the-shelf solutions.
- **Simpler Scripting**: Continuing with a simpler, less modular script. This would sacrifice extensibility, maintainability, and advanced features like auto-fixing and configurable severities.

## Conclusion

The decision to refactor `note-lint.js` into a modular, ESLint-inspired framework provides the necessary foundation for scalable and maintainable Markdown linting. The benefits of extensibility, configurability, and auto-fixing outweigh the increased initial complexity, positioning the project to effectively manage documentation quality as it evolves.
