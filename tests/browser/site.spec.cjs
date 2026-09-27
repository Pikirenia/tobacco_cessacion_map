const {test, expect} = require('@playwright/test');

test('map filters retain keyboard focus, search, zoom and navigation work', async ({page}) => {
  const errors=[];page.on('pageerror', e=>errors.push(e.message));
  await page.goto('./');
  const full=page.getByRole('button', {name:/^Full set/});
  await expect(full).toBeVisible();
  await full.focus();await page.keyboard.press('Enter');
  await expect(full).toHaveAttribute('aria-pressed','true');
  await expect(full).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(full).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'NRT',exact:true}).click();
  await expect(page.locator('#legend button')).toHaveCount(3);
  await page.getByRole('button',{name:'All four',exact:true}).click();
  await expect(page.locator('#legend button')).toHaveCount(7);
  await page.getByLabel('Find a country').fill('Poland');
  await page.getByLabel('Find a country').press('Tab');
  await expect(page.locator('#tip')).toHaveClass(/on/);
  await expect(page.locator('#tip h2')).toHaveText('Poland');
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Reset view'}).click();
  await expect(page.locator('#map > g')).toHaveAttribute('transform', 'translate(0,0) scale(1)');
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  await expect(page.locator('#map > g')).not.toHaveAttribute('transform', 'translate(0,0) scale(1)');
  await page.getByRole('link',{name:'Submit country feedback'}).click();
  await expect(page).toHaveURL(/\/tobacco_cessacion_map\/feedback\/$/);
  await page.getByRole('link',{name:'Back to map'}).click();
  await expect(page).toHaveURL(/\/tobacco_cessacion_map\/$/);
  expect(errors).toEqual([]);
});

test('hover reuses the country card instead of rebuilding its content', async ({page}, info) => {
  test.skip(info.project.name !== 'desktop', 'Mouse interaction');
  await page.goto('./');await expect(page.locator('#legend button')).toHaveCount(7);
  // Dispatch on an existing country to avoid brittle geographic screen coordinates.
  // Hover raises the SVG path, so keep the same node rather than reselecting first().
  const country=await page.locator('.country:not(.out)').first().elementHandle();
  await country.dispatchEvent('pointermove',{pointerType:'mouse',clientX:100,clientY:100});
  await expect(page.locator('#tip')).toHaveClass(/on/);
  const heading=await page.locator('#tip h2').elementHandle();
  for(let i=0;i<10;i++)await country.dispatchEvent('pointermove',{pointerType:'mouse',clientX:110+i,clientY:110});
  expect(await heading.evaluate(el=>el===document.querySelector('#tip h2'))).toBe(true);
  await country.dispatchEvent('pointerleave',{pointerType:'mouse'});
  await expect(page.locator('#tip')).not.toHaveClass(/on/);
});

test('feedback is usable at narrow widths and in dark mode', async ({page}) => {
  await page.goto('feedback/');
  await expect(page.locator('#country option')).toHaveCount(196);
  for(const width of [320,375,640]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const cards=await page.locator('.medicine').first().boundingBox();
    expect(cards.width).toBeLessThan(width);
    expect(await page.locator('.medicine-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(1);
  }
  await page.emulateMedia({colorScheme:'dark'});
  await expect(page.getByRole('heading',{name:'Help us keep the map accurate'})).toBeVisible();
  await page.locator('#nrt-availability').getByLabel('Not available',{exact:true}).check();
  await expect(page.locator('#nrt-access input').first()).toBeDisabled();
  await page.locator('#nrt-availability').getByLabel('Available',{exact:true}).check();
  await expect(page.locator('#nrt-access input').first()).toBeEnabled();
  expect(await page.locator('#nrt-access input').first().evaluate(el=>el.required)).toBe(true);
});

test('native POST locks answers, retries safely and redirects only after acknowledgement', async ({page}) => {
  const endpoint='https://script.google.com/macros/s/test/exec';
  await page.route('**/feedback/config.js',route=>route.fulfill({contentType:'application/javascript',body:`const GOOGLE_APPS_SCRIPT_URL=${JSON.stringify(endpoint)};`}));
  const posts=[];let respond;
  // Intercept every Google endpoint. Tests must never write to the real Sheet.
  await page.route('https://script.google.com/**',async route=>{
    posts.push(new URLSearchParams(route.request().postData()));
    await new Promise(resolve=>{respond=resolve;});
    const data={type:'country-feedback-result',token:posts.at(-1).get('response_token'),ok:posts.length>1};
    await route.fulfill({contentType:'text/html',body:`<script>top.postMessage(${JSON.stringify(data)},'http://127.0.0.1:8766')</script>`});
  });
  await page.goto('feedback/');
  await page.getByLabel('Country *',{exact:true}).selectOption('Poland');
  for(const drug of ['nrt','varenicline','cytisine','bupropion'])await page.locator(`#${drug}-availability`).getByLabel('Not available',{exact:true}).check();
  await page.getByLabel('Additional information / comments (optional)',{exact:true}).fill('Browser test, intercepted locally');
  await page.waitForTimeout(3100);
  await page.getByRole('button',{name:'Submit feedback',exact:true}).click();
  await expect.poll(()=>posts.length).toBe(1);
  await expect(page.locator('#comments')).toBeDisabled();
  expect(posts[0].get('comments')).toBe('Browser test, intercepted locally');
  expect(posts[0].get('nrt_access')).toBe('not_applicable');
  respond();
  await expect(page.getByRole('button',{name:'Retry submission'})).toBeEnabled();
  await expect(page.locator('#comments')).toHaveValue('Browser test, intercepted locally');
  await expect(page.locator('#comments')).toBeEnabled();
  await expect(page).toHaveURL(/feedback\/$/);
  await page.getByRole('button',{name:'Retry submission'}).click();
  await expect.poll(()=>posts.length).toBe(2);
  expect(posts[1].get('submission_id')).toBe(posts[0].get('submission_id'));
  respond();
  await expect(page.getByRole('heading',{name:'Thank you for your feedback'})).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(page).toHaveURL(/feedback\/$/);
  await expect(page).toHaveURL(/\/tobacco_cessacion_map\/$/,{timeout:7000});
});
