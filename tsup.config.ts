import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  splitting: false,
  target: 'es2017',
  format: ['cjs'],
  entry: ['scripts/formatter/ci-lint.ts'],
  outDir: 'out/tools',
  shims: true,
  noExternal: ['gray-matter', 'js-yaml', 'esprima'],
});
