import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    outDir: 'dist',
  },
  {
    entry: ['src/cli/index.ts'],
    format: ['esm'],
    outDir: 'dist/cli',
    clean: false,
    shebang: '#!/usr/bin/env node',
  },
]);
