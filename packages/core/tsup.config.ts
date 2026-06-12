import { defineConfig } from 'tsup';

export default defineConfig([
  // Main library bundle (ESM + CJS)
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    splitting: false,
    platform: 'browser',
    target: 'es2020',
    outDir: 'dist',
  },
  // Worker script (IIFE, separate file — no deps bundled)
  {
    entry: { worker: 'src/hash/worker.script.ts' },
    format: ['iife'],
    dts: false,
    sourcemap: true,
    clean: false,
    platform: 'browser',
    target: 'es2020',
    outDir: 'dist',
    outExtension: () => ({ js: '.js' }),
    esbuildOptions(options) {
      options.banner = { js: '/* LeoUpload Hash Worker */' };
    },
  },
]);
