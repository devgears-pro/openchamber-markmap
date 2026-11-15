import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/screenshots',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5193',
    headless: true,
    colorScheme: 'dark',
  },
  webServer: {
    command: 'bunx vite --host 127.0.0.1 --port 5193 --strictPort',
    url: 'http://127.0.0.1:5193/dev/',
    reuseExistingServer: process.env['CI'] === undefined,
    timeout: 30_000,
  },
});
