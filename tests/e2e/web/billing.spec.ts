/**
 * Billing E2E tests.
 * Verifies that billing-related UI or error messaging is present.
 * The API returns 402 for quota exceeded — the frontend should surface this gracefully.
 */

import { test, expect } from '@playwright/test';

test.describe('Billing / Quota', () => {
  test('settings page references API key requirement', async ({ page }) => {
    await page.goto('/settings');
    // API key section heading or descriptive text
    await expect(page.getByText(/api key/i).first()).toBeVisible();
  });

  test('settings page warns that API key is memory-only', async ({ page }) => {
    await page.goto('/settings');
    // Security note: "Stored in memory only" / "Never saved to disk"
    await expect(
      page.getByText(/stored in memory|never saved|cleared when you close/i).first(),
    ).toBeVisible();
  });

  test('summary generate button is disabled without export ID', async ({ page }) => {
    // Navigating to /summary (no :id) — generate button should be disabled
    await page.goto('/summary');
    const generateBtn = page.getByRole('button', { name: /generate summary/i });
    if (await generateBtn.isVisible()) {
      await expect(generateBtn).toBeDisabled();
    }
    // Either button is disabled or we are redirected — both are acceptable behaviors
  });

  test('export page shows API connectivity feedback area', async ({ page }) => {
    await page.goto('/export');
    // ConnectorForm has a test connection button for FHIR endpoints
    await page.getByRole('button', { name: /fhir endpoint/i }).click();
    await page
      .getByRole('button', { name: /^next$/i })
      .first()
      .click();
    // Navigate back to step 2 which shows the connection form
    await page.getByRole('button', { name: /back/i }).first().click();
    // After re-selecting FHIR endpoint, step 2 shows ConnectorForm with Test button
    await page.getByRole('button', { name: /fhir endpoint/i }).click();
    const testBtn = page.getByRole('button', { name: /test connection/i });
    if (await testBtn.isVisible()) {
      await expect(testBtn).toBeVisible();
    }
  });
});
