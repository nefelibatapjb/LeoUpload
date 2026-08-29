import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['svelte', 'svelte/store', '@leoupload/core'],
  platform: 'browser',
  target: 'es2020',
});
