const {test, expect} = require('@playwright/test');

// Network failures are simulated inside the test browser only. Production data
// and remote WHO endpoints are never modified.
test('unavailable WHO TB script leaves medicine map and labels missing as No data', async ({page}) => {
  await page.route('**/data/tb-data.js*', route => route.abort('failed'));
  await page.goto('./');
  await expect(page.locator('#legend button').first()).toBeVisible();
  await expect(page.locator('#resourceNotice')).toBeVisible();
  await expect(page.locator('#resourceNotice')).toContainText('WHO tuberculosis');
  await page.locator('.map-mode [data-mode="tb-incidence"]').click();
  await expect(page.locator('#tbMeta')).toContainText('could not');
  await page.locator('#q').fill('Poland');
  await page.locator('#q').dispatchEvent('change');
  await expect(page.locator('.tip.on .tb-summary')).toContainText('No data');
});

test('missing geographic topology shows message and keeps country table', async ({page}) => {
  await page.route('**/data/world-topology.js*', route => route.abort('failed'));
  await page.goto('./');
  await expect(page.locator('#resourceNotice')).toBeVisible();
  await expect(page.getByRole('button',{name:'Retry loading'})).toBeVisible();
  await expect(page.locator('#countryTable tbody tr')).toHaveCount(195);
  await expect(page.locator('#countryTable')).toContainText('Poland');
});

test('missing D3 library has a clear fallback and recoverable reload', async ({page}) => {
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/d3/**', route => route.abort('failed'));
  await page.goto('./');
  await expect(page.locator('#resourceNotice')).toBeVisible();
  await expect(page.locator('#countryTable tbody tr')).toHaveCount(195);
  await page.unroute('https://cdnjs.cloudflare.com/ajax/libs/d3/**');
  await page.getByRole('button',{name:'Retry loading'}).click();
  await expect(page.locator('#legend button').first()).toBeVisible();
  await expect(page.locator('#resourceNotice')).toBeHidden();
});

test('missing map script and TopoJSON library are identified independently', async ({page}) => {
  await page.route('**/assets/map.js*', route => route.abort('failed'));
  await page.goto('./');
  await expect(page.locator('#resourceNotice')).toBeVisible();
  await expect(page.locator('#countryTable tbody tr')).toHaveCount(195);
  await page.unroute('**/assets/map.js*');
  await page.route('https://cdn.jsdelivr.net/npm/topojson-client@**', route => route.abort('failed'));
  await page.reload();
  await expect(page.locator('#resourceNotice')).toBeVisible();
  await expect(page.locator('#countryTable tbody tr')).toHaveCount(195);
});
