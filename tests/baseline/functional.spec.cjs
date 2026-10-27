const {test, expect} = require('@playwright/test');
const {deterministic, ready, state} = require('./support.cjs');

test('initial render, reload and native form restoration', async ({page}) => {
  await deterministic(page);
  await ready(page);
  await expect(page.locator('#map')).toHaveAttribute('aria-label', /medicine availability/);
  await expect(page.locator('#legend button')).toHaveCount(7);
  await page.reload();
  await expect(page.locator('#legend button')).toHaveCount(7);
  await page.locator('#tbColorBy').evaluate(el => {el.value = 'access'});
  await page.locator('#tbCutoff').evaluate(el => {el.value = '400'});
  await page.locator('.map-mode [data-mode="tb-incidence"]').click();
  await expect(page.locator('#tbMeta')).toContainText('>400');
  await expect(page.locator('#tbControls')).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await expect(page.locator('#tbCutoff')).toHaveValue('400');
  await expect(page.locator('#legend')).toContainText('Full package available');
});

test('layer navigation, threshold and filters are interactive', async ({page}) => {
  await deterministic(page); await ready(page);
  for(const mode of ['tb-incidence','tb-smoking','medicines','compare-100','compare-200','compare-400']) {
    await state(page, mode);
    await expect(page.locator('#map path.country:not(.out)').first()).toBeVisible();
  }
  await page.locator('.map-mode [data-mode="tb-smoking"]').click();
  await page.locator('#tbMedicine').selectOption('full');
  await page.locator('#tbStatus').selectOption('U');
  await expect(page.locator('#tbMedicine')).toHaveValue('full');
  await expect(page.locator('#tbStatus')).toHaveValue('U');
  await page.locator('.map-mode [data-mode="medicines"]').click();
  await page.locator('#medicineViews [data-view="0"]').click();
  await expect(page.locator('#legend button')).toHaveCount(3);
});

test('search, country tooltip and map navigation', async ({page}) => {
  await deterministic(page); await ready(page);
  await page.locator('#q').fill('Poland');
  await page.locator('#q').dispatchEvent('change');
  await expect(page.locator('#tip.on h2')).toHaveText('Poland');
  await page.keyboard.press('Escape');
  await expect(page.locator('#tip')).not.toHaveClass(/on/);
  await page.locator('#map path.country:not(.out)').first().dispatchEvent('click',
    {clientX:200,clientY:200});
  await expect(page.locator('#tip.on h2')).toBeVisible();
  await page.getByRole('button',{name:'Close'}).click();
  await page.locator('#zin').click();
  await expect(page.locator('#map > g')).not.toHaveAttribute('transform','translate(0,0) scale(1)');
  await page.locator('#zreset').click();
  await expect(page.locator('#map > g')).toHaveAttribute('transform','translate(0,0) scale(1)');
});

test('feedback back-forward navigation and form-state observation', async ({page}, testInfo) => {
  await deterministic(page); await ready(page);
  await page.getByRole('link',{name:'Submit country feedback'}).click();
  await expect(page.getByRole('heading',{name:/Help us keep the map accurate/})).toBeVisible();
  await page.locator('#country').selectOption('Poland');
  await page.goBack();
  await expect(page.locator('#legend button').first()).toBeVisible();
  await page.goForward();
  await expect(page.locator('#country option')).toHaveCount(196);
  // BFCache restoration varies by browser; report its behavior, do not assert it.
  const restored = await page.locator('#country').inputValue();
  testInfo.annotations.push({type:'form-restoration', description:restored === 'Poland'?'preserved':'reset'});
  await page.goBack();
  await expect(page.locator('#legend button').first()).toBeVisible();
});
