/* Reproducible Playwright lab measurement, not field Core Web Vitals. */
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('@playwright/test');
const ROOT = path.resolve(__dirname,'../..');
const url = process.env.BASELINE_URL || 'http://127.0.0.1:8766/tobacco_cessacion_map/';
const kind = url.includes('github.io') ? 'production' : 'local';
const file = path.join(ROOT,'baseline-artifacts','performance-'+kind+'.json');
const bytes = Object.fromEntries(['data/world-topology.js','data/map-data.js','data/tb-data.js','assets/map.js','assets/site.css','index.html'].map(p =>
  [p,fs.statSync(path.join(ROOT,p)).size]));
function quantiles(values) {
  const a=values.slice().sort((x,y)=>x-y);
  return {medianMs: Math.round(a[Math.floor(a.length/2)]*10)/10,
    p95Ms: Math.round(a[Math.ceil(.95*a.length)-1]*10)/10};
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  const output={kind,url,sha:process.env.GITHUB_SHA || null,createdAt:new Date().toISOString(),
    browserVersion:browser.version(),staticSourceBytes:bytes,
    methodology:'unthrottled Chromium Playwright laboratory; double-rAF DOM click-to-paint proxy; NOT field INP',
    samples:[]};
  try {
    for(const width of [375,1280]) {
      const context=await browser.newContext({viewport:{width,height:900},colorScheme:'light',locale:'en-US',timezoneId:'UTC'});
      const page=await context.newPage();
      await page.addInitScript(() => {
        window.__vitals={lcp:null,cls:0};
        try {new PerformanceObserver(list=>{for(const e of list.getEntries()) window.__vitals.lcp=e.startTime;})
          .observe({type:'largest-contentful-paint',buffered:true});}catch(e){}
        try {new PerformanceObserver(list=>{for(const e of list.getEntries()) if(!e.hadRecentInput) window.__vitals.cls+=e.value;})
          .observe({type:'layout-shift',buffered:true});}catch(e){}
      });
      const failures=[];
      page.on('pageerror',e=>failures.push(e.message));
      const start=Date.now();
      try {
        await page.goto(url,{waitUntil:'load',timeout:30000});
        await page.locator('#legend button').first().waitFor({timeout:20000});
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        const readyMs=Date.now()-start;
        const metrics=await page.evaluate(()=>{
          const nav=performance.getEntriesByType('navigation')[0];
          const paint=performance.getEntriesByName('first-contentful-paint')[0];
          const resources=performance.getEntriesByType('resource').map(r=>({
            name:r.name.split('/').slice(-2).join('/').slice(0,160),
            durationMs:Math.round(r.duration),encodedBodySize:r.encodedBodySize,transferSize:r.transferSize
          }));
          return {ttfbMs:nav?nav.responseStart:null,domContentLoadedMs:nav?nav.domContentLoadedEventEnd:null,
            loadEventMs:nav?nav.loadEventEnd:null,fcpMs:paint?paint.startTime:null,
            lcpMs:window.__vitals.lcp,cls:window.__vitals.cls,resources};
        });
        const interactions={};
        for(const [name,selector] of [
          ['tb-incidence','.map-mode [data-mode="tb-incidence"]'],
          ['tb-smoking','.map-mode [data-mode="tb-smoking"]'],
          ['medicines','.map-mode [data-mode="medicines"]'],
          ['tb-comparison','.map-mode [data-mode="tb-incidence"]']
        ]) {
          const times=[];
          for(let i=0;i<7;i++) {
            const ms=await page.evaluate(async s=>{
              const before=performance.now();
              document.querySelector(s).click();
              await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
              return performance.now()-before;
            },selector);
            times.push(ms);
          }
          interactions[name]=quantiles(times);
          if(name==='tb-comparison') {
            const comparison=await page.evaluate(async()=>{
              const select=document.querySelector('#tbColorBy');
              select.value='access';select.dispatchEvent(new Event('change',{bubbles:true}));
              await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
              const results={};
              for(const cutoff of ['100','200','400']){
                const t=performance.now(),el=document.querySelector('#tbCutoff');
                el.value=cutoff;el.dispatchEvent(new Event('change',{bubbles:true}));
                await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
                results['gt'+cutoff]=performance.now()-t;
              }
              return results;
            });
            interactions.thresholdsMs=comparison;
          }
        }
        output.samples.push({width,height:900,mapReadyWallMs:readyMs,...metrics,interactions,
          errors:failures,resourceTimingWarning:'cross-origin / CDN encodedBodySize may be zero'});
      } catch(e) {
        output.samples.push({width,error:String(e),errors:failures});
        if(kind==='local') process.exitCode=1;
      } finally {await context.close();}
    }
  } finally {
    await browser.close();
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,JSON.stringify(output,null,2));
    console.log('PERFORMANCE_INTERACTIONS '+kind+' '+JSON.stringify(output.samples.map(s=>({width:s.width,interactions:s.interactions,error:s.error}))));
    console.log('PERFORMANCE_REPORT '+file+' '+JSON.stringify(output.samples.map(s=>({
      width:s.width,ttfbMs:s.ttfbMs,fcpMs:s.fcpMs,lcpMs:s.lcpMs,cls:s.cls,mapReadyWallMs:s.mapReadyWallMs,error:s.error
    }))));
  }
})().catch(e=>{console.error(e);process.exitCode=1});
