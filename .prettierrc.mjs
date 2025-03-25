/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  arrowParens: 'avoid',
  trailingComma: 'all',
  semi: true,
  singleQuote: true,
  printWidth: 80,
  tabWidth: 2,
  plugins: ['prettier-plugin-tailwindcss'],
  useTabs: false,
  bracketSpacing: true
};

export default config;
