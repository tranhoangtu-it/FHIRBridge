/**
 * Import Page E2E tests.
 * Covers: page load, dropzone visibility, CSV file upload, preview/mapping appearance.
 */

import { test, expect } from '@playwright/test';
import * as path from 'path';
import { ImportPage } from './pages/import.page';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

test.describe('Import Page', () => {
  test('loads the import page', async ({ page }) => {
    const importPage = new ImportPage(page);
    await importPage.goto();
    await expect(page.getByText(/import file/i).first()).toBeVisible();
  });

  test('shows page description text', async ({ page }) => {
    await page.goto('/import');
    await expect(page.getByText(/upload csv|xlsx|fhir json/i).first()).toBeVisible();
  });

  test('file dropzone area is visible', async ({ page }) => {
    const importPage = new ImportPage(page);
    await importPage.goto();
    // FileDropzone component is always rendered in upload stage
    const dropzoneOrInput = page.locator('input[type="file"]').first();
    await expect(dropzoneOrInput).toBeAttached();
  });

  test('file input accepts CSV MIME type', async ({ page }) => {
    await page.goto('/import');
    const fileInput = page.locator('input[type="file"]').first();
    const accept = await fileInput.getAttribute('accept');
    // Accept attribute should reference csv or be unrestricted
    if (accept) {
      expect(accept.toLowerCase()).toMatch(/csv|xlsx|json|\*/);
    }
  });

  test('uploading a CSV file triggers preview stage', async ({ page }) => {
    const importPage = new ImportPage(page);
    await importPage.goto();
    await importPage.uploadFixture('test-patients.csv');
    // Preview heading or file name should appear
    await expect(
      page
        .getByText(/preview/i)
        .or(page.getByText(/test-patients\.csv/i))
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('uploading a FHIR JSON bundle shows file name', async ({ page }) => {
    const importPage = new ImportPage(page);
    await importPage.goto();
    const bundlePath = path.join(FIXTURES_DIR, 'test-bundle.json');
    await importPage.fileInput.setInputFiles(bundlePath);
    // File name or preview indicator should appear
    await expect(
      page
        .getByText(/test-bundle\.json/i)
        .or(page.getByText(/preview/i))
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('sidebar navigation is present', async ({ page }) => {
    await page.goto('/import');
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
  });
});
