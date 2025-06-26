import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  splitting: false,
  minify: true,
  target: 'es2017',
  format: ['cjs'],
  shims: true,
  noExternal: ['gray-matter', 'js-yaml', 'esprima', 'dotenv'],
  outExtension() {
    return {
      js: `.js`,
    };
  },
});
