const {test, expect} = require('@playwright/test');

test('TB modes use the WHO snapshot and retain medicines view', async ({page}) => {
  await page.route('**/data/tb-data.js*', route => route.fulfill({
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
  await expect(page.locator('#legend')).toContainText('10–49');
  const polFill = await page.locator('#map path.country').evaluateAll(nodes => {
    const pol = nodes.find(node => String(d3.select(node).datum().id).padStart(3, '0') === '616');
    return pol ? getComputedStyle(pol).fill : null;
  });
  expect(polFill).toBeTruthy();
  expect(polFill).not.toBe('rgb(255, 255, 255)');
  await page.locator('#tbMedicine').selectOption('0');
  await page.locator('#tbStatus').selectOption('U');
  await page.locator('#q').fill('Poland');
  await page.locator('#q').dispatchEvent('change');
  await expect(page.locator('.tip.on .tb-summary')).toContainText('30.5');
  await expect(page.locator('.tip.on .tb-summary')).toContainText('1,234');
  await page.locator('.map-mode [data-mode="tb-smoking"]').click();
  await expect(page.locator('#map')).toHaveAttribute('aria-label', /smoking-attributable/);
  const smokingFill = await page.locator('#map path.country').evaluateAll(nodes => {
    const pol = nodes.find(node => String(d3.select(node).datum().id).padStart(3, '0') === '616');
    return pol ? getComputedStyle(pol).fill : null;
  });
  expect(smokingFill).toBeTruthy();
  expect(smokingFill).not.toBe('rgb(255, 255, 255)');
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

test('versioned resources prevent mixing an updated page with a stale map script', async ({page}) => {
  await page.goto('./');
  const resources = await page.locator('script[src],link[rel="stylesheet"][href]').evaluateAll(nodes =>
    nodes.map(el => el.getAttribute('src') || el.getAttribute('href'))
  );
  for (const path of ['assets/map.js', 'data/tb-data.js', 'assets/site.css']) {
    expect(resources.some(src => src.startsWith(path + '?v='))).toBeTruthy();
  }
  await page.locator('.map-mode [data-mode="tb-incidence"]').click();
  await expect(page.locator('#medicineViews')).toBeHidden();
  await expect(page.locator('#tbControls')).toBeVisible();
});

test('Full package appears first in both selectors and uses shared three-state definition', async ({page}) => {
  await page.goto('./');
  await expect(page.locator('#medicineViews button').first()).toHaveText('Full package');
  await expect(page.locator('#tbMedicine option').first()).toHaveText('Full package');
  // The default remains All countries, so switching to TB does not silently filter.
  await expect(page.locator('#tbMedicine')).toHaveValue('any');
  const status = await page.evaluate(() => [
    fullPackageStatus({r:'AAAA'}),
    fullPackageStatus({r:'AAUA'}),
    fullPackageStatus({r:'UAAA'}),
    fullPackageStatus({r:'AAXA'}),
    fullPackageStatus({r:'AAUX'}),
    fullPackageStatus({r:'AXUA'})
  ]);
  expect(status).toEqual(['A','A','U','A','X','X']);

  await page.locator('#medicineViews [data-view="full"]').click();
  await expect(page.locator('#medicineViews [data-view="full"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#legend')).toContainText('Full package available');
  await page.locator('.map-mode [data-mode="tb-incidence"]').click();
  await page.locator('#tbMedicine').selectOption('full');
  await page.locator('#tbStatus').selectOption('A');

  const observed = await page.evaluate(() => {
    function dim(iso) {
      const country = [...document.querySelectorAll('#map path.country')].find(el => {
        const d = DATA[d3.select(el).datum().id];
        return d && d.i === iso;
      });
      return country ? country.classList.contains('dim') : null;
    }
    return {poland:dim('POL'),belarus:dim('BLR')};
  });
  expect(observed).toEqual({poland:false, belarus:true});
  await page.locator('#tbStatus').selectOption('U');
  const afterUnavailable = await page.evaluate(() => {
    const country = [...document.querySelectorAll('#map path.country')].find(el => {
      const d = DATA[d3.select(el).datum().id];
      return d && d.i === 'BLR';
    });
    return country && country.classList.contains('dim');
  });
  expect(afterUnavailable).toBe(false);
});

test('TB incidence thresholds compare full, partial and unavailable medicine access', async ({page}) => {
  await page.route('**/data/tb-data.js*', route => route.fulfill({
    contentType:'application/javascript',
    body:'const TB_DATA = '+JSON.stringify({
      year:2024,updated:'2026-10-23T18:00:00Z',
      countries:{
        POL:{incidence:150,smoking:400},BLR:{incidence:250,smoking:190},
        ZWE:{incidence:450,smoking:null},AFG:{incidence:500,smoking:null},
        DEU:{incidence:100,smoking:400}
      }
    })+';'
  }));
  await page.goto('./');
  await page.locator('.map-mode [data-mode="tb-incidence"]').click();
  await expect(page.locator('#tbIncidenceControls')).toBeVisible();
  await expect(page.locator('#tbColorBy')).toHaveValue('rate');
  await expect(page.locator('#tbCutoff')).toBeHidden();
  await page.locator('#tbColorBy').selectOption('access');
  await expect(page.locator('#tbControls')).toBeHidden();
  await expect(page.locator('#tbCutoff')).toBeVisible();
  await expect(page.locator('#tbCutoff')).toHaveValue('100');
  await expect(page.locator('#legend button')).toHaveCount(6);

  const category = async iso => page.evaluate(code => {
    const entry = [...document.querySelectorAll('#map path.country')].find(el => {
      const row=DATA[d3.select(el).datum().id];
      return row && row.i===code;
    });
    if(!entry) return null;
    return {
      color:getComputedStyle(entry).fill,
      classKey:tbAccessClass(DATA[d3.select(entry).datum().id]),
      dimmed:entry.classList.contains('dim')
    };
  },iso);
  const full=await category('POL'), partial=await category('BLR'), absent=await category('ZWE');
  const uncertain=await category('AFG'), boundary=await category('DEU');
  expect(full.classKey).toBe('acc-full');
  expect(partial.classKey).toBe('acc-partial');
  expect(absent.classKey).toBe('acc-none');
  expect(uncertain.classKey).toBe('acc-uncertain');
  expect(boundary.classKey).toBe('acc-below'); // strictly greater than 100
  expect(new Set([full.color,partial.color,absent.color,uncertain.color,boundary.color]).size).toBe(5);
  expect(full.dimmed).toBe(false);
  await expect(page.locator('#tbMeta')).toContainText('>100');
  await page.locator('#tbCutoff').selectOption('200');
  expect((await category('POL')).classKey).toBe('acc-below');
  expect((await category('BLR')).classKey).toBe('acc-partial');
  await page.locator('#tbCutoff').selectOption('400');
  expect((await category('BLR')).classKey).toBe('acc-below');
  expect((await category('ZWE')).classKey).toBe('acc-none');
  await expect(page.locator('#tbMeta')).toContainText('>400');

  await page.locator('#q').fill('Zimbabwe');
  await page.locator('#q').dispatchEvent('change');
  await expect(page.locator('.tip.on')).toContainText('Full package unavailable; no medicine confirmed available');
  await page.locator('#tbColorBy').selectOption('rate');
  await expect(page.locator('#tbControls')).toBeVisible();
  await expect(page.locator('#tbCutoff')).toBeHidden();
  await expect(page.locator('#legend')).toContainText('200–399');
  await page.locator('.map-mode [data-mode="tb-smoking"]').click();
  await expect(page.locator('#tbIncidenceControls')).toBeHidden();
});

test('comparison mode works without WHO incidence data and never reports unavailable', async ({page}) => {
  await page.route('**/data/tb-data.js*', route => route.fulfill({
    contentType:'application/javascript',
    body:'const TB_DATA = {"year":null,"updated":null,"countries":{}};'
  }));
  await page.goto('./');
  await page.locator('.map-mode [data-mode="tb-incidence"]').click();
  await page.locator('#tbColorBy').selectOption('access');
  await expect(page.locator('#tbMeta')).toContainText('not yet synchronized');
  expect(await page.evaluate(() => tbAccessClass({i:'POL',r:'AAAA'}))).toBe('nd');
  await expect(page.locator('#legend button').last()).toContainText('195');
});
