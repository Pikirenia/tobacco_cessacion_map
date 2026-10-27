const {test,expect} = require('@playwright/test');

// PR8 assertions operate only on the locally served integration checkout.
test('all 195 source countries retain exact independent medicine and full-package classifications',async({page})=>{
  await page.goto('./');
  await expect(page.locator('#legend button').first()).toBeVisible();
  const result=await page.evaluate(()=>{
    const rows=Object.values(DATA);
    const full=d=>d.r[0]==='A'&&d.r[3]==='A'&&(d.r[1]==='A'||d.r[2]==='A');
    const count=Object.fromEntries(['c0','c1','c2','c3','c4','nd'].map(k=>[k,rows.filter(d=>klass(d,'all')===k).length]));
    const observed=Object.fromEntries([...document.querySelectorAll('#legend button')].map(el=>[
      el.querySelector('.label').textContent.trim(),
      Number(el.querySelector('.n').textContent.trim())]));
    return {
      iso:rows.map(d=>d.i),missing:rows.filter(d=>!d.i||!d.n||!/^[AUX]{4}$/.test(d.r)).length,
      full:rows.filter(full).length,valid:rows.every(d=>full(d)===fullSet(d)),count,observed
    };
  });
  expect(result.iso).toHaveLength(195);
  expect(new Set(result.iso).size).toBe(195);
  expect(result.missing).toBe(0);
  expect(result.valid).toBe(true);
  expect(result.full).toBe(41);
  expect(result.observed['Full package']).toBe(result.full);
  for(const [key,label] of Object.entries({
    c0:'None available',c1:'1 available',c2:'2 available',
    c3:'3 available',c4:'All 4 available',nd:'No data'
  }))expect(result.observed[label],label).toBe(result.count[key]);

  for(const view of ['full','0','1','2','3','all']){
    await page.locator('#medicineViews [data-view="'+view+'"]').click();
    const totals=await page.evaluate(()=>{
      const rows=Object.values(DATA);
      const selected=document.querySelector('#medicineViews [aria-pressed="true"]').dataset.view;
      const codes=['c0','c4','nd'];
      const expected=Object.fromEntries(codes.map(c=>[c,rows.filter(d=>klass(d,selected)===c).length]));
      const legend=[...document.querySelectorAll('#legend button')].map(el=>({
        label:el.querySelector('.label').textContent.trim(),count:Number(el.querySelector('.n').textContent)}));
      return {selected,expected,legend};
    });
    expect(totals.selected).toBe(view);
    expect(totals.legend.filter(x=>x.label!=='Full package').reduce((a,x)=>a+x.count,0)).toBe(195);
    if(view==='full')expect(totals.legend.find(x=>x.label==='Full package available').count).toBe(41);
  }
});

test('TB comparison is strictly greater than every boundary; missing and true zero are different',async({page})=>{
  await page.route('**/data/tb-data.js*',route=>route.fulfill({
    contentType:'application/javascript',
    body:'const TB_DATA = '+JSON.stringify({
      year:2024,updated:'2026-10-27T00:00:00Z',source:'WHO Global Tuberculosis Programme',
      countries:{
        POL:{incidence:100,smoking:0},DEU:{incidence:200,smoking:null},
        ESP:{incidence:400,smoking:50},BLR:{incidence:401,smoking:200},
        AFG:{incidence:null,smoking:null}
      }})+';'
  }));
  await page.goto('./?layer=tb-incidence&display=access&threshold=100');
  await expect(page.locator('#tbThresholdField')).toBeVisible();
  for(const [cutoff,boundary] of [['100','POL'],['200','DEU'],['400','ESP']]){
    await page.locator('#tbThresholds [data-cutoff="'+cutoff+'"]').click();
    const result=await page.evaluate(codes=>{
      return Object.fromEntries(codes.map(iso=>{
        const d=Object.values(DATA).find(x=>x.i===iso);
        return [iso,tbAccessClass(d)];
      }));
    },[boundary,'BLR','AFG']);
    expect(result[boundary]).toBe('acc-below');
    expect(result.BLR).not.toBe('acc-below');
    expect(result.AFG).toBe('nd');
    await expect(page.locator('#tbMeta')).toContainText('>'+cutoff);
  }
  await page.locator('#tbColorBy').selectOption('rate');
  await page.locator('.map-mode [data-mode="tb-smoking"]').click();
  const check=await page.evaluate(()=>{
    const d=Object.values(DATA).find(d=>d.i==='POL');
    const missing=Object.values(DATA).find(d=>d.i==='DEU');
    return {zero:tbValue(d),zeroClass:tbClass(d),missing:tbValue(missing),missingClass:tbClass(missing)};
  });
  expect(check.zero).toBe(0);
  expect(check.zeroClass).toBe('tb0');
  expect(check.missing).toBeNull();
  expect(check.missingClass).toBe('nd');
});

for(const width of [320,375,390,430,768,1024,1280,1440]){
  test('PR8 '+width+'px light/dark map, country table and feedback avoid page overflow',async({page})=>{
    for(const scheme of ['light','dark']){
      await page.setViewportSize({width,height:width<=430?790:900});
      await page.emulateMedia({colorScheme:scheme,reducedMotion:'reduce'});
      await page.goto('./?layer=tb-incidence&display=access&threshold=400');
      await expect(page.locator('#map path.country:not(.out)').first()).toBeVisible();
      await expect(page.locator('#countryTable')).toBeAttached();
      let overflow=await page.evaluate(()=>({
        viewport:innerWidth,document:document.documentElement.scrollWidth
      }));
      expect(overflow.document,'map '+width+' '+scheme).toBeLessThanOrEqual(overflow.viewport+1);
      await page.goto('feedback/');
      await expect(page.locator('.medicine')).toHaveCount(4);
      overflow=await page.evaluate(()=>({
        viewport:innerWidth,document:document.documentElement.scrollWidth
      }));
      expect(overflow.document,'feedback '+width+' '+scheme).toBeLessThanOrEqual(overflow.viewport+1);
    }
  });
}
