import { test, expect } from '@playwright/test';

test.describe('RBAC mock flows', () => {
  test('staff cannot access settings; owner can and can change roles', async ({
    page,
  }) => {
    // Sign in as staff (mock quick sign-in)
    await page.goto('/auth/signin');
    await page.getByRole('button', { name: /Sign in as Staff/i }).click();
    await page.waitForURL(/\/jobs/);

    // Staff should see forbidden message on settings
    await page.goto('/settings');
    await expect(
      page.getByText('Only owners can view and edit settings.'),
    ).toBeVisible();

    // Now sign in as owner
    await page.goto('/auth/signin');
    await page.getByRole('button', { name: /Sign in as Owner/i }).click();
    await page.waitForURL(/\/jobs/);

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Team & Roles' }),
    ).toBeVisible();

    // Change staff role to owner then back to staff to verify UI updates
    const staffRow = page
      .locator('table >> text=Staff User')
      .locator('xpath=ancestor::tr[1]');
    const roleSelect = staffRow.locator('select');
    await expect(roleSelect).toHaveValue('staff');
    await roleSelect.selectOption('owner');
    await expect(roleSelect).toHaveValue('owner');
    await roleSelect.selectOption('staff');
    await expect(roleSelect).toHaveValue('staff');
  });
});
