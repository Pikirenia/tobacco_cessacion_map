const fs=require('node:fs'),path=require('node:path');
const dir='baseline-artifacts', rows=[];
for(const site of ['local','production']) for(const device of ['mobile','desktop']) {
  const name=path.join(dir,'lighthouse-'+site+'-'+device+'.json');
  if(!fs.existsSync(name)){rows.push({site,device,status:'not measured'});continue;}
  const json=JSON.parse(fs.readFileSync(name,'utf8'));
  const a=json.audits||{}, m=x=>a[x]&&a[x].numericValue!=null?Math.round(a[x].numericValue*10)/10:null;
  rows.push({site,device,performanceScore:json.categories?.performance?.score,
    accessibilityScore:json.categories?.accessibility?.score,LCPms:m('largest-contentful-paint'),
    CLS:m('cumulative-layout-shift'),TBTms:m('total-blocking-time'),
    observedAt:json.fetchTime,lighthouseVersion:json.lighthouseVersion,
    status:json.runtimeError?.message||'measured'});
}
fs.writeFileSync(path.join(dir,'lighthouse-summary.json'),JSON.stringify(rows,null,2));
console.log('LIGHTHOUSE_SUMMARY '+JSON.stringify(rows));
