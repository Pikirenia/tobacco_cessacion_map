/* Same-run head-to-head comparison: local main vs optimization, equal browser, runner and resources. */
const fs=require('fs');
const path=require('path');
const zlib=require('zlib');
const {chromium}=require('@playwright/test');
const dir=path.resolve(__dirname,'../..');
const versions={
  old:{root:path.join(dir,'old_site/tobacco_cessacion_map'),url:'http://127.0.0.1:8766/tobacco_cessacion_map/'},
  new:{root:path.join(dir,'new_site/tobacco_cessacion_map'),url:'http://127.0.0.1:8767/tobacco_cessacion_map/'}
};
const d3source=fs.readFileSync(path.join(dir,'node_modules/d3/dist/d3.min.js'),'utf8');
const toposource=fs.readFileSync(path.join(dir,'node_modules/topojson-client/dist/topojson-client.min.js'),'utf8');
const median=arr=>{let a=[...arr].sort((x,y)=>x-y);return a[Math.floor(a.length/2)]};
const summary=arr=>{
  let a=arr.filter(Number.isFinite).sort((x,y)=>x-y);
  return {n:a.length,median:Math.round(median(a)*100)/100,min:Math.round(a[0]*100)/100,max:Math.round(a[a.length-1]*100)/100,all:a.map(v=>Math.round(v*100)/100)};
};
const samples=[],count=12;
async function runOne(browser,version,width,i){
 const conf=versions[version];
 const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,timezoneId:'UTC',locale:'en-US',colorScheme:'light',reducedMotion:'reduce'});
 await context.route('https://cdnjs.cloudflare.com/ajax/libs/d3/**',route=>route.fulfill({contentType:'application/javascript',body:d3source}));
 await context.route('https://cdn.jsdelivr.net/npm/topojson-client@**',route=>route.fulfill({contentType:'application/javascript',body:toposource}));
 await context.route('https://fonts.googleapis.com/**',route=>route.abort());
 await context.route('https://fonts.gstatic.com/**',route=>route.abort());
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.__bench={cls:0,lcp:null};
  try{new PerformanceObserver(list=>{
    for(const entry of list.getEntries())if(!entry.hadRecentInput)window.__bench.cls+=entry.value;
  }).observe({type:'layout-shift',buffered:true})}catch(e){}
  try{new PerformanceObserver(list=>{
    for(const entry of list.getEntries())window.__bench.lcp=entry.startTime;
  }).observe({type:'largest-contentful-paint',buffered:true})}catch(e){}
 });
 const start=performance.now();
 try{
  await page.goto(conf.url,{waitUntil:'load',timeout:30000});
  await page.locator('#legend button').first().waitFor({timeout:15000});
  await page.locator('#map path.country').first().waitFor({timeout:15000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const mapReady=performance.now()-start;
  const observation=await page.evaluate(()=>{
    const nav=performance.getEntriesByType('navigation')[0];
    const fcp=performance.getEntriesByName('first-contentful-paint')[0];
    return {fcp:fcp?.startTime||null,lcp:window.__bench.lcp,cls:window.__bench.cls,
      dcl:nav?.domContentLoadedEventEnd,load:nav?.loadEventEnd,
      mapPaths:document.querySelectorAll('#map path.country').length,
      documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth};
  });
  const interactions=await page.evaluate(()=>{
    const t={};
    const act=(name,fn)=>{let p=performance.now();fn();t[name]=performance.now()-p;};
    const click=s=>document.querySelector(s).click();
    const select=(s,v)=>{const el=document.querySelector(s);el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));};
    act('tb-incidence',()=>click('.map-mode [data-mode="tb-incidence"]'));
    act('tb-smoking',()=>click('.map-mode [data-mode="tb-smoking"]'));
    act('medicines',()=>click('.map-mode [data-mode="medicines"]'));
    act('full-package',()=>click('#medicineViews [data-view="full"]'));
    act('all-four',()=>click('#medicineViews [data-view="all"]'));
    click('.map-mode [data-mode="tb-incidence"]');
    act('tb-comparison',()=>select('#tbColorBy','access'));
    act('threshold-200',()=>select('#tbCutoff','200'));
    act('threshold-400',()=>select('#tbCutoff','400'));
    act('threshold-100',()=>select('#tbCutoff','100'));
    act('search',()=>{const q=document.querySelector('#q');q.value='Poland';q.dispatchEvent(new Event('change',{bubbles:true}));});
    return t;
  });
  if(errors.length)throw Error('Page JavaScript exception(s): '+errors.join('; '));
  const obj={version,width,i,mapReadyMs:mapReady,...observation,interactions};
  samples.push(obj);
  console.log('PAIR_SAMPLE '+JSON.stringify({version,width,i,mapReadyMs:Math.round(mapReady),fcp:observation.fcp,cls:observation.cls,tbCompareMs:interactions['tb-comparison']}));
 }finally{await context.close()}
}
async function main(){
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [375,1280])for(let i=0;i<count;i++){
    const order=i%2?['new','old']:['old','new'];
    for(const ver of order)await runOne(browser,ver,width,i);
  }
 }finally{await browser.close()}
 const report={method:'12 alternating A/B cold-context pairs per viewport, same runner, same Chromium, same static HTTP serving, D3 and topojson served from identical pinned local packages, fonts blocked; no network throttling; lab only',count,
  browser:browser.version(),samples,summary:{}};
 for(const width of [375,1280]){
  report.summary[width]={};
  for(const ver of ['old','new']){
   const set=samples.filter(x=>x.width===width&&x.version===ver);
   report.summary[width][ver]={};
   for(const key of ['mapReadyMs','fcp','lcp','cls','dcl','load'])report.summary[width][ver][key]=summary(set.map(x=>x[key]));
   report.summary[width][ver].interactions={};
   for(const name of Object.keys(set[0].interactions))report.summary[width][ver].interactions[name]=summary(set.map(x=>x.interactions[name]));
  }
 }
 const resources=['index.html','assets/map.js','assets/site.css','assets/share-state.js','data/map-data.js','data/tb-data.js','data/world-topology.js'];
 report.resources={};
 for(const [name,v] of Object.entries(versions)){
  report.resources[name]={};
  for(const rel of resources){
   const f=path.join(v.root,rel);
   if(!fs.existsSync(f))continue;
   const d=fs.readFileSync(f);
   report.resources[name][rel]={rawBytes:d.length,gzipBytes:zlib.gzipSync(d,{level:9}).length};
  }
 }
 fs.mkdirSync(path.join(dir,'compare-artifacts'),{recursive:true});
 fs.writeFileSync(path.join(dir,'compare-artifacts','playwright-ab.json'),JSON.stringify(report,null,2));
 console.log('AB_FINAL_SUMMARY '+JSON.stringify({summary:report.summary,resources:report.resources}));
}
main().catch(e=>{console.error(e);process.exit(1)});
