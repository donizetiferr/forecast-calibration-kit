import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
    target: 'node18',
  },
  {
    entry: { cli: 'src/bin.ts' },
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: false,
    treeshake: true,
    target: 'node18',
    banner: { js: '#!/usr/bin/env node' },
  },
]);
