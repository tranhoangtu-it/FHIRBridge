/**
 * Error States E2E tests.
 * Covers: unknown routes redirect to dashboard, export page form validation.
 */

import { test, expect } from '@playwright/test';

test.describe('Error States', () => {
  test('unknown route redirects to dashboard', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    // App.tsx has <Navigate to={ROUTES.DASHBOARD} replace /> catch-all
    await expect(page).toHaveURL(/^\/?$/);
    // Dashboard content should be visible
    await expect(page.getByText(/dashboard/i).first()).toBeVisible();
  });

  test('deeply nested unknown route redirects to dashboard', async ({ page }) => {
    await page.goto('/some/deeply/nested/path');
    await expect(page).toHaveURL(/^\/?$/);
  });

  test('export page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/export');
    await expect(page.locator('body')).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test('import page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/import');
    await expect(page.locator('body')).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test('settings page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/settings');
    await expect(page.locator('body')).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test('export step 3 Next button blocked when patient ID empty', async ({ page }) => {
    await page.goto('/export');
    // Step 1: pick FHIR endpoint
    await page.getByRole('button', { name: /fhir endpoint/i }).click();
    // Step 2: click Next
    await page
      .getByRole('button', { name: /^next$/i })
      .first()
      .click();
    // Step 3: Next should be disabled
    const nextBtn = page.getByRole('button', { name: /^next$/i }).first();
    await expect(nextBtn).toBeDisabled();
  });

  test('export Next button enabled after patient ID filled', async ({ page }) => {
    await page.goto('/export');
    await page.getByRole('button', { name: /fhir endpoint/i }).click();
    await page
      .getByRole('button', { name: /^next$/i })
      .first()
      .click();
    await page.locator('#patient-id').fill('patient-999');
    const nextBtn = page.getByRole('button', { name: /^next$/i }).first();
    await expect(nextBtn).toBeEnabled();
  });
});
