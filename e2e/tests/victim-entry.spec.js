const { test, expect } = require('@playwright/test');

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('homepage prioritizes anonymous reporting and emergency help', async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await page.goto('/#beranda');

  await expect(page.locator('#homeHeading')).toHaveText('Kamu nggak sendirian.');
  await expect(page.locator('#heroAnonymousCta')).toBeVisible();
  await expect(page.locator('#heroEmergencyCta')).toHaveAttribute('href', '#kontak');
  await expect(page.locator('.trust-list')).toContainText('Identitas akun tidak dicatat');
  await expect(page.locator('#processHeading')).toHaveText('Apa yang terjadi setelah kamu melapor?');
  expect(pageErrors).toEqual([]);
});

test('anonymous CTA works while authentication lookup is pending', async ({ page }) => {
  let releaseAuth;
  const authGate = new Promise((resolve) => { releaseAuth = resolve; });

  await page.route('**/api/auth/me', async (route) => {
    await authGate;
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Not authenticated' }) });
  });

  await page.goto('/#beranda');
  await page.locator('#heroAnonymousCta').click();
  await expect(page).toHaveURL(/#lapor$/);
  await expect(page.locator('#safetyCheck')).toBeVisible();

  const authResponse = page.waitForResponse((response) => response.url().includes('/api/auth/me'));
  releaseAuth();
  await authResponse;
});

test('anonymous CTA reaches safety check in one activation and safe path focuses form', async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await page.goto('/#beranda');

  await page.locator('#heroAnonymousCta').click();
  await expect(page).toHaveURL(/#lapor$/);
  await expect(page.locator('#reportChoiceScreen')).toBeHidden();
  await expect(page.locator('#reportFormSection')).toBeVisible();
  await expect(page.locator('#safetyCheckHeading')).toBeFocused();
  await expect(page.locator('#isAnonymous')).toBeChecked();

  await page.locator('#safetySafe').click();
  await expect(page.locator('#reportForm')).toBeVisible();
  await expect(page.locator('#category')).toBeFocused();
  expect(pageErrors).toEqual([]);
});

test('emergency and confidential paths have explicit destinations', async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await page.goto('/#beranda');

  await page.locator('#heroEmergencyCta').click();
  await expect(page).toHaveURL(/#kontak$/);
  await expect(page.locator('#page-kontak')).toBeVisible();
  await expect(page.locator('.emergency-contact').first()).toHaveAttribute('href', 'tel:110');
  await expect(page.locator('#page-kontak')).not.toContainText('XXX-XXXX');
  await expect(page.locator('#page-kontak')).not.toContainText('@kampus.edu');

  await page.goto('/#beranda');
  await page.locator('#heroAnonymousCta').click();
  await page.locator('#safetyDanger').click();
  await expect(page).toHaveURL(/#kontak$/);
  await expect(page.locator('#page-kontak')).toBeVisible();

  await page.goto('/#lapor');
  await expect(page.locator('#reportChoiceScreen')).toBeVisible();
  await page.locator('#chooseRahasiaBtn').click();
  await expect(page).toHaveURL(/#login$/);
  await expect(page.locator('#page-login')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('entry flow works by keyboard and quick escape remains available', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#beranda');

  await page.locator('#hamburgerBtn').click();
  await expect(page.locator('#sidebar')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#sidebar')).not.toHaveAttribute('inert', '');
  await expect(page.locator('#sidebarClose')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#sidebar')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#sidebar')).toHaveAttribute('inert', '');
  await expect(page.locator('#hamburgerBtn')).toBeFocused();

  await page.locator('#heroAnonymousCta').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#safetyCheck')).toBeVisible();

  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.locator('#discreetOverlay')).toHaveClass(/is-active/);
  await expect(page.locator('#discreetCloseBtn')).toBeFocused();
  await expect(page.locator('main')).toHaveAttribute('inert', '');
  await expect(page.locator('main')).toHaveAttribute('aria-hidden', 'true');

  await page.keyboard.press('Tab');
  await expect(page.locator('#discreetCloseBtn')).toBeFocused();

  await page.locator('#discreetCloseBtn').click();
  await expect(page.locator('main')).not.toHaveAttribute('inert', '');
  await expect(page.locator('main')).not.toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#safetyCheckHeading')).toBeFocused();
});

test('entry reflows without overflow and honors reduced motion', async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const width of [320, 390, 768, 950, 1440]) {
    await page.setViewportSize({ width, height: width < 700 ? 720 : 900 });
    await page.goto('/#beranda');

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      pageAnimationDuration: getComputedStyle(document.querySelector('.page.active')).animationDuration
    }));

    expect(dimensions.scrollWidth, `homepage horizontal overflow at ${width}px`).toBeLessThanOrEqual(dimensions.clientWidth);
    expect(['0s', '0.00001s', '1e-05s']).toContain(dimensions.pageAnimationDuration);

    await page.goto('/#lapor');
    const choiceOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(choiceOverflow, `report choice horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);

    await page.locator('#chooseAnonimBtn').click();
    const safetyLayout = await page.evaluate(() => {
      const emergency = document.querySelector('#safetyDanger').getBoundingClientRect();
      const widget = document.querySelector('#a11yWidget').getBoundingClientRect();
      const overlaps = !(emergency.right <= widget.left || emergency.left >= widget.right || emergency.bottom <= widget.top || emergency.top >= widget.bottom);
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        widgetOverlapsEmergency: overlaps
      };
    });
    expect(safetyLayout.overflow, `safety check horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
    expect(safetyLayout.widgetOverlapsEmergency, `accessibility widget overlaps emergency action at ${width}px`).toBeFalsy();
  }

  await expect(page.locator('#safetyDanger')).toBeVisible();

  await page.evaluate(() => document.body.classList.add('a11y-high-contrast'));
  const dangerContrast = await page.locator('#safetyDanger').evaluate((element) => {
    function luminance(color) {
      const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((value) => {
        const normalized = value / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
      });
      return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
    }
    const styles = getComputedStyle(element);
    const foreground = luminance(styles.color);
    const background = luminance(styles.backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(dangerContrast).toBeGreaterThanOrEqual(4.5);
  expect(pageErrors).toEqual([]);
});
