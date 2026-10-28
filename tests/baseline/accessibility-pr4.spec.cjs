
const {test,expect}=require('@playwright/test');
const {deterministic,ready,state}=require('./support.cjs');
const fs=require('node:fs');
const axe=require.resolve('axe-core/axe.min.js');

async function visit(page,width,scheme,scenario='medicines'){
  await page.setViewportSize({width,height:900});
  await page.emulateMedia({colorScheme:scheme,reducedMotion:'reduce'});
  await deterministic(page);
  if(scenario==='feedback'){
    await page.goto('feedback/');
  }else{
    await ready(page);
    if(scenario==='details'){
      await page.locator('#q').fill('Poland');
      await page.locator('#q').dispatchEvent('change');
      await expect(page.locator('#tip')).toHaveAttribute('aria-hidden','false');
    } else await state(page,scenario);
  }
}

for(const width of [375,1280])for(const scheme of ['light','dark'])
  for(const scenario of ['medicines','tb-incidence','tb-smoking','compare-100','compare-200','compare-400','details','feedback']){
    test(`PR4 axe ${width} ${scheme} ${scenario} serious/critical regression`,async({page},info)=>{
      await visit(page,width,scheme,scenario);
      await page.addScriptTag({path:axe});
      const result=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}}));
      const errors=result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
      await info.attach('pr4-axe.json',{body:Buffer.from(JSON.stringify({width,scheme,scenario,violations:errors},null,2)),contentType:'application/json'});
      console.log('PR4_AXE',JSON.stringify({width,scheme,scenario,violations:errors.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}))}));
      const bad=errors.filter(v=>['serious','critical'].includes(v.impact));
      expect(bad,JSON.stringify(errors,null,2)).toEqual([]);
    });
  }

test('semantic landmarks, named country dialog, keyboard dismissal, restored focus',async({page})=>{
  await visit(page,1280,'light');
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('navigation',{name:'Contribute'})).toHaveCount(1);
  await expect(page.getByRole('contentinfo')).toHaveCount(1);
  await expect(page.getByRole('region',{name:'Geographic exploration'})).toHaveCount(1);
  await expect(page.getByRole('region',{name:'Methods and data interpretation'})).toHaveCount(1);
  await expect(page.getByRole('table',{name:'Smoking cessation medicine access, tuberculosis and lung cancer burden, by country'})).toHaveCount(1);
  await page.locator('#q').fill('Poland');
  await page.locator('#q').dispatchEvent('change');
  await expect(page.getByRole('dialog',{name:'Poland'})).toBeVisible();
  await expect(page.getByRole('dialog',{name:'Poland'})).toHaveAttribute('aria-modal','false');
  await expect(page.locator('#tip .x')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#q')).toBeFocused();
  await expect(page.locator('#tip')).toHaveAttribute('aria-hidden','true');
});
test('mobile modal country sheet contains focus and returns it to search',async({page})=>{
  await visit(page,375,'dark');
  await page.locator('#q').fill('Poland');
  await page.locator('#q').dispatchEvent('change');
  await expect(page.getByRole('dialog',{name:'Poland'})).toHaveAttribute('aria-modal','true');
  await expect(page.locator('#tip .x')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#tip .x')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#tip .x')).toBeFocused();
  await expect(page.locator('#tip .medicine-card')).toHaveCount(4);
  await page.keyboard.press('Escape');
  await expect(page.locator('#q')).toBeFocused();
});
test('table renders all countries from validated map data; missing is not zero',async({page})=>{
  await visit(page,1280,'light');
  const summary=await page.evaluate(()=>{
    const source=Object.values(DATA);
    const trs=[...document.querySelectorAll('#countryTable tbody tr')];
    return {source:source.length,rows:trs.length,
      first:trs[0]?.querySelector('th')?.textContent,
      missingCount:trs.filter(r=>r.textContent.includes('No data')).length,
      zeroTB:[...trs].filter(r=>r.cells[6].textContent==='0'||r.cells[7].textContent==='0').length};
  });
  expect(summary.source).toBe(195);
  expect(summary.rows).toBe(25);
  expect(summary.first).toBe('Afghanistan');
  expect(summary.missingCount).toBeGreaterThan(0);
  await page.locator('#countryTableSearch').fill('Poland');
  await expect(page.locator('#countryTable tbody tr')).toHaveCount(1);
  await expect(page.locator('#countryTable tbody tr th')).toHaveText('Poland');
  await expect(page.locator('#countryTableCount')).toContainText('1 of 1');
  await page.locator('#countryTableSearch').fill('');
  await expect(page.locator('#countryTable tbody tr')).toHaveCount(25);
  const all=new Set();
  for(let p=0;p<8;p++){
    for(const name of await page.locator('#countryTable tbody tr th').allTextContents())all.add(name);
    if(p<7)await page.locator('#tableNext').click();
  }
  expect(all.size).toBe(summary.source);
  await expect(page.locator('#tableNext')).toBeDisabled();
  await expect(page.locator('#countryTable [data-key="name"]')).toHaveAttribute('aria-sort','ascending');
  await page.locator('#countryTable [data-sort="name"]').click();
  await expect(page.locator('#countryTable [data-key="name"]')).toHaveAttribute('aria-sort','descending');
  await page.locator('#countryTable [data-sort="incidence"]').click();
  await expect(page.locator('#countryTable [data-key="incidence"]')).toHaveAttribute('aria-sort','ascending');
  const numbers=await page.locator('#countryTable tbody tr td:nth-child(7)').allTextContents();
  const vals=numbers.filter(v=>v!=='No data').map(Number);
  expect(vals).toEqual([...vals].sort((a,b)=>a-b));
  const trailing=numbers.slice(vals.length);
  expect(trailing.every(v=>v==='No data')).toBeTruthy();
});
test('table sort and search work by keyboard without hundreds of SVG tab stops',async({page})=>{
  await visit(page,375,'light');
  const tabStops=await page.locator('#map [tabindex="0"]').count();
  expect(tabStops).toBe(0);
  await page.locator('#countryTableSearch').focus();
  await page.keyboard.type('United');
  await expect(page.locator('#countryTableCount')).toContainText('matching countries');
  const shown=await page.locator('#countryTable tbody tr').count();
  expect(shown).toBeGreaterThan(0);
  expect(shown).toBeLessThan(195);
  await page.locator('#countrySort').focus();
  await page.keyboard.press('End');
  await page.locator('#countrySort').selectOption('name:desc');
  await expect(page.locator('#countryTable [data-key="name"]')).toHaveAttribute('aria-sort','descending');
  const scroll=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(scroll).toBeLessThanOrEqual(1);
});
test('controls, legend, TB thresholds, feedback remain operable via keyboard',async({page})=>{
  await visit(page,1280,'light');
  await page.locator('[data-mode="tb-incidence"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-mode="tb-incidence"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#tbColorBy').selectOption('access');
  await page.locator('[data-cutoff="200"]').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('[data-cutoff="200"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#legend button').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#legend button').first()).toHaveAttribute('aria-pressed','true');
  await page.locator('#zin').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#map > g')).not.toHaveAttribute('transform','translate(0,0) scale(1)');
  await page.getByRole('link',{name:'Submit country feedback'}).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#feedback-form')).toBeVisible();
});
test('contrast ratios for representative live text are at least 4.5:1, light and dark',async({page})=>{
  for(const scheme of ['light','dark']){
    await visit(page,1280,scheme);
    const ratios=await page.evaluate(()=>{
      function rgb(s){return s.match(/[\d.]+/g).slice(0,3).map(Number)}
      function lin(x){const v=x/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}
      function luminance(c){const [r,g,b]=rgb(c).map(lin);return .2126*r+.7152*g+.0722*b}
      function ratio(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
      const selectors=['.credit','#countryTableHelp','#countryTableCount','#countryTable tbody td','.legend .label','.toolbar-label','.tip .foot'];
      const result=[];
      for(const sel of selectors){
        const el=document.querySelector(sel);if(!el||!el.getClientRects().length)continue;
        const fg=getComputedStyle(el).color;
        let parent=el,bg='rgb(255, 255, 255)';
        while(parent){const value=getComputedStyle(parent).backgroundColor;if(value!=='rgba(0, 0, 0, 0)'&&value!=='transparent'){bg=value;break;}parent=parent.parentElement;}
        result.push({sel,ratio:ratio(fg,bg)});
      }
      return result;
    });
    for(const item of ratios)expect(item.ratio,`${scheme} ${item.sel}`).toBeGreaterThanOrEqual(4.5);
  }
});
test('candidate PR4 screenshots at 375 and 1280 px in both themes',async({page},info)=>{
  for(const width of [375,1280])for(const scheme of ['light','dark']){
    await visit(page,width,scheme);
    await info.attach(`pr4-${width}-${scheme}-map.png`,{body:await page.locator('#mapbox').screenshot(),contentType:'image/png'});
    await info.attach(`pr4-${width}-${scheme}-table.png`,{body:await page.locator('#countryData').screenshot(),contentType:'image/png'});
  }
});

test('320 and 640 CSS-pixel viewport equivalents for 400% and 200% zoom reflow',async({page})=>{
  for(const width of [320,640]){
    await visit(page,width,'light');
    const state=await page.evaluate(()=>({
      viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
      search:document.getElementById('countryTableSearch').getBoundingClientRect().width,
      rows:document.querySelectorAll('#countryTable tbody tr').length,
      sortVisible:getComputedStyle(document.getElementById('countrySort')).display!=='none'
    }));
    expect(state.scroll,`document overflow at ${width}px`).toBeLessThanOrEqual(state.viewport+1);
    expect(state.search).toBeGreaterThan(100);
    expect(state.rows).toBe(25);
    expect(state.sortVisible).toBeTruthy();
  }
});
