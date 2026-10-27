/* PR5 controlled laboratory instrumentation. Does not alter production JavaScript. */
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'../..');
const url='http://127.0.0.1:8766/tobacco_cessacion_map/';
const source=fs.readFileSync(path.join(root,'assets/map.js'),'utf8');
const d3Source=fs.readFileSync(path.join(root,'node_modules/d3/dist/d3.min.js'),'utf8');
const topoSource=fs.readFileSync(path.join(root,'node_modules/topojson-client/dist/topojson-client.min.js'),'utf8');
function annotate(s){
  const segments=[
    ['const feats=','performance.mark("pr5:topology-start");\nconst feats='],
    ['const proj=','performance.mark("pr5:topology-end");\nconst proj='],
    ['const countries=','performance.mark("pr5:svg-start");\nconst countries='],
    ['const path=','performance.mark("pr5:fit-end");\nconst path='],
    ['const dotData=','performance.mark("pr5:svg-end");\nconst dotData='],
    ['// tooltip','performance.mark("pr5:init-end");\n// tooltip']
  ];
  for(const [from,to] of segments){
    if(!s.includes(from))throw Error('Instrumentation anchor missing: '+from);
    s=s.replace(from,to);
  }
  return s;
}
const instrumented=annotate(source);
const median=a=>{const s=[...a].sort((a,b)=>a-b);return +(s[Math.floor(s.length/2)]||0).toFixed(2)};
const summary=a=>({median:median(a),min:+Math.min(...a).toFixed(2),max:+Math.max(...a).toFixed(2),values:a.map(x=>+x.toFixed(2))});
async function main(){
 const browser=await chromium.launch({headless:true});
 const all={sha:process.env.GITHUB_SHA,platform:process.platform,chrome:browser.version(),repeats:5,
    type:'controlled laboratory only; cold browser contexts; CDN JS fulfilled locally, Google Fonts blocked; no field INP',samples:[]};
 try{
  for(const width of [375,1280]){
   for(let i=0;i<5;i++){
    const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,locale:'en-US',timezoneId:'UTC',reducedMotion:'reduce'});
    await context.route('https://cdnjs.cloudflare.com/ajax/libs/d3/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:d3Source}));
    await context.route('https://cdn.jsdelivr.net/npm/topojson-client@**',r=>r.fulfill({status:200,contentType:'application/javascript',body:topoSource}));
    await context.route('https://fonts.googleapis.com/**',r=>r.abort());
    await context.route('https://fonts.gstatic.com/**',r=>r.abort());
    await context.route('**/assets/map.js*',r=>r.fulfill({status:200,contentType:'application/javascript',body:instrumented}));
    const page=await context.newPage(),errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    await page.addInitScript(()=>{
      window.__pr5={lcp:0,cls:0};
      try{new PerformanceObserver(list=>{for(const e of list.getEntries())window.__pr5.lcp=e.startTime})
        .observe({type:'largest-contentful-paint',buffered:true})}catch(e){}
      try{new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__pr5.cls+=e.value})
        .observe({type:'layout-shift',buffered:true})}catch(e){}
    });
    await page.goto(url,{waitUntil:'load',timeout:60000});
    await page.locator('#legend button').first().waitFor();
    const sample=await page.evaluate(async()=>{
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const nav=performance.getEntriesByType('navigation')[0],
            fcp=performance.getEntriesByName('first-contentful-paint')[0],
            marks=Object.fromEntries(performance.getEntriesByType('mark').filter(x=>x.name.startsWith('pr5:')).map(x=>[x.name,x.startTime]));
      const durations={
        topology:marks['pr5:topology-end']-marks['pr5:topology-start'],
        projectionFit:marks['pr5:fit-end']-marks['pr5:topology-end'],
        svgPaths:marks['pr5:svg-end']-marks['pr5:svg-start'],
        fullMapInitialization:marks['pr5:init-end']-marks['pr5:topology-start']
      };
      const measure=async fn=>{
        const begin=performance.now();
        fn();
        const sync=performance.now()-begin;
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        return {sync,frames:performance.now()-begin};
      };
      const steps=[];
      const scenarios=[
        ['tb-incidence',()=>document.querySelector('.map-mode [data-mode="tb-incidence"]').click()],
        ['tb-smoking',()=>document.querySelector('.map-mode [data-mode="tb-smoking"]').click()],
        ['medicines',()=>document.querySelector('.map-mode [data-mode="medicines"]').click()],
        ['full-package',()=>document.querySelector('#medicineViews [data-view="full"]').click()],
        ['all-four',()=>document.querySelector('#medicineViews [data-view="all"]').click()],
        ['tb-compare',()=>{
          document.querySelector('.map-mode [data-mode="tb-incidence"]').click();
          const s=document.querySelector('#tbColorBy');s.value='access';s.dispatchEvent(new Event('change'));
        }],
        ['threshold-200',()=>document.querySelector('#tbThresholds [data-cutoff="200"]').click()],
        ['threshold-400',()=>document.querySelector('#tbThresholds [data-cutoff="400"]').click()],
        ['threshold-100',()=>document.querySelector('#tbThresholds [data-cutoff="100"]').click()],
        ['legend',()=>document.querySelector('#legend button').click()],
        ['search',()=>{
          document.querySelector('#q').value='Poland';
          document.querySelector('#q').dispatchEvent(new Event('change'));
        }],
        ['tooltip-close',()=>document.querySelector('#tip .x').click()],
        ['zoom-in',()=>document.querySelector('#zin').click()],
        ['zoom-reset',()=>document.querySelector('#zreset').click()]
      ];
      for(const [name,fn] of scenarios){const t=await measure(fn);steps.push({name,...t})}
      const src=performance.getEntriesByType('resource').map(r=>({name:r.name.split('/').pop(),duration:r.duration,transfer:r.transferSize,encoded:r.encodedBodySize}));
      return {nav:{domContentLoaded:nav.domContentLoadedEventEnd,load:nav.loadEventEnd,fcp:fcp?.startTime||null,
          lcp:window.__pr5.lcp,cls:window.__pr5.cls},durations,steps,resources:src,
          projection:{scale:proj.scale(),translate:proj.translate(),center:proj.center(),rotate:proj.rotate()},
          countryPaths:document.querySelectorAll('path.country').length,
          mapCountries:Object.keys(DATA).length,
          mapLabel:document.querySelector('#map').getAttribute('aria-label')};
    });
    all.samples.push({width,repeat:i+1,...sample,errors});
    await context.close();
   }
  }
 }finally{await browser.close()}
 const grouped={};
 for(const width of [375,1280]){
  const ss=all.samples.filter(s=>s.width===width);grouped[width]={samples:ss.length};
  for(const prop of ['fcp','lcp','cls','load'])grouped[width][prop]=summary(ss.map(x=>x.nav[prop]).filter(Number.isFinite));
  for(const prop of ['topology','projectionFit','svgPaths','fullMapInitialization'])grouped[width][prop]=summary(ss.map(x=>x.durations[prop]));
  grouped[width].interactions=Object.fromEntries(ss[0].steps.map(({name})=>[
     name,{sync:summary(ss.map(x=>x.steps.find(y=>y.name===name).sync)),
      doubleRaf:summary(ss.map(x=>x.steps.find(y=>y.name===name).frames))}]));
 }
 const dir=path.join(root,'performance-artifacts');
 fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'playwright-profile.json'),JSON.stringify({...all,summary:grouped},null,2));
 console.log('PR5_PROJECTION',JSON.stringify(all.samples[0].projection));
 console.log('PR5_PROFILE',JSON.stringify(grouped));
 if(all.samples.some(x=>x.errors.length||x.mapCountries!==195))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1});
