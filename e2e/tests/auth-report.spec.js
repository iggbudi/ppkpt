const { test, expect } = require('@playwright/test');

test('login and secret report flow', async ({ page, request }) => {
  const email = `e2e.user.${Date.now()}@test.local`;
  const password = 'E2e@Test123';

  const registerRes = await request.post('/api/auth/register', {
    data: {
      name: 'E2E User',
      email,
      password,
      status: 'Mahasiswa',
      instansi: 'Universitas E2E',
      peran: 'Informatika'
    }
  });
  expect(registerRes.ok()).toBeTruthy();

  await page.goto('/#login');
  await page.fill('#loginEmail', email);
  await page.fill('#loginPass', password);
  await page.locator('#page-login form button[type="submit"]').click();
  await page.waitForFunction(() => window.location.hash === '#dashboard');

  await page.goto('/#lapor');
  await page.locator('#choiceRahasia').click();
  await page.locator('#safetySafe').click();
  await page.selectOption('#category', 'Verbal');
  await page.fill('#location', 'Ruang E2E');
  await page.fill('#incidentDate', '2026-06-13');
  await page.selectOption('#urgent', 'Rendah');
  await page.locator('#nextStep1').click();
  await page.fill('#description', 'Laporan rahasia dari Playwright E2E');
  await page.locator('#nextStep2').click();
  await page.locator('#nextStep3').click();
  await page.locator('#reportForm button[type="submit"]').click();
  await expect(page.locator('#reportResult')).toContainText('Berhasil');
});

test('anonymous report flow', async ({ page }) => {
  await page.goto('/#lapor');
  await page.locator('#choiceAnonim').click();
  await page.locator('#safetySafe').click();
  await page.selectOption('#category', 'Verbal');
  await page.fill('#location', 'Koridor E2E');
  await page.fill('#incidentDate', '2026-06-13');
  await page.selectOption('#urgent', 'Rendah');
  await page.locator('#nextStep1').click();
  await page.fill('#description', 'Laporan anonim Playwright');
  await page.locator('#nextStep2').click();
  await page.locator('#nextStep3').click();
  await page.locator('#reportForm button[type="submit"]').click();
  await expect(page.locator('#reportResult')).toContainText('Berhasil');
});