import { test, expect } from '@playwright/test';

test('redirects to overview page root', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/\/overview/);
  expect(page.url()).toContain('/overview');
});
