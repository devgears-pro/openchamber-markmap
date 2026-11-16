import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const vendor = (path: string): string =>
  fileURLToPath(new URL(`./vendor/markmap/packages/${path}/dist/index.js`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@markmap/core': vendor('core'),
      '@markmap/render': vendor('render'),
    },
  },
  build: {
    target: 'es2022',
    outDir: 'chat',
    emptyOutDir: false,
    sourcemap: false,
    lib: {
      entry: 'src/chat/main.ts',
      name: 'OpenChamberMarkmapChat',
      formats: ['iife'],
      fileName: () => 'main.js',
    },
  },
});
