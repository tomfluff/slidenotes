import { defineConfig, devices } from '@playwright/test';

// Runs against the production build served by `vite preview` with the real base
// path, so a broken `base` fails here instead of on GitHub Pages.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  fullyParallel: true,
  retries: 0,
  // The list reporter prints each test as it finishes, so a stalled CI run still shows
  // which test hung; the GitHub reporter only reports at the end.
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
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
