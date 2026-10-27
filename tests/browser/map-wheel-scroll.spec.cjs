const {test, expect} = require('@playwright/test');

test('desktop wheel scrolls the page over the map; Ctrl+wheel zooms only the map', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop mouse-wheel behavior');
  await page.goto('./');
  const map = page.locator('#map');
  const mapLayer = page.locator('#map > g');
  await expect(page.locator('#map path.country:not(.out)').first()).toBeVisible();

  // Position the map beneath the pointer while retaining room to scroll upward.
  await page.evaluate(() => {
    const rect = document.getElementById('map').getBoundingClientRect();
    const top = window.scrollY + rect.top;
    window.scrollTo(0, Math.min(
      document.documentElement.scrollHeight - innerHeight,
      Math.max(150, top - 100)
    ));
  });
  const rect = await map.boundingBox();
  const x = rect.x + rect.width / 2;
  const y = rect.y + Math.min(rect.height / 2, 300);
  const initialTransform = await mapLayer.getAttribute('transform');
  const scrollBefore = await page.evaluate(() => window.scrollY);
  expect(scrollBefore).toBeGreaterThan(0);
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -250);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(scrollBefore);
  await expect(mapLayer).toHaveAttribute('transform', initialTransform);

  // An intentional modified wheel gesture still zooms the map in place.
  const nextRect = await map.boundingBox();
  await page.mouse.move(nextRect.x + nextRect.width / 2, nextRect.y + nextRect.height / 2);
  const scrollBeforeZoom = await page.evaluate(() => window.scrollY);
  await page.keyboard.down('Control');
  try {
    await page.mouse.wheel(0, -300);
  } finally {
    await page.keyboard.up('Control');
  }
  await expect.poll(() => mapLayer.getAttribute('transform')).not.toBe(initialTransform);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeZoom);

  // The existing zoom toolbar continues to work.
  await page.locator('#zreset').click();
  await expect(mapLayer).toHaveAttribute('transform', initialTransform);
});
