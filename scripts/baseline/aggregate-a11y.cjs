const fs=require('node:fs'),path=require('node:path');
const root='baseline-artifacts/test-results',out='baseline-artifacts';
const files=[];
function walk(dir) {
 if(!fs.existsSync(dir))return;
 for(const d of fs.readdirSync(dir,{withFileTypes:true})) {
  const p=path.join(dir,d.name);
  if(d.isDirectory())walk(p);
  else if(d.name==='axe-report.json')files.push(p);
 }
}
walk(root);
const groups=new Map(),counts={critical:0,serious:0,moderate:0,minor:0};
for(const file of files) {
 const report=JSON.parse(fs.readFileSync(file,'utf8'));
 for(const item of report.violations) {
  counts[item.impact]=(counts[item.impact]||0)+1;
  const key=item.impact+':'+item.id;
  if(!groups.has(key))groups.set(key,{id:item.id,impact:item.impact,help:item.help,
    pages:[],sampleTargets:[],occurrences:0});
  const g=groups.get(key);
  g.occurrences++;
  g.pages.push(report.viewport+'px '+report.scheme+' '+report.scenario);
  for(const node of item.nodes.slice(0,2)) {
   const target=node.target.join(' ');
   if(!g.sampleTargets.includes(target)&&g.sampleTargets.length<5)g.sampleTargets.push(target);
  }
 }
}
const severity={critical:0,serious:1,moderate:2,minor:3};
const items=[...groups.values()].sort((a,b)=>(severity[a.impact]??4)-(severity[b.impact]??4) || a.id.localeCompare(b.id));
const summary={scans:files.length,violationOccurrences:counts,uniqueRules:items.length,findings:items};
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'axe-summary.json'),JSON.stringify(summary,null,2));
const md=['# Axe-core WCAG audit inventory','', 'Tests: '+files.length,'',
 ...Object.keys(counts).map(s=>'- '+s+': '+counts[s]+' state-level rule occurrences'),'',...items.map(i=>
 '## '+i.impact.toUpperCase()+' • '+i.id+'\n'+i.help+
 '\n\nOccurrences: '+i.occurrences+'; examples: '+i.sampleTargets.join(', ')+
 '\n\nObserved in: '+[...new Set(i.pages)].join('; ')+'\n')];
fs.writeFileSync(path.join(out,'axe-summary.md'),md.join('\n'));
console.log('AXE_BASELINE '+JSON.stringify(summary));
