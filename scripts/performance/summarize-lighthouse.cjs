/* Summary of repeated Lighthouse *laboratory* results, never field CWV. */
const fs=require('node:fs');
const path=require('node:path');
const dir=path.resolve(__dirname,'../../performance-artifacts');
const summarise=a=>{
 if(!a.length)return null;
 const s=[...a].sort((x,y)=>x-y);
 return {median:+s[Math.floor(s.length/2)].toFixed(2),
   range:[+s[0].toFixed(2),+s[s.length-1].toFixed(2)],runs:s.map(x=>+x.toFixed(2))};
};
const out={};
for(const device of ['mobile','desktop']){
 const reports=[];
 for(let i=1;i<=5;i++){
  const f=path.join(dir,'lighthouse-'+device+'-'+i+'.json');
  if(!fs.existsSync(f))continue;
  const r=JSON.parse(fs.readFileSync(f,'utf8'));
  reports.push({score:r.categories?.performance?.score*100,
    fcp:r.audits?.['first-contentful-paint']?.numericValue,
    lcp:r.audits?.['largest-contentful-paint']?.numericValue,
    cls:r.audits?.['cumulative-layout-shift']?.numericValue,
    tbt:r.audits?.['total-blocking-time']?.numericValue});
 }
 out[device]={runs:reports.length};
 for(const k of ['score','fcp','lcp','cls','tbt'])
  out[device][k]=summarise(reports.map(r=>r[k]).filter(Number.isFinite));
}
fs.writeFileSync(path.join(dir,'lighthouse-summary.json'),JSON.stringify(out,null,2));
console.log('PR5_LIGHTHOUSE',JSON.stringify(out));
if(Object.values(out).some(v=>v.runs<5))process.exitCode=1;
