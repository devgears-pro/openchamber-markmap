import { defineConfig } from 'vite';

export default defineConfig({
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
