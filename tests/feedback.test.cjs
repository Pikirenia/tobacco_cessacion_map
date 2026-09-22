// No test dependencies. Apps Script services and browser DOM are simulated.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
process.chdir(path.join(__dirname, ".."));
const dataSource = fs.readFileSync("data/map-data.js", "utf8");
const data = JSON.parse(dataSource.trim().match(/^const DATA = (.*);$/s)[1]);
const names = Object.values(data).map(d => d.n);
assert.equal(names.length, 195);
assert.equal(new Set(names).size, 195);
for (const file of ["feedback/feedback.js", "feedback/config.js", "apps-script/Code.gs", "data/map-data.js"]) {
  new vm.Script(fs.readFileSync(file, "utf8"), {filename: file});
}
const index = fs.readFileSync("index.html", "utf8");
assert(index.includes('href="feedback/"'));
assert(index.includes('src="data/map-data.js"'));
assert(!index.includes("const DATA ="));
assert(index.includes('["full","Full set"]'));
const html = fs.readFileSync("feedback/index.html", "utf8");
assert(html.includes('href="../"'));
assert(html.includes('target="submission-frame"'));
assert(html.includes('aria-describedby="comments-help"'));
for (const source of [index, html]) {
  for (const [, url] of source.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|#)/.test(url)) continue;
    const base = source === index ? "." : "feedback";
    assert(fs.existsSync(path.resolve(base, url)), "Missing relative path: " + url);
  }
}
const rows = [];
let failWrite = false, releases = 0;
const sheet = {
  getLastRow: () => rows.length, setFrozenRows() {},
  appendRow(row) { if (failWrite) throw Error("storage failed"); rows.push(row); },
  getRange(row, col, count) {
    return {
      getValues: () => [rows[0]],
      createTextFinder(id) { return {
        matchEntireCell() { return this; },
        findNext: () => rows.slice(row - 1, row - 1 + count).find(r => r[col - 1] === id) || null
      }; }
    };
  }
};
const backend = vm.createContext({
  console: {warn() {}},
  CacheService: {getScriptCache: () => ({get: () => null, put() {}})},
  UrlFetchApp: {fetch: () => ({getResponseCode: () => 200, getContentText: () => dataSource})},
  LockService: {getScriptLock: () => ({waitLock() {}, releaseLock() { releases++; }})},
  SpreadsheetApp: {openById: () => ({getSheetByName: () => sheet}), flush() {}},
  HtmlService: {XFrameOptionsMode: {ALLOWALL: "allow"}, createHtmlOutput: text => ({text, setXFrameOptionsMode() {return this;}})}
});
vm.runInContext(fs.readFileSync("apps-script/Code.gs", "utf8").replace("PASTE_EXISTING_GOOGLE_SHEET_ID_HERE", "test-sheet"), backend);
function valid() {
  const p = {country: "Poland", comments: "", source: "", website: "", started_at: String(Date.now() - 10000),
    submission_id: "a".repeat(32), response_token: "b".repeat(32)};
  for (const key of ["nrt", "varenicline", "cytisine", "bupropion"]) {
    p[key + "_availability"] = "available"; p[key + "_access"] = "otc";
  }
  return p;
}
function event(p) {
  return {parameter: p, parameters: Object.fromEntries(Object.entries(p).map(([k,v]) => [k,[v]])),
    postData: {type: "application/x-www-form-urlencoded", length: 1000}};
}
function reject(p) {assert.throws(() => backend.validate_(event(p)));}
assert.equal(backend.validate_(event(valid())).country, "Poland");
for (const key of ["nrt", "varenicline", "cytisine", "bupropion"]) {
  for (const a of ["available", "unavailable", "unknown"]) {
    for (const b of ["otc", "prescription", "mixed", "unknown", "not_applicable"]) {
      const p = valid(); p[key+"_availability"] = a; p[key+"_access"] = b;
      if ((a === "unavailable") === (b === "not_applicable")) backend.validate_(event(p));
      else reject(p);
    }
  }
}
for (const patch of [{country:""}, {country:"Atlantis"}, {website:"spam"}, {started_at:String(Date.now())},
  {started_at:String(Date.now()-90000000)}, {comments:"x".repeat(4001)}, {source:"x".repeat(1001)},
  {nrt_availability:""}, {nrt_access:""}, {extra:"unexpected"}, {submission_id:"invalid"}]) reject({...valid(),...patch});
const repeated = event(valid()); repeated.parameters.country.push("Germany");
assert.throws(() => backend.validate_(repeated));
const oversized = event(valid()); oversized.postData.length = 40001;
assert.throws(() => backend.validate_(oversized));
assert.equal(backend.safeText_("=IMPORTXML('x')"), "'=IMPORTXML('x')");
assert.equal(backend.safeText_("normal"), "normal");
function result(p) {
  return JSON.parse(backend.doPost(event(p)).text.match(/postMessage\((\{.*?\}),/)[1]);
}
assert.equal(result({...valid(),comments:"=1+1"}).ok, true);
assert.equal(rows.length, 2);
assert.equal(rows[1][10], "'=1+1");
assert(/T.*Z$/.test(rows[1][0]));
assert.equal(result(valid()).ok, true);
assert.equal(rows.length, 2, "Retry must not duplicate a stored row");
failWrite = true;
assert.equal(result({...valid(),submission_id:"c".repeat(32)}).ok, false);
assert.equal(rows.length, 2);
assert.equal(result({...valid(),country:"bad"}).ok, false);
assert(releases >= 3);

// Minimal DOM simulation for form state, native-post intent and acknowledgement handling.
function frontend(configured=true) {
  const ids = {}, handlers = {}, timers = new Map(); let timeId=0;
  class Element {
    constructor(tag) {this.tag=tag;this.children=[];this.handlers={};this.disabled=false;this.hidden=false;this.value="";this.checked=false;this.required=false;}
    append(...nodes) {for(const n of nodes){if(typeof n==="object")n.parent=this;this.children.push(n);}}
    add(n) {this.append(n);}
    addEventListener(k, f) {this.handlers[k]=f;}
    setAttribute(k,v) {this[k]=v;}
    removeAttribute(k) {delete this[k];}
    focus() {this.focused=true;}
    querySelectorAll() {return walk(this).filter(n=>n.tag==="input");}
    set id(value) {this._id=value;ids[value]=this;}
    get id() {return this._id;}
  }
  function walk(el) {return [el,...el.children.filter(n=>typeof n==="object").flatMap(walk)];}
  const form = new Element("form"); form.id="feedback-form";
  for(const id of ["status","submit-button","country","medicines","thank-you"]) {const el=new Element("div");el.id=id;}
  ids.country.name="country";
  form.append(ids.country,ids.medicines);
  for(const name of ["started_at","submission_id","response_token","website","comments","source"]) {
    const el=new Element("input");el.type="hidden";el.name=name;form.append(el);
  }
  const inputs = () => walk(form).filter(n=>n.name);
  const disabled = n => n.disabled || (n.parent && disabled(n.parent));
  form.elements=new Proxy({}, {get(_, key){
    const all=inputs().filter(n=>n.name===key);
    if(all.length===1)return all[0];
    return {get value(){return (all.find(n=>n.checked)||{}).value||"";}};
  }});
  form.reportValidity=() => ids.country.value && !inputs().some(n=>n.required&&!disabled(n)&&!inputs().some(x=>x.name===n.name&&x.checked));
  class FakeFormData extends Array {
    constructor(){super();for(const n of inputs())if(!disabled(n)&&(n.type!=="radio"||n.checked))this.push([n.name,n.value]);}
  }
  const context=vm.createContext({
    DATA:data, GOOGLE_APPS_SCRIPT_URL:configured?"https://script.google.com/macros/s/test/exec":"PLACEHOLDER",
    document:{getElementById:id=>ids[id],createElement:tag=>new Element(tag),createTextNode:t=>t},
    Option:class {constructor(t,v){this.text=t;this.value=v;this.children=[];}},
    FormData:FakeFormData, crypto:require("node:crypto").webcrypto,
    setTimeout:(f,ms)=>{timers.set(++timeId,{f,ms});return timeId;},clearTimeout:id=>timers.delete(id),
    window:{addEventListener:(key,f)=>handlers[key]=f,location:{href:""}}
  });
  vm.runInContext(fs.readFileSync("feedback/feedback.js","utf8"),context);
  function select(key, type, value) {
    const radio=inputs().find(n=>n.name===key+"_"+type&&n.value===value);
    inputs().filter(n=>n.name===radio.name).forEach(n=>n.checked=false);
    radio.checked=true;
    radio.parent.parent.parent.handlers.change();
  }
  function submit() {const e={prevented:false,preventDefault(){this.prevented=true;}};form.handlers.submit(e);return e;}
  return {ids,form,context,handlers,timers,select,submit};
}
let ui=frontend(false);
assert(ui.ids["submit-button"].disabled);
assert(ui.ids.status.textContent.includes("not open"));
ui=frontend();
assert.equal(ui.ids.country.children.length,195);
assert.equal(ui.ids.medicines.children.length,4);
assert(ui.submit().prevented);
ui.ids.country.value="Poland";
ui.form.elements.started_at.value=String(Date.now()-10000);
for(const key of ["nrt","varenicline","cytisine","bupropion"])ui.select(key,"availability","unavailable");
assert.equal(ui.form.reportValidity(),true);
ui.select("nrt","availability","available");
assert.equal(ui.form.reportValidity(),false);
ui.select("nrt","access","prescription");
assert.equal(ui.submit().prevented,false);
assert.equal(ui.submit().prevented,true);
const submissionId=ui.form.elements.submission_id.value;
const token=ui.form.elements.response_token.value;
const acknowledgement={type:"country-feedback-result",token,ok:true};
ui.handlers.message({origin:"https://evil.example",data:acknowledgement});
assert.equal(ui.form.hidden,false);
const timeout=[...ui.timers.values()].find(t=>t.ms===45000);timeout.f();
assert.equal(ui.ids["submit-button"].disabled,false);
assert.equal(ui.form.hidden,false);
assert.equal(ui.ids.country.value,"Poland");
ui.submit();
assert.equal(ui.form.elements.submission_id.value,submissionId);
ui.handlers.message({origin:"https://script.googleusercontent.com",data:acknowledgement});
assert.equal(ui.form.hidden,false,"Old attempt token must not confirm a retry");
ui.handlers.message({origin:"https://script.googleusercontent.com.evil.example",data:{...acknowledgement,token:ui.form.elements.response_token.value}});
assert.equal(ui.form.hidden,false,"Untrusted hostname must fail");
ui.handlers.message({origin:"https://test-script.googleusercontent.com",data:{...acknowledgement,token:ui.form.elements.response_token.value}});
assert.equal(ui.form.hidden,true);
assert.equal(ui.ids["thank-you"].hidden,false);
const redirect=[...ui.timers.values()].find(t=>t.ms===5000);assert(redirect);redirect.f();
assert.equal(ui.context.window.location.href,"../");
console.log("PASS: 195 shared countries, paths, syntax, 60 availability/access combinations, malformed inputs, formula escaping, backend failures/deduplication, frontend required/disabled states, timeout/retry, origin/token checks, success and 5-second redirect.");
