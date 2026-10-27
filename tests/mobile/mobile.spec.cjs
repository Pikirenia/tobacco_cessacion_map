const {test,expect}=require('@playwright/test');
const {deterministic,ready}=require('../baseline/support.cjs');
const widths=[320,375,390,430,768,1024];
async function prepare(page,w,h,scheme){
 await page.setViewportSize({width:w,height:h});
 await page.emulateMedia({colorScheme:scheme,reducedMotion:'reduce'});
 await deterministic(page);
 await page.addInitScript(()=>{
   window.__shifts=[];
   try{new PerformanceObserver(list=>{
     for(const e of list.getEntries())if(!e.hadRecentInput)window.__shifts.push({
       value:e.value,sources:e.sources?.map(s=>({element:s.node?.id||s.node?.tagName,old:s.previousRect,new:s.currentRect}))
     });
   }).observe({type:'layout-shift',buffered:true});}catch(e){}
 });
 await ready(page);
}
async function measure(page,info){
 const data=await page.evaluate(()=>{
   const vw=innerWidth;
   return {viewport:vw,scrollWidth:document.documentElement.scrollWidth,
     offenders:[...document.querySelectorAll('body *')].filter(el=>{
       if(el.closest('#tip')?.getAttribute('aria-hidden')==='true')return false;
       if(!el.getClientRects().length)return false;
       return el.getBoundingClientRect().right>vw+1;
     }).slice(0,15).map(el=>({tag:el.tagName,id:el.id,cls:String(el.className?.baseVal||el.className),
       right:Math.round(el.getBoundingClientRect().right)}))};
 });
 await info.attach('overflow.json',{body:Buffer.from(JSON.stringify(data,null,2)),contentType:'application/json'});
 expect(data.scrollWidth,JSON.stringify(data)).toBeLessThanOrEqual(data.viewport+1);
}
for(const width of widths)for(const scheme of ['light','dark'])for(const orient of ['portrait','landscape']){
 test(`${width} ${scheme} ${orient} visual layout and TB thresholds`,async({page},info)=>{
   const w=orient==='portrait'?width:Math.max(width,700);
   const h=orient==='portrait'?780:Math.min(440,Math.floor(width*.75));
   await prepare(page,w,h,scheme);
   await measure(page,info);
   await expect(page.locator('.map-mode button')).toHaveCount(3);
   await expect(page.locator('#medicineViews button')).toHaveCount(6);
   if(w<=640){
     await expect(page.locator('#mapbox')).toHaveCSS('touch-action','pan-y');
     await expect(page.locator('#map')).toHaveAttribute('preserveAspectRatio','xMidYMid slice');
     await page.locator('#zoverview').click();
     await expect(page.locator('#map')).toHaveAttribute('preserveAspectRatio','xMidYMid meet');
     await page.locator('#zoverview').click();
   }
   await expect(page.locator('#mapbox')).toHaveScreenshot(`${width}-${scheme}-${orient}-accessibility-pr4.png`);
   await page.locator('.map-mode [data-mode="tb-incidence"]').click();
   await page.locator('#tbColorBy').selectOption('access');
   for(const cutoff of ['100','200','400']){
     await page.locator('#tbThresholds [data-cutoff="'+cutoff+'"]').click();
     await expect(page.locator('#tbMeta')).toContainText('>'+cutoff);
     await measure(page,info);
   }
   await page.locator('#tbColorBy').selectOption('rate');
   await page.locator('#tbMedicine').selectOption('full');
   await page.locator('#tbStatus').selectOption('U');
   await page.locator('.map-mode [data-mode="tb-smoking"]').click();
   await page.locator('.map-mode [data-mode="medicines"]').click();
   await page.locator('#medicineViews [data-view="full"]').click();
   await measure(page,info);
   await info.attach('layout-shifts.json',{body:Buffer.from(JSON.stringify(
     await page.evaluate(()=>window.__shifts),null,2)),contentType:'application/json'});
 });
}
for(const width of [320,375,390,430,768,1024]){
 test(`${width} country detail, search, tap, history, controls`,async({page},info)=>{
   await prepare(page,width,780,'light');
   await page.locator('#q').fill('Poland');
   await page.locator('#q').dispatchEvent('change');
   await expect(page.locator('#tip.on h2')).toHaveText('Poland');
   await expect(page.locator('#tip')).toHaveAttribute('aria-hidden','false');
   await expect(page.locator('#tip .tb-summary')).toContainText('Smoking-attributable TB cases');
   await expect(page.locator('#tip .medicine-card')).toHaveCount(4);
   await expect(page.locator('#tip .foot')).toContainText('essential medicines list');
   if(width<=640){
     await expect(page.locator('#tip')).toHaveClass(/sheet/);
     await expect(page.locator('#tip .medicine-card').first()).toBeVisible();
     const size=await page.locator('#tip').evaluate(el=>({height:el.getBoundingClientRect().height,screen:innerHeight}));
     expect(size.height).toBeLessThanOrEqual(size.screen);
     await page.locator('#tip').evaluate(el=>el.scrollTop=el.scrollHeight);
     await info.attach('details.png',{body:await page.screenshot(),contentType:'image/png'});
   }
   await page.keyboard.press('Escape');
   await expect(page.locator('#tip')).toHaveAttribute('aria-hidden','true');
   await page.locator('#zin').click();
   await expect(page.locator('#map > g')).not.toHaveAttribute('transform','translate(0,0) scale(1)');
   await page.locator('#zreset').click();
   await expect(page.locator('#map > g')).toHaveAttribute('transform','translate(0,0) scale(1)');
   await page.getByRole('link',{name:'Submit country feedback'}).click();
   await page.goBack();
   await expect(page.locator('#legend button').first()).toBeVisible();
   await page.goForward();
   await expect(page.locator('#country option')).toHaveCount(196);
   await page.goBack();
   await measure(page,info);
 });
}
test('small islands retain search and transparent touch target',async({page})=>{
 await prepare(page,375,780,'light');
 expect(await page.locator('circle.dot').count()).toBeGreaterThan(0);
 expect(await page.locator('circle.tap-target').count()).toBeGreaterThan(0);
 await page.locator('#q').fill('Maldives');
 await page.locator('#q').dispatchEvent('change');
 await expect(page.locator('#tip h2')).toHaveText('Maldives');
 await page.locator('#tip .x').click();
 await page.locator('circle.tap-target').first().dispatchEvent('click',{clientX:130,clientY:200});
 await expect(page.locator('#tip.on h2')).toBeVisible();
});
test('single-finger touch does not pan; two-finger gesture zooms',async({page},testInfo)=>{
 test.skip(testInfo.project.name==='mobile-webkit', 'Linux WebKit rejects constructed Touch objects; verify real Safari pinch on device');
 await prepare(page,375,780,'light');
 const r=await page.evaluate(()=>{
   const svg=document.querySelector('#map'),g=svg.querySelector('g');
   const touch=(x,y,id)=>new Touch({identifier:id,target:svg,clientX:x,clientY:y,pageX:x,pageY:y,screenX:x,screenY:y});
   const fire=(type,t)=>svg.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,
     touches:t,targetTouches:t,changedTouches:t}));
   const before=g.getAttribute('transform');
   fire('touchstart',[touch(100,190,1)]);
   fire('touchmove',[touch(130,220,1)]);
   const afterOne=g.getAttribute('transform');
   fire('touchend',[]);
   fire('touchstart',[touch(100,190,1),touch(210,190,2)]);
   fire('touchmove',[touch(60,190,1),touch(250,190,2)]);
   const afterTwo=g.getAttribute('transform');
   fire('touchend',[]);
   return {before,afterOne,afterTwo};
 });
 expect(r.afterOne).toBe(r.before);
 expect(r.afterTwo).not.toBe(r.before);
});
