const { test, expect } = require('@playwright/test');

test('chat consent and safebot reply', async ({ page }) => {
  await page.goto('/#chat');
  await page.evaluate(() => sessionStorage.setItem('chatConsent', 'true'));
  await page.reload();

  await page.fill('#chatInput', 'Saya merasa diintimidasi di kelas');
  await page.locator('#chatSendBtn').click();
  await expect(page.locator('.chat-message.bot').last()).toBeVisible({ timeout: 30000 });
});

test('quick escape activates discreet overlay via double Escape', async ({ page }) => {
  await page.goto('/#lapor');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.locator('#discreetOverlay')).toHaveClass(/is-active/);
  await expect(page.locator('#discreetCloseBtn')).toBeVisible();
  await page.locator('#discreetCloseBtn').click();
  await expect(page.locator('#discreetOverlay')).not.toHaveClass(/is-active/);
});

test('quick escape cancels active file upload during report submit', async ({ page }) => {
  const fakeReportId = 'SSF-request-was-not-aborted';

  // A successful delayed response would render fakeReportId if AbortController did not cancel fetch.
  await page.route('**/api/reports', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ report: { id: fakeReportId }, evidence: [] })
    });
  });

  await page.goto('/#lapor');

  // Choose anonymous report
  await page.locator('#choiceAnonim button').click();

  // Pass safety check
  await page.locator('#safetySafe').click();

  // Step 1: fill required fields
  await page.selectOption('#category', 'Verbal');
  await page.fill('#location', 'Test lokasi quick escape');
  await page.fill('#incidentDate', '2026-06-10');
  await page.selectOption('#urgent', 'Rendah');
  await page.locator('#nextStep1').click();

  // Step 2: description
  await page.fill('#description', 'Test deskripsi untuk escape saat upload bukti sedang berjalan.');
  await page.locator('#nextStep2').click();

  // Step 3: select a small valid PNG file (client accepts it)
  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  await page.setInputFiles('#evidenceFiles', {
    name: 'escape-test.png',
    mimeType: 'image/png',
    buffer: tinyPng
  });

  // Advance to review & submit
  await page.locator('#nextStep3').click();

  // Start submit (this triggers the multipart fetch with files)
  const submitBtn = page.locator('#reportForm button[type="submit"]');
  await submitBtn.click();

  // Immediately trigger quick escape (double Escape)
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // Verify escape worked and the submit handler observed AbortError, not the delayed success.
  await expect(page.locator('#discreetOverlay')).toHaveClass(/is-active/, { timeout: 5000 });
  await expect(page.locator('#discreetCloseBtn')).toBeVisible();
  await expect(page.locator('#reportResult')).toContainText('Pengiriman dibatalkan.');
  await expect(page.locator('#reportResult')).not.toContainText(fakeReportId);

  // File UI should be reset by quickEscape (list hidden, dropzone default)
  const fileList = page.locator('#fileList');
  await expect(fileList).toHaveCSS('display', 'none');

  const dropZoneP = page.locator('#fileDropZone p').first();
  await expect(dropZoneP).toContainText(/Klik atau seret file ke sini/i);

  // Close overlay
  await page.locator('#discreetCloseBtn').click();
  await expect(page.locator('#discreetOverlay')).not.toHaveClass(/is-active/);
});