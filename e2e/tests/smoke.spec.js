const { test, expect } = require('@playwright/test');

test('beranda loads and pilot banner visible', async ({ page }) => {
  await page.goto('/#beranda');
  await expect(page.locator('h1, h2').first()).toBeVisible();
  await expect(page.locator('#pilotBanner')).toContainText('Pilot SafeSphere');
});

test('health endpoint returns operational checks', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.service).toBe('safesphere-chat');
  expect(body.checks.database.healthy).toBe(true);
});