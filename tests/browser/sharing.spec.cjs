const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const fixture=name=>fs.readFileSync(path.join(__dirname,'../baseline/fixtures',name),'utf8');
// Self-contained fixture routing: regular 'npm ci && npm run test:browser' needs
// no baseline-only D3/TopoJSON npm installation. Other browser suites likewise
// use their existing CDN resource loading.
async function deterministic(page){
  await page.route('**/data/tb-data.js*',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:fixture('tb-data.js')
  }));
  await page.route('**/data/map-data.js*',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:fixture('map-data.js')
  }));
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await page.route('https://fonts.gstatic.com/**',route=>route.abort());
}

test('direct first load restores all layers and 3 TB thresholds before any interaction',async({page})=>{
  await deterministic(page);
  for(const layer of ['medicines','tb-incidence','tb-smoking']){
    for(const threshold of ['100','200','400']){
      const q=new URLSearchParams({layer,view:'full',display:'access',threshold,medicine:'full',status:'U'});
      await page.goto('./?'+q);
      await expect(page.locator('.map-mode [data-mode="'+layer+'"]')).toHaveAttribute('aria-pressed','true');
      await expect(page.locator('#tbCutoff')).toHaveValue(threshold);
      await expect(page.locator('#tbMedicine')).toHaveValue('full');
      await expect(page.locator('#tbStatus')).toHaveValue('U');
      await expect(page.locator('#medicineViews [data-view="full"]')).toHaveAttribute('aria-pressed','true');
      if(layer==='tb-incidence'){
        await expect(page.locator('#tbThresholdField')).toBeVisible();
        await expect(page.locator('#tbMeta')).toContainText('>'+threshold);
        await expect(page.locator('#legend')).toContainText('Full package available');
        await expect(page.locator('#tbThresholds [aria-pressed="true"]')).toHaveAttribute('data-cutoff',threshold);
      }else if(layer==='tb-smoking'){
        await expect(page.locator('#tbControls')).toBeVisible();
        await expect(page.locator('#legend')).toContainText('50,000');
      }else await expect(page.locator('#legend')).toContainText('Full package available');
      await expect(page.locator('#map path.country:not(.out)').first()).toBeVisible();
    }
  }
});
test('country deep-link pins the correct country, with correct legend, and survives reload',async({page})=>{
  await deterministic(page);
  await page.goto('./?layer=tb-incidence&display=access&threshold=200&country=POL');
  await expect(page.locator('#tbMeta')).toContainText('>200');
  await expect(page.locator('#tbThresholds [aria-pressed="true"]')).toHaveAttribute('data-cutoff','200');
  await expect(page.locator('.tip.on h2')).toHaveText('Poland');
  await expect(page.locator('#q')).toHaveValue('Poland');
  await expect(page.locator('#legend')).toContainText('0 confirmed available');
  await page.reload();
  await expect(page.locator('.tip.on h2')).toHaveText('Poland');
  await expect(page.locator('#tbMeta')).toContainText('>200');
});
test('medicine views and status filter survive share URL roundtrips',async({page})=>{
  await deterministic(page);
  await page.goto('./?layer=tb-smoking&medicine=2&status=X');
  await expect(page.locator('#tbMedicine')).toHaveValue('2');
  await expect(page.locator('#tbStatus')).toHaveValue('X');
  await page.locator('.map-mode [data-mode="medicines"]').click();
  for(const view of ['0','1','2','3','full','all']){
    await page.locator('#medicineViews [data-view="'+view+'"]').click();
    const url=page.url();
    await page.goto(url);
    await expect(page.locator('#medicineViews [data-view="'+view+'"]')).toHaveAttribute('aria-pressed','true');
  }
});
test('browser back/forward restores controls, legends, and country selection',async({page})=>{
  await deterministic(page);await page.goto('./');
  await page.locator('.map-mode [data-mode="tb-incidence"]').click();
  await page.locator('#tbColorBy').selectOption('access');
  await page.locator('#tbThresholds [data-cutoff="400"]').click();
  await expect(page).toHaveURL(/threshold=400/);
  await page.locator('#q').fill('Poland');
  await page.locator('#q').dispatchEvent('change');
  await expect(page.locator('.tip.on h2')).toHaveText('Poland');
  await expect(page).toHaveURL(/country=POL/);
  await page.goBack();
  await expect(page.locator('#tip')).not.toHaveClass(/on/);
  await expect(page.locator('#tbMeta')).toContainText('>400');
  await page.goBack();
  await expect(page.locator('#tbCutoff')).toHaveValue('100');
  await page.goForward();
  await expect(page.locator('#tbCutoff')).toHaveValue('400');
  await page.goForward();
  await expect(page.locator('.tip.on h2')).toHaveText('Poland');
  await expect(page.locator('#q')).toHaveValue('Poland');
});
test('unsupported URL parameters safely default without corrupting scientific map',async({page})=>{
  await deterministic(page);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./?layer=unknown&view=x&display=malformed&threshold=900&medicine=weird&status=Q&country=BAD');
  await expect(page.locator('.map-mode [data-mode="medicines"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#legend button')).toHaveCount(7);
  await expect(page.locator('#tip')).not.toHaveClass(/on/);
  await expect(page.locator('#tbCutoff')).toHaveValue('100');
  expect(errors).toEqual([]);
});
test('share uses current view, respects denied clipboard and offers manual fallback',async({page})=>{
  await deterministic(page);await page.goto('./');
  await page.locator('.map-mode [data-mode="tb-smoking"]').click();
  await page.locator('#tbMedicine').selectOption('full');
  await page.locator('#tbStatus').selectOption('X');
  await page.evaluate(()=>{
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__copiedURL=value;}}});
  });
  await page.locator('#copyViewLink').click();
  await expect(page.locator('#shareStatus')).toContainText('Link copied');
  const copied=await page.evaluate(()=>window.__copiedURL);
  expect(copied).toContain('layer=tb-smoking');
  expect(copied).toContain('medicine=full');
  expect(copied).toContain('status=X');
  await page.evaluate(()=>{
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied');}}});
    document.execCommand=()=>false;
  });
  await page.locator('#copyViewLink').click();
  await expect(page.locator('#shareFallback')).toBeVisible();
  await expect(page.locator('#shareURL')).toHaveValue(copied);
  await expect(page.locator('#shareStatus')).toContainText('Select and copy');
});
test('feedback progressive access preserves unavailable and unknown semantics',async({page})=>{
  await page.goto('feedback/');
  await expect(page.locator('#nrt-access')).toBeHidden();
  await page.locator('#nrt-availability').getByLabel("Don't know",{exact:true}).check();
  await expect(page.locator('#nrt-access')).toBeVisible();
  await expect(page.locator('#nrt-access input').first()).toBeEnabled();
  expect(await page.locator('#nrt-access input').first().evaluate(n=>n.required)).toBe(true);
  await page.locator('#nrt-access').getByLabel("Don't know",{exact:true}).check();
  let state=await page.evaluate(()=>new FormData(document.getElementById('feedback-form')).get('nrt_access'));
  expect(state).toBe('unknown');
  await page.locator('#nrt-availability').getByLabel('Not available',{exact:true}).check();
  await expect(page.locator('#nrt-access')).toBeHidden();
  state=await page.evaluate(()=>new FormData(document.getElementById('feedback-form')).get('nrt_access'));
  expect(state).toBe('not_applicable');
  await page.locator('#nrt-availability').getByLabel('Available',{exact:true}).check();
  await expect(page.locator('#nrt-access')).toBeVisible();
  expect(await page.locator('#nrt-access input:checked').count()).toBe(0);
  const selected=await page.evaluate(()=>new FormData(document.getElementById('feedback-form')).get('nrt_access'));
  expect(selected).toBeNull();
});
test('feedback mobile layout fits 320px and has keyboard-operable native radios',async({page},info)=>{
  await page.setViewportSize({width:320,height:850});
  await page.goto('feedback/');
  await expect(page.getByRole('heading',{name:'2. Medicine availability and access'})).toBeVisible();
  await expect(page.locator('.medicine')).toHaveCount(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#nrt-availability input').first().focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#nrt-access')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('feedback-pr7-mobile.png'),fullPage:true});
});
test('map and feedback PR7 visual evidence',async({page},info)=>{
  await deterministic(page);
  await page.goto('./?layer=tb-incidence&display=access&threshold=200');
  await expect(page.locator('#legend button').first()).toBeVisible();
  await page.locator('.map-panel').screenshot({path:info.outputPath('map-pr7-share.png'),animations:'disabled'});
  await page.locator('.map-toolbar').screenshot({path:info.outputPath('map-pr7-share-controls.png'),animations:'disabled'});
  await page.goto('feedback/');
  await page.locator('#nrt-availability').getByLabel('Available',{exact:true}).check();
  await page.screenshot({path:info.outputPath('feedback-pr7-progressive.png'),fullPage:true});
});
