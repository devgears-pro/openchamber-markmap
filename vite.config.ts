import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'editor',
    emptyOutDir: false,
    sourcemap: false,
    lib: {
      entry: 'src/main.ts',
      name: 'OpenChamberMarkmap',
      formats: ['iife'],
      fileName: () => 'main.js',
    },
  },
});
