import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  splitting: false,
  target: 'es2019',
  format: ['cjs'],
  entry: ['scripts/formatter/ci-lint.js'],
  outDir: 'out/tools',
  shims: true,
  noExternal: ['gray-matter'],
});
