import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'benchmarks',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5194',
    headless: true,
    colorScheme: 'light',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: 'bunx vite --host 127.0.0.1 --port 5194 --strictPort',
    url: 'http://127.0.0.1:5194/dev/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
  timeout: 600_000,
});
