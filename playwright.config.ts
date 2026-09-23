import { defineConfig, devices } from '@playwright/test';

// Runs against the production build served by `vite preview` with the real base
// path, so a broken `base` fails here instead of on GitHub Pages.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/slidenotes/',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173/slidenotes/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
