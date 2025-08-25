import { test, expect } from '@playwright/test';

test('redirects to jobs page root', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/\/jobs/);
  expect(page.url()).toContain('/jobs');
});

