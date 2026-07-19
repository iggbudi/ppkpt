const { test, expect } = require('@playwright/test');

test('beranda loads with protective entry message', async ({ page }) => {
  await page.goto('/#beranda');
  await expect(page.locator('#homeHeading')).toHaveText('Anda tidak sendirian.');
  await expect(page.locator('#pilotBanner')).toContainText('Anda berhak merasa aman');
});

test('health endpoint returns operational checks', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.service).toBe('safesphere-chat');
  expect(body.checks.database.healthy).toBe(true);
});