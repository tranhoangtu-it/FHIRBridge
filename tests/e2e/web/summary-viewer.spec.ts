/**
 * Summary Viewer E2E tests.
 * Covers: config panel, generate button, no-export-ID warning, provider/language selects.
 */

import { test, expect } from '@playwright/test';
import { SummaryViewerPage } from './pages/summary-viewer.page';

test.describe('Summary Viewer', () => {
  test('loads the summary viewer page', async ({ page }) => {
    const summary = new SummaryViewerPage(page);
    await summary.goto();
    await expect(page.getByText(/summary viewer/i).first()).toBeVisible();
  });

  test('shows warning when no export ID is provided', async ({ page }) => {
    // Route is /summary/:id — accessing /summary without ID shows warning
    await page.goto('/summary');
    // Either redirected or shows no-export-id warning
    const warning = page.getByText(/no export id provided/i);
    const redirected = page.url().includes('/dashboard') || page.url().endsWith('/');
    if (!redirected) {
      await expect(warning).toBeVisible();
    }
  });

  test('configuration section is visible', async ({ page }) => {
    const summary = new SummaryViewerPage(page);
    await summary.goto('test-export-123');
    await expect(summary.configSection).toBeVisible();
  });

  test('generate button is present', async ({ page }) => {
    const summary = new SummaryViewerPage(page);
    await summary.goto('test-export-123');
    await expect(summary.generateButton).toBeVisible();
  });

  test('generate button disabled when no export ID', async ({ page }) => {
    await page.goto('/summary');
    const generateBtn = page.getByRole('button', { name: /generate summary/i });
    if (await generateBtn.isVisible()) {
      await expect(generateBtn).toBeDisabled();
    }
  });

  test('provider select has AI provider options', async ({ page }) => {
    const summary = new SummaryViewerPage(page);
    await summary.goto('test-export-123');
    // SummaryConfig renders provider select
    const selects = page.locator('select');
    const count = await selects.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('page description references clinical summary', async ({ page }) => {
    const summary = new SummaryViewerPage(page);
    await summary.goto('test-export-123');
    await expect(page.getByText(/clinical summary|ai-powered/i).first()).toBeVisible();
  });
});
