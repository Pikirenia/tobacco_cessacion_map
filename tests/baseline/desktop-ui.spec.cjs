const {test, expect} = require('@playwright/test');
const {deterministic, ready} = require('./support.cjs');

const widths = [320,375,390,768,1024,1280,1440,1920];
for (const width of widths) for (const scheme of ['light','dark']) {
  test(`desktop UI behavior ${width}px ${scheme}`, async ({page}, testInfo) => {
    await page.setViewportSize({width,height:900});
    await page.emulateMedia({colorScheme:scheme,reducedMotion:'reduce'});
    await deterministic(page); await ready(page);
    const noDocumentOverflow = () => page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(await noDocumentOverflow()).toBe(true);
    await expect(page.locator('.map-mode [data-mode="medicines"]')).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('#medicineViews button')).toHaveCount(6);
    for (const view of ['full','all','0','1','2','3']) {
      const button=page.locator('#medicineViews [data-view="'+view+'"]');
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed','true');
      await expect(page.locator('#legend button')).toHaveCount(view==='all'?7:3);
    }
    await page.locator('.map-mode [data-mode="tb-incidence"]').click();
    await expect(page.locator('#medicineViewField')).toBeHidden();
    await expect(page.locator('#tbIncidenceControls')).toBeVisible();
    await expect(page.locator('#tbControls')).toBeVisible();
    await page.locator('#tbMedicine').selectOption('full');
    await page.locator('#tbStatus').selectOption('U');
    await expect(page.locator('#tbStatus')).toHaveValue('U');
    await page.locator('#tbColorBy').selectOption('access');
    await expect(page.locator('#tbControls')).toBeHidden();
    await expect(page.locator('#tbThresholdField')).toBeVisible();
    for (const threshold of ['100','200','400']) {
      const button=page.locator('#tbThresholds [data-cutoff="'+threshold+'"]');
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed','true');
      await expect(page.locator('#tbCutoff')).toHaveValue(threshold);
      await expect(page.locator('#tbMeta')).toContainText('>'+threshold);
      await expect(page.locator('#legend button')).toHaveCount(6);
    }
    expect(await noDocumentOverflow()).toBe(true);
    if ([1280,1920].includes(width)) {
      await testInfo.attach('after-'+width+'-'+scheme+'-comparison.png',{
        body:await page.screenshot({fullPage:true,animations:'disabled'}),
        contentType:'image/png'
      });
    }
    await page.locator('#tbColorBy').selectOption('rate');
    await expect(page.locator('#tbControls')).toBeVisible();
    await expect(page.locator('#tbThresholdField')).toBeHidden();
    await page.locator('.map-mode [data-mode="tb-smoking"]').click();
    await expect(page.locator('#tbIncidenceControls')).toBeHidden();
    await expect(page.locator('#tbControls')).toBeVisible();
    await page.locator('.map-mode [data-mode="medicines"]').click();
    await expect(page.locator('#medicineViews')).toBeVisible();
    await expect(page.locator('#find')).toHaveCount(0); // No duplicate search control.
    await expect(page.locator('#q')).toHaveCount(1);
    expect(await noDocumentOverflow()).toBe(true);
    if ([1280,1920].includes(width)) {
      await testInfo.attach('after-'+width+'-'+scheme+'-medicines.png',{
        body:await page.screenshot({fullPage:true,animations:'disabled'}),
        contentType:'image/png'
      });
    }
  });
}

test('strict TB thresholds, unchanged retail categories and missing-data treatment', async ({page}) => {
  await deterministic(page); await ready(page);
  await page.locator('.map-mode [data-mode="tb-incidence"]').click();
  await page.locator('#tbColorBy').selectOption('access');
  const result=await page.evaluate(() => {
    const rows=Object.entries(TB.countries).filter(([,v]) => Number.isFinite(v.incidence));
    const above=rows.find(([,v]) => v.incidence > 400)?.[0];
    if (!above) return null;
    const synthetic=r=>tbAccessClass({i:above,r});
    return {
      full:synthetic('AAUA'),three:synthetic('AAAU'),
      two:synthetic('AAUX'),one:synthetic('UUAX'),
      none:synthetic('XXXX'),missing:tbAccessClass({i:'INVALID',r:'AAAA'}),
      colors:['acc-none','acc-one','acc-two','acc-full','acc-below','nd'].map(fillFor)
    };
  });
  expect(result).not.toBeNull();
  expect(result).toMatchObject({
    full:'acc-full',three:'acc-two',two:'acc-two',
    one:'acc-one',none:'acc-none',missing:'nd'
  });
  expect(new Set(result.colors).size).toBe(6);
  await page.locator('#tbThresholds [data-cutoff="200"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#tbCutoff')).toHaveValue('200');
  await page.locator('#tbCutoff').evaluate(el => {el.value='400';});
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await expect(page.locator('#tbThresholds [data-cutoff="400"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#tbMeta')).toContainText('>400');
});

test('country search, tooltip, zoom and refresh are preserved', async ({page}) => {
  await deterministic(page); await ready(page);
  await page.locator('#q').fill('Poland');
  await page.locator('#q').dispatchEvent('change');
  await expect(page.locator('#tip.on h2')).toHaveText('Poland');
  await expect(page.locator('#tip')).toHaveAttribute('aria-label','Country details');
  await page.keyboard.press('Escape');
  await expect(page.locator('#tip')).not.toHaveClass(/on/);
  await page.locator('#zin').click();
  await expect(page.locator('#map > g')).not.toHaveAttribute('transform','translate(0,0) scale(1)');
  await page.locator('#zreset').click();
  await expect(page.locator('#map > g')).toHaveAttribute('transform','translate(0,0) scale(1)');
  await page.reload();
  await expect(page.locator('#legend button')).toHaveCount(7);
  await page.locator('.map-mode [data-mode="tb-incidence"]').click();
  await page.locator('#tbColorBy').selectOption('access');
  await page.locator('#tbThresholds [data-cutoff="400"]').click();
  await page.reload();
  await expect(page.locator('#map path.country:not(.out)').first()).toBeVisible();
});
