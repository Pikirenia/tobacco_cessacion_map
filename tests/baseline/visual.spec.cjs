const {test, expect} = require('@playwright/test');
const {deterministic, ready, state} = require('./support.cjs');
// Historical PR1/PR2 screenshots remain immutable; PR4 uses separately reviewed candidates.
const widths = [768, 1024, 1280, 1440];
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
        width + '-' + scheme + '-' + mode + '-accessibility-pr4-map.png');
      // Full-page PR2 images remain historical references: PR3 changes page copy
      // and reserves map space. PR3 supplies independent responsive snapshots.
    });
  });
}
