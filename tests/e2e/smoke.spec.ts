import { test, expect } from '@playwright/test';

test('API health check returns ok', async ({ request }) => {
  const response = await request.get('http://localhost:3002/api/v1/health');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.status).toBe('ok');
});

test('Web UI loads with correct title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/FHIRBridge/);
});
