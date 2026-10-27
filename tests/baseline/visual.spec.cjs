const {test, expect} = require('@playwright/test');
const {deterministic, ready, state} = require('./support.cjs');
const widths = [320, 375, 390, 768, 1024, 1280, 1440];
const modes = ['medicines', 'tb-incidence', 'tb-smoking', 'compare-100', 'compare-200', 'compare-400'];
for(const width of widths) for(const scheme of ['light','dark']) {
  test.describe(width + 'px ' + scheme, () => {
    for(const mode of modes) test(mode + ' map', async ({page}) => {
      await page.setViewportSize({width, height: 900});
      await page.emulateMedia({colorScheme: scheme, reducedMotion:'reduce'});
      await deterministic(page);
      await ready(page);
      await state(page, mode);
      await expect(page.locator('#mapbox')).toHaveScreenshot(
        width + '-' + scheme + '-' + mode + '-desktop-v2-map.png');
      if(mode === 'medicines' || ((width === 375 || width === 1280) && mode.startsWith('compare'))) {
        await expect(page).toHaveScreenshot(width + '-' + scheme + '-' + mode + '-desktop-v2-page.png',
          {fullPage: true});
      }
    });
  });
}
