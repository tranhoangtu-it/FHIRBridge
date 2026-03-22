/**
 * Settings E2E tests.
 * Covers: API key input masking, provider/language dropdowns, theme toggle, save feedback.
 */

import { test, expect } from '@playwright/test';
import { SettingsPage } from './pages/settings.page';

test.describe('Settings', () => {
  test('loads the settings page', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await expect(page.getByText(/settings/i).first()).toBeVisible();
  });

  test('API key input exists and is masked by default', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await expect(settings.apiKeyInput).toBeVisible();
    // Should be type=password (masked) by default
    await expect(settings.apiKeyInput).toHaveAttribute('type', 'password');
  });

  test('show/hide API key button reveals and masks the key', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.fillApiKey('sk-test-key-12345');
    // Click show key
    await settings.showHideKeyButton.click();
    await expect(settings.apiKeyInput).toHaveAttribute('type', 'text');
    // Click hide key
    await settings.showHideKeyButton.click();
    await expect(settings.apiKeyInput).toHaveAttribute('type', 'password');
  });

  test('provider dropdown has openai, anthropic, google options', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await expect(settings.providerSelect).toBeVisible();
    const options = await settings.providerSelect.locator('option').allTextContents();
    const lower = options.map((o) => o.toLowerCase());
    expect(lower).toContain('openai');
    expect(lower).toContain('anthropic');
    expect(lower).toContain('google');
  });

  test('language dropdown has English and multiple options', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await expect(settings.languageSelect).toBeVisible();
    const options = await settings.languageSelect.locator('option').allTextContents();
    expect(options.length).toBeGreaterThan(1);
    expect(options).toContain('English');
  });

  test('theme toggle button is visible', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await expect(settings.themeToggle).toBeVisible();
  });

  test('toggling theme changes dark mode class on <html>', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    // Record initial state
    const beforeClass = await page.locator('html').getAttribute('class');
    const initiallyDark = (beforeClass ?? '').includes('dark');
    await settings.toggleTheme();
    const afterClass = await page.locator('html').getAttribute('class');
    const afterDark = (afterClass ?? '').includes('dark');
    // State must have flipped
    expect(afterDark).toBe(!initiallyDark);
  });

  test('save button is visible', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await expect(settings.saveButton).toBeVisible();
  });

  test('save button shows confirmation message after click', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.save();
    await expect(settings.savedConfirmation).toBeVisible();
  });
});
