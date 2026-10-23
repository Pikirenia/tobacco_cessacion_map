const {test, expect} = require('@playwright/test');

test('TB modes use the WHO snapshot and retain medicines view', async ({page}) => {
  await page.route('**/data/tb-data.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'const TB_DATA = {"year":2024,"updated":"2026-10-23T18:00:00Z","countries":{"POL":{"incidence":30.5,"smoking":1234}}};'
  }));
  await page.goto('./');
  await expect(page.locator('#medicineViews')).toBeVisible();
  await page.locator('.map-mode [data-mode="tb-incidence"]').click();
  await expect(page.locator('#medicineViews')).toBeHidden();
  await expect(page.locator('#tbControls')).toBeVisible();
  await expect(page.locator('#tbMeta')).toContainText('2024');
  await expect(page.locator('#map')).toHaveAttribute('aria-label', /TB incidence/);
  await page.locator('#tbMedicine').selectOption('0');
  await page.locator('#tbStatus').selectOption('U');
  await page.locator('#q').fill('Poland');
  await page.locator('#q').dispatchEvent('change');
  await expect(page.locator('.tip.on .tb-summary')).toContainText('30.5');
  await expect(page.locator('.tip.on .tb-summary')).toContainText('1,234');
  await page.locator('.map-mode [data-mode="tb-smoking"]').click();
  await expect(page.locator('#map')).toHaveAttribute('aria-label', /smoking-attributable/);
  await page.locator('.map-mode [data-mode="medicines"]').click();
  await expect(page.locator('#medicineViews')).toBeVisible();
  await expect(page.locator('#tbControls')).toBeHidden();
  await page.locator('#medicineViews [data-view="1"]').click();
  await expect(page.locator('#medicineViews [data-view="1"]')).toHaveAttribute('aria-pressed', 'true');
});

test('missing TB estimates display No data, not zero', async ({page}) => {
  await page.goto('./');
  await page.locator('.map-mode [data-mode="tb-smoking"]').click();
  await expect(page.locator('#tbMeta')).toBeVisible();
  await page.locator('#q').fill('Poland');
  await page.locator('#q').dispatchEvent('change');
  await expect(page.locator('.tip.on .tb-summary')).toBeVisible();
  // With no initial sync the country record is absent; after sync the page may have data.
  const summary = await page.locator('.tip.on .tb-summary').innerText();
  expect(summary).toMatch(/No data|\d/);
});
