const {test,expect}=require('@playwright/test');
const {deterministic,ready,state}=require('./support.cjs');

test('PR5: preset projection exactly matches the original full-feature fit',async({page})=>{
  await deterministic(page);await ready(page);
  const checked=await page.evaluate(()=>{
    const reference=d3.geoEqualEarth().fitExtent([[8,8],[W-8,H-8]],{type:'FeatureCollection',features:feats});
    const referencePath=d3.geoPath(reference);
    const errors=feats.filter(f=>path(f)!==referencePath(f)).map(f=>f.id);
    const sourceCountries=Object.keys(DATA);
    const polygons=new Set(feats.map(f=>f.id));
    const unrepresented=sourceCountries.filter(id=>!polygons.has(id)&&!DATA[id].ll);
    const locations=sourceCountries.filter(id=>DATA[id].ll);
    const dotsMoved=locations.filter(id=>{
      const a=proj(DATA[id].ll),b=reference(DATA[id].ll);
      return Math.abs(a[0]-b[0])>1e-9||Math.abs(a[1]-b[1])>1e-9;
    });
    return {scaleDifference:Math.abs(reference.scale()-proj.scale()),
      translateDifference:Math.max(...reference.translate().map((n,i)=>Math.abs(n-proj.translate()[i]))),
      errors,unrepresented,dotsMoved,studyCount:sourceCountries.length,
      paths:document.querySelectorAll('#map path.country').length,
      svgPaths:feats.length,
      geometryTypes:feats.map(f=>f.geometry.type)};
  });
  expect(checked.studyCount).toBe(195);
  expect(checked.paths).toBe(checked.svgPaths);
  expect(checked.errors).toEqual([]);
  expect(checked.unrepresented).toEqual([]);
  expect(checked.dotsMoved).toEqual([]);
  expect(checked.scaleDifference).toBeLessThan(1e-11);
  expect(checked.translateDifference).toBeLessThan(1e-11);
});

test('PR5: study country fills, status counts and TB threshold remain unchanged',async({page})=>{
  await deterministic(page);await ready(page);
  const scenarios=['medicines','tb-incidence','tb-smoking','compare-100','compare-200','compare-400'];
  for(const scenario of scenarios){
    await state(page,scenario);
    const result=await page.evaluate(()=>{
      const m=document.querySelector('.map-mode button[aria-pressed="true"]').dataset.mode;
      const display=document.querySelector('#tbColorBy').value;
      const cutoff=Number(document.querySelector('#tbCutoff').value);
      const comparison=m==='tb-incidence'&&display==='access';
      const iso=Object.entries(DATA);
      const getCategory=d=>{
        const amount=[...d.r].filter(c=>c==='A').length;
        const full=d.r[0]==='A'&&d.r[3]==='A'&&(d.r[1]==='A'||d.r[2]==='A');
        if(comparison){
          const v=TB_DATA.countries[d.i]?.incidence;
          if(!Number.isFinite(v))return 'nd';
          if(v<=cutoff)return 'acc-below';
          return full?'acc-full':amount>=2?'acc-two':amount===1?'acc-one':'acc-none';
        }
        if(m!=='medicines'){
          const v=TB_DATA.countries[d.i]?.[m==='tb-incidence'?'incidence':'smoking'];
          if(!Number.isFinite(v))return 'nd';
          const breaks=m==='tb-incidence'?[10,50,100,200,400]:[1,100,1000,10000,50000];
          return 'tb'+breaks.filter(b=>v>=b).length;
        }
        return d.r==='XXXX'?'nd':'c'+amount;
      };
      const expected=Object.fromEntries(iso.map(([id,d])=>[id,getCategory(d)]));
      const failures=[];
      for(const node of document.querySelectorAll('#map path.country:not(.out)')){
        const d=DATA[node.__data__.id];
        const cssVariable=expected[node.__data__.id]==='nd'?'--nodata':'--'+expected[node.__data__.id];
        const color=getComputedStyle(document.documentElement).getPropertyValue(cssVariable).trim();
        const probe=document.createElement('span');probe.style.fill=color;
        if(node.style.fill!==probe.style.fill)failures.push({id:node.__data__.id,actual:node.style.fill,expected:probe.style.fill});
      }
      return {failures,counts:Object.values(expected).reduce((a,k)=>(a[k]=(a[k]||0)+1,a),{}),total:Object.keys(expected).length};
    });
    expect(result.total).toBe(195);
    expect(result.failures,JSON.stringify(result.failures)).toEqual([]);
    expect(Object.values(result.counts).reduce((x,y)=>x+y,0)).toBe(195);
  }
});

test('PR5: zoom, keyboard country search, tooltip and table remain usable',async({page})=>{
  await page.setViewportSize({width:375,height:900});
  await deterministic(page);await ready(page);
  await expect(page.locator('#countryTable tbody tr')).toHaveCount(25);
  await page.locator('#q').fill('Poland');
  await page.locator('#q').dispatchEvent('change');
  await expect(page.getByRole('dialog',{name:'Poland'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#q')).toBeFocused();
  await page.locator('#zin').click();
  await expect(page.locator('#map > g')).not.toHaveAttribute('transform','translate(0,0) scale(1)');
  await page.locator('#zreset').click();
  await expect(page.locator('#map > g')).toHaveAttribute('transform','translate(0,0) scale(1)');
  await page.locator('#countryTableSearch').fill('Poland');
  await expect(page.locator('#countryTable tbody tr')).toHaveCount(1);
  await expect(page.locator('#countryTable tbody tr th')).toHaveText('Poland');
});
