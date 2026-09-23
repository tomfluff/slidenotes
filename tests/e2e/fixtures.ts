import { test as base } from '@playwright/test';

/**
 * Every test runs with third-party analytics blocked, so a slow or unreachable
 * analytics host on a CI runner can never stall page loads or add noise to assertions.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(/googletagmanager\.com|google-analytics\.com/, (route) => route.abort());
    await use(context);
  },
});
export { expect } from '@playwright/test';
