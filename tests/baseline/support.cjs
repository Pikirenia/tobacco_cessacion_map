const fs = require('node:fs');
const path = require('node:path');
const {expect} = require('@playwright/test');
const ROOT = path.resolve(__dirname, '../..');
const D3 = fs.readFileSync(path.join(ROOT,'node_modules/d3/dist/d3.min.js'),'utf8');
const TOPOJSON = fs.readFileSync(path.join(ROOT,'node_modules/topojson-client/dist/topojson-client.min.js'),'utf8');
const TB = fs.readFileSync(path.join(__dirname, 'fixtures/tb-data.js'), 'utf8');
const MEDICINES = fs.readFileSync(path.join(__dirname, 'fixtures/map-data.js'), 'utf8');
async function deterministic(page) {
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/d3/**', route =>
    route.fulfill({status: 200, contentType: 'application/javascript', body: D3}));
  await page.route('https://cdn.jsdelivr.net/npm/topojson-client@**', route =>
    route.fulfill({status: 200, contentType: 'application/javascript', body: TOPOJSON}));
  await page.route('**/data/tb-data.js*', route =>
    route.fulfill({status: 200, contentType: 'application/javascript', body: TB}));
  await page.route('**/data/map-data.js*', route =>
    route.fulfill({status: 200, contentType: 'application/javascript', body: MEDICINES}));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;font-family:Arial,sans-serif!important}';
      document.head.appendChild(s);
    }, {once:true});
  });
}
async function ready(page) {
  await page.goto('./', {waitUntil: 'load'});
  await expect(page.locator('#legend button').first()).toBeVisible();
  await expect(page.locator('#map path.country').first()).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}
async function state(page, name) {
  if(name === 'medicines') return;
  if(name === 'tb-incidence') {
    await page.locator('.map-mode [data-mode="tb-incidence"]').click();
  } else if(name === 'tb-smoking') {
    await page.locator('.map-mode [data-mode="tb-smoking"]').click();
  } else {
    await page.locator('.map-mode [data-mode="tb-incidence"]').click();
    await page.locator('#tbColorBy').selectOption('access');
    await page.locator('#tbCutoff').selectOption(name.slice(-3));
    await expect(page.locator('#tbMeta')).toContainText('>' + name.slice(-3));
  }
  await expect(page.locator('#legend button').first()).toBeVisible();
  await page.evaluate(() => new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}
module.exports = {deterministic, ready, state, ROOT};
