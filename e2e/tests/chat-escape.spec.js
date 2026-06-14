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
  await expect(page.locator('#discreetCloseBtn')).toBeFocused();
  await page.locator('#discreetCloseBtn').click();
  await expect(page.locator('#discreetOverlay')).not.toHaveClass(/is-active/);
});