// Pure, offline URL-state unit tests. No Google endpoints or personal data.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx={window:{},URLSearchParams};
vm.runInNewContext(fs.readFileSync('assets/share-state.js','utf8'),ctx);
const {read,serialize}=ctx.window.MapShareState;
const countries=new Set(['POL','BLR','DEU']);
const defaults={layer:'medicines',view:'all',display:'rate',threshold:'100',medicine:'any',status:'A',cancerDisplay:'rate',cancerSex:'both',cancerThreshold:'50',country:''};
assert.equal(JSON.stringify(read('',countries)),JSON.stringify(defaults));
assert.equal(serialize(defaults),'');
for(const layer of ['medicines','tb-incidence','tb-smoking','lung-cancer']){
  for(const threshold of ['100','200','400']){
    for(const medicine of ['any','full','0','1','2','3']){
      for(const status of ['A','U','X']){
        const state={...defaults,layer,view:'full',display:'access',threshold,medicine,status,country:'POL'};
        assert.equal(JSON.stringify(read('?'+serialize(state),countries)),JSON.stringify(state));
      }
    }
  }
}
for(const view of ['all','full','0','1','2','3']){
  const state={...defaults,view,country:'DEU'};
  assert.equal(read('?'+serialize(state),countries).view,view);
}
for (const cancerDisplay of ['rate','access']) for(const cancerSex of ['both','male','female'])
  for(const cancerThreshold of ['50','100','150']) {
    const state={...defaults,layer:'lung-cancer',cancerDisplay,cancerSex,cancerThreshold,country:'BLR'};
    assert.equal(JSON.stringify(read('?'+serialize(state),countries)),JSON.stringify(state));
  }
assert.equal(read('?layer=lung-cancer&cancerSex=invalid&cancerThreshold=999',countries).cancerThreshold,'50');
const invalid=read('?layer=other&view=14&display=invalid&threshold=999&medicine=5&status=M&country=AAA',countries);
assert.equal(JSON.stringify(invalid),JSON.stringify(defaults));
assert.equal(read('?country=pol&threshold=-10&layer=tb-smoking',countries).country,'');
assert.equal(read('?country=BLR&country=POL',countries).country,'BLR');
assert.equal(read('?status=U&status=A',countries).status,'U');
const canonical=serialize({...defaults,layer:'tb-incidence',threshold:'400',country:'POL'});
assert.equal(canonical,'layer=tb-incidence&threshold=400&country=POL');
assert.equal(new URLSearchParams(canonical).get('country'),'POL');
console.log('PASS: URL defaults, 162 layer/threshold/medicine/status combinations, all views, round trips and invalid parameters.');
