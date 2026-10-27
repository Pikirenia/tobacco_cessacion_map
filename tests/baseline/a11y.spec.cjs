const fs = require('node:fs');
const path = require('node:path');
const {test, expect} = require('@playwright/test');
const {deterministic,ready,state} = require('./support.cjs');
const axe = require.resolve('axe-core/axe.min.js');

const states = ['medicines','tb-incidence','tb-smoking','compare-100','compare-200','compare-400','tooltip','feedback'];
for(const width of [375,1280]) for(const scheme of ['light','dark']) for(const scenario of states) {
  test(width+'px '+scheme+' '+scenario+' accessibility inventory', async ({page}, testInfo) => {
    await page.setViewportSize({width,height:900});
    await page.emulateMedia({colorScheme:scheme,reducedMotion:'reduce'});
    await deterministic(page);
    if(scenario === 'feedback') {
      await page.goto('feedback/');
      await expect(page.locator('#feedback-form')).toBeVisible();
    } else {
      await ready(page);
      if(scenario === 'tooltip') {
        await page.locator('#q').fill('Poland');
        await page.locator('#q').dispatchEvent('change');
        await expect(page.locator('#tip.on h2')).toHaveText('Poland');
      } else await state(page,scenario);
    }
    await page.addScriptTag({path:axe});
    const results = await page.evaluate(() => axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']}}));
    const violations = results.violations.map(v => ({
      id:v.id, impact:v.impact, description:v.description, help:v.help,
      nodes:v.nodes.map(n=>({target:n.target, summary:n.failureSummary}))
    }));
    const report = {viewport:width, scheme, scenario, auditedAt:new Date().toISOString(),
      passes:results.passes.length, incomplete:results.incomplete.length, violations,
      severityCounts:Object.fromEntries(['critical','serious','moderate','minor'].map(level =>
        [level,violations.filter(v=>v.impact===level).length]))};
    const file = testInfo.outputPath('axe-report.json');
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,JSON.stringify(report,null,2));
    await testInfo.attach('axe-report',{path:file,contentType:'application/json'});
    console.log('AXE',JSON.stringify({width,scheme,scenario,...report.severityCounts}));
    // Inventory phase: existing accessibility failures are recorded, not silently hidden
    // and not yet converted into a zero-violation regression gate.
    expect(results.inapplicable).toBeDefined();
  });
}
