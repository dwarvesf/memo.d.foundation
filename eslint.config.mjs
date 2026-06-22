import nextCoreWebVitals from 'eslint-config-next';
import nextTypescript from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier';

// Use eslint-config-next's native flat configs directly (Next 16+). The
// previous FlatCompat-based extends of the legacy eslintrc-format
// `next/core-web-vitals` crashed under eslint-plugin-react's flat export
// (circular `plugins.react` when @eslint/eslintrc stringified config errors).
const eslintConfig = [
  // Global ignores must live in their own config object (no `files`),
  // otherwise they only filter the file-scoped block they sit in.
  {
    ignores: ['scripts/**', 'out/**', '.next/**', 'public/content/**'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettierConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'error',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // React Compiler analysis now ships enabled-by-default inside
      // eslint-plugin-react-hooks v7 (pulled by eslint-config-next 16). The
      // project does not opt into React Compiler (no `reactCompiler` in
      // next.config.ts), so these optimization checks would flag pre-existing
      // patterns as errors. Keep the classic rules-of-hooks / exhaustive-deps
      // (inherited above) and opt out of the compiler-specific ruleset.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/gating': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/unsupported-syntax': 'off',
      'react-hooks/config': 'off',
    },
  },
];

export default eslintConfig;
