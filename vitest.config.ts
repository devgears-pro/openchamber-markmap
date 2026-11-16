import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const vendor = (path: string): string =>
  fileURLToPath(new URL(`./vendor/markmap/packages/${path}/dist/index.js`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@markmap/core': vendor('core'),
      '@markmap/render': vendor('render'),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'json-summary'],
      reportOnFailure: true,
      thresholds: {
        100: true,
        perFile: {
          100: true,
        },
      },
    },
  },
});
