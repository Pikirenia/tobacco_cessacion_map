// Static, offline scientific integrity and browser-facing data contract tests.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function source(path,name){
  const content=fs.readFileSync(path,'utf8');
  return JSON.parse(JSON.stringify(vm.runInNewContext(content+'\n'+name+';',{})));
}
const D=source('data/lung-cancer-data.js','LUNG_DATA');
const M=source('data/map-data.js','DATA');
assert.equal(D.year,2023);
assert.equal(D.age,'50-79');
assert.equal(D.unit,'new cases per 100,000 per year');
const iso=Object.values(M).map(country=>country.i);
assert.equal(iso.length,195);
assert.equal(new Set(iso).size,195);
assert.deepEqual(Object.keys(D.countries).sort(),iso.sort());
for(const record of Object.values(D.countries))
  for(const sex of ['both','male','female'])
    assert(Number.isFinite(record[sex])&&record[sex]>=0,sex+' must be nonnegative and finite');
const reference={HUN:182.8,FRA:172.6,POL:143.8,CHN:132.4,BLR:111.3,JPN:103.1,RUS:93.1,IND:31.1};
for(const [id,val] of Object.entries(reference))
  assert(Math.abs(D.countries[id].both-val)<.051,id+' reference differs');
const bands=values=>[values.filter(v=>v<50).length,
  values.filter(v=>v>=50&&v<100).length,
  values.filter(v=>v>=100&&v<150).length,
  values.filter(v=>v>=150).length];
assert.deepEqual(bands(Object.values(D.countries).map(c=>c.both)),[90,54,38,13]);
assert.deepEqual(bands(Object.values(D.countries).map(c=>c.male)),[62,46,39,48]);
assert.deepEqual(bands(Object.values(D.countries).map(c=>c.female)),[141,36,15,3]);
// Exercise the actual front-end boundary classifier, not a duplicated comparison.
const mapCode=fs.readFileSync('assets/map.js','utf8');
const classifierStart=mapCode.indexOf('function lungAccessClass(d){');
const classifierEnd=mapCode.indexOf('\n}',classifierStart);
const classifier=classifierStart<0||classifierEnd<0?null:mapCode.slice(classifierStart,classifierEnd+2);
assert(classifier,'lungAccessClass is missing from map code');
const context={
  lungCutoff:50,lungValue:d=>d.rate,
  fullSet:d=>d.r[0]==='A'&&d.r[3]==='A'&&(d.r[1]==='A'||d.r[2]==='A'),
  avail:d=>(d.r.match(/A/g)||[]).length
};
vm.runInNewContext(classifier,context);
for(const threshold of [50,100,150]){
  context.lungCutoff=threshold;
  assert.equal(context.lungAccessClass({rate:threshold-.001,r:'AUUU'}),'acc-below');
  assert.equal(context.lungAccessClass({rate:threshold,r:'AUUU'}),'acc-one');
  assert.equal(context.lungAccessClass({rate:threshold,r:'AAAA'}),'acc-full');
  assert.equal(context.lungAccessClass({rate:threshold,r:'UUUU'}),'acc-none');
  assert.equal(context.lungAccessClass({rate:null,r:'UUUU'}),'nd');
}
const page=fs.readFileSync('index.html','utf8');
assert(page.includes('data/lung-cancer-data.js?v='));
assert(page.includes('id="lungSex"')&&page.includes('data-mode="lung-cancer"'));
assert(page.includes('data-sort="lung"'));
assert(!fs.existsSync('data/IHME-GBD_2023_DATA-f5d4ca22-1.csv'),'raw licensed GBD export must not be published');
console.log('PASS: 195 study locations, all sex-specific rates, expected bands, known countries and inclusive boundaries.');
