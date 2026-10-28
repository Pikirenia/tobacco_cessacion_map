const {test,expect}=require('@playwright/test');

async function load(page,query=''){
  await page.route('https://fonts.googleapis.com/**',r=>r.abort());
  await page.route('https://fonts.gstatic.com/**',r=>r.abort());
  await page.goto('./'+query,{waitUntil:'load'});
  await expect(page.locator('#legend button').first()).toBeVisible();
}
function total(page){
  return page.locator('#legend .n').allTextContents().then(xs=>xs.reduce((n,v)=>n+Number(v||0),0));
}
test('GBD layer loads all 195 study countries with correct sex-specific category counts',async({page})=>{
  await load(page);
  await page.locator('[data-mode="lung-cancer"]').click();
  await expect(page.locator('#lungControls')).toBeVisible();
  await expect(page.locator('#tbControls')).toBeHidden();
  await expect(page.locator('#legend')).toContainText('100–149.9');
  const expectCounts={both:[90,54,38,13,0],male:[62,46,39,48,0],female:[141,36,15,3,0]};
  for(const [sex,counts] of Object.entries(expectCounts)){
    await page.locator('#lungSex').selectOption(sex);
    await expect(page.locator('#legend .n')).toHaveText(counts.map(String));
    expect(await total(page)).toBe(195);
    await expect(page.locator('#countryTable [data-sort="lung"]')).toContainText(sex==='both'?'both sexes':sex);
  }
});
test('rate and access comparison render on first load; 3 inclusive thresholds, all sexes',async({page},testInfo)=>{
  await load(page,'?layer=lung-cancer&cancerDisplay=access&cancerThreshold=100&cancerSex=female');
  await expect(page.locator('#lungColorBy')).toHaveValue('access');
  await expect(page.locator('#lungThresholds [aria-pressed="true"]')).toHaveAttribute('data-cutoff','100');
  await expect(page.locator('#lungSex')).toHaveValue('female');
  await expect(page.locator('#lungMeta')).toContainText('≥100');
  await expect(page.locator('#legend')).toContainText('Full package available');
  for(const sex of ['both','male','female']){
    await page.locator('#lungSex').selectOption(sex);
    await page.locator('#lungColorBy').selectOption('rate');
    await expect(page.locator('#legend')).toContainText('100–149.9');
    if(sex==='both')await page.screenshot({path:testInfo.outputPath('rate-'+testInfo.project.name+'.png')});
    await page.locator('#lungColorBy').selectOption('access');
    for(const cutoff of ['50','100','150']){
      await page.locator('#lungThresholds [data-cutoff="'+cutoff+'"]').click();
      await expect(page.locator('#lungMeta')).toContainText('≥'+cutoff);
      await expect(page.locator('#lungThresholds [aria-pressed="true"]')).toHaveAttribute('data-cutoff',cutoff);
      expect(await total(page)).toBe(195);
      if(sex==='both')await page.screenshot({path:testInfo.outputPath('comparison-'+cutoff+'-'+testInfo.project.name+'.png')});
    }
  }
});
test('country tooltip, numeric table and sharable country/sex view restore correctly',async({page})=>{
  await load(page,'?layer=lung-cancer&cancerDisplay=access&cancerSex=male&cancerThreshold=150&country=POL');
  await expect(page.locator('.tip.on h2')).toHaveText('Poland');
  await expect(page.locator('.tip.on .lung-summary')).toContainText('206.36');
  await expect(page.locator('.tip.on .lung-summary')).toContainText('143.84');
  await expect(page.locator('.tip.on .lung-summary')).toContainText('92.97');
  await expect(page.locator('.tip.on .foot')).toContainText('≥150');
  await page.locator('#countrySort').evaluate(el=>{el.value='lung:desc';el.dispatchEvent(new Event('change',{bubbles:true}));});
  await expect(page.locator('#countryTable tbody tr').first()).toContainText('Monaco');
  await page.goBack();
  await expect(page.locator('#lungSex')).toHaveValue('male');
  await page.goForward();
  await expect(page.locator('#lungSex')).toHaveValue('male');
});
test('old medicine and TB links remain valid and switch repeatedly without errors',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await load(page,'?layer=tb-incidence&display=access&threshold=200');
  for(const mode of ['lung-cancer','tb-smoking','medicines','tb-incidence','lung-cancer','medicines']){
    await page.locator('[data-mode="'+mode+'"]').click();
    await expect(page.locator('[data-mode="'+mode+'"]')).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('#legend button').first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test('narrow viewport controls never cause horizontal overflow',async({page},testInfo)=>{
  await load(page,'?layer=lung-cancer&cancerDisplay=access');
  for(const w of [320,375,390]){
    await page.setViewportSize({width:w,height:780});
    await expect(page.locator('#lungThresholds button')).toHaveCount(3);
    await expect(page.locator('#lungThresholdField')).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    expect(overflow, 'horizontal document overflow at '+w).toBe(false);
    if(w===375)await page.screenshot({path:testInfo.outputPath('mobile-'+w+'-'+testInfo.project.name+'.png'),fullPage:true});
  }
});
