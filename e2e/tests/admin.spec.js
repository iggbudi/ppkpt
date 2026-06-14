const { test, expect } = require('@playwright/test');

test('admin login and dashboard access', async ({ page, request }) => {
  const loginRes = await request.post('/api/auth/login', {
    data: {
      username: 'e2eadmin',
      password: 'e2e-admin-password-secure'
    }
  });
  expect(loginRes.ok()).toBeTruthy();
  const cookie = loginRes.headers()['set-cookie']?.split(';')[0];
  expect(cookie).toBeTruthy();

  await page.context().addCookies([{
    name: cookie.split('=')[0],
    value: cookie.split('=')[1],
    url: process.env.E2E_BASE_URL || 'http://127.0.0.1:3020'
  }]);

  await page.goto('/#admin');
  await page.waitForFunction(() => window.location.hash === '#admin');
  await expect(page.locator('#adminDashboardArea')).toBeVisible();
  await expect(page.locator('#m-total')).toBeVisible();
});