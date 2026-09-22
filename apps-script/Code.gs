// Configure this in Apps Script, not in the public repository.
const SPREADSHEET_ID = "1h7MfwjVXrnyFIn61fcZLE3Ev1bqXbfhz3KPzt-s6yzM";
const SHEET_NAME = "Smoking_cessation_feedback";
const SITE_ORIGIN = "https://pikirenia.github.io";
const COUNTRY_DATA_URL = "https://pikirenia.github.io/tobacco_cessacion_map/data/map-data.js";
const MEDICINES = ["nrt", "varenicline", "cytisine", "bupropion"];
const HEADERS = ["submission_timestamp", "country", "nrt_availability", "nrt_access",
  "varenicline_availability", "varenicline_access", "cytisine_availability", "cytisine_access",
  "bupropion_availability", "bupropion_access", "comments", "source", "submission_id"];

// Optional: run once in the editor to authorize and verify the private destination.
function setup() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { destination_(); } finally { lock.releaseLock(); }
}

function destination_() {
  if (SPREADSHEET_ID.indexOf("PASTE_") === 0) throw new Error("Configure SPREADSHEET_ID.");
  const book = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = book.getSheetByName(SHEET_NAME) || book.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  } else {
    const header = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    if (JSON.stringify(header) !== JSON.stringify(HEADERS)) throw new Error("Unexpected sheet headers.");
  }
  return sheet;
}

function countryNames_() {
  const cache = CacheService.getScriptCache();
  const saved = cache.get("country-names-v1");
  if (saved) return JSON.parse(saved);
  const response = UrlFetchApp.fetch(COUNTRY_DATA_URL, {muteHttpExceptions: true});
  if (response.getResponseCode() !== 200) throw new Error("Country list unavailable.");
  // Parse only JSON; never execute the downloaded JavaScript.
  const match = response.getContentText().trim().match(/^const DATA = (\{[\s\S]*\});$/);
  if (!match) throw new Error("Invalid country dataset.");
  const names = Object.values(JSON.parse(match[1])).map(d => d.n);
  if (!names.length || names.some(n => typeof n !== "string")) throw new Error("Invalid country names.");
  cache.put("country-names-v1", JSON.stringify(names), 3600);
  return names;
}

function validate_(e) {
  if (!e || !e.postData || e.postData.length > 40000 ||
      !/^application\/x-www-form-urlencoded(?:;|$)/i.test(e.postData.type)) throw new Error("Invalid POST.");
  const p = e.parameter || {};
  const allowed = HEADERS.filter(k => k !== "submission_timestamp").concat(["started_at", "website", "response_token"]);
  if (Object.keys(p).some(k => !allowed.includes(k))) throw new Error("Unexpected field.");
  for (const key of Object.keys(p)) {
    if (typeof p[key] !== "string" || !e.parameters || !e.parameters[key] || e.parameters[key].length !== 1) throw new Error("Repeated or invalid field.");
  }
  if (!/^[a-f0-9]{32}$/.test(p.submission_id || "") || !/^[a-f0-9]{32}$/.test(p.response_token || "")) throw new Error("Invalid request ID.");
  if (!/^[0-9]{13}$/.test(p.started_at || "")) throw new Error("Invalid start time.");
  const elapsed = Date.now() - Number(p.started_at);
  if (elapsed < 3000 || elapsed > 86400000) throw new Error("Invalid submission timing.");
  if ((p.website || "").trim()) throw new Error("Spam detected.");
  for (const key of MEDICINES) {
    const a = p[key + "_availability"], access = p[key + "_access"];
    if (!["available", "unavailable", "unknown"].includes(a)) throw new Error("Invalid availability.");
    if (a === "unavailable" ? access !== "not_applicable" : !["otc", "prescription", "mixed", "unknown"].includes(access)) throw new Error("Invalid access.");
  }
  if (!p.country || p.country.length > 150 || !countryNames_().includes(p.country)) throw new Error("Invalid country.");
  if ((p.comments || "").length > 4000 || (p.source || "").length > 1000) throw new Error("Text too long.");
  return p;
}

function safeText_(value) {
  // Prevent spreadsheet formulas and dangerous CSV formula prefixes.
  const text = String(value || "");
  return /^[\s]*[=+@-]/.test(text) ? "'" + text : text;
}

function doPost(e) {
  const rawToken = e && e.parameter && e.parameter.response_token;
  const token = /^[a-f0-9]{32}$/.test(rawToken || "") ? rawToken : "";
  let ok = false;
  try {
    const p = validate_(e);
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = destination_();
      // Durable deduplication, including retries after an acknowledgement was lost.
      const lastRow = sheet.getLastRow();
      const found = lastRow > 1 && sheet.getRange(2, HEADERS.length, lastRow - 1, 1)
        .createTextFinder(p.submission_id).matchEntireCell(true).findNext();
      if (!found) {
        const row = HEADERS.map(key => key === "submission_timestamp"
          ? new Date().toISOString() : safeText_(p[key]));
        sheet.appendRow(row);
        SpreadsheetApp.flush();
      }
      ok = true;
    } finally { lock.releaseLock(); }
  } catch (error) {
    // Never return spreadsheet IDs, response text, or internal errors to respondents.
    console.warn("Feedback request was rejected or could not be saved.");
  }
  const payload = JSON.stringify({type: "country-feedback-result", token, ok}).replace(/</g, "\\u003c");
  // window.top is the site even when Google inserts its own nested sandbox iframe.
  // Exact target origin prevents sending the result to unrelated embedding sites.
  return HtmlService.createHtmlOutput("<!doctype html><html><body><script>window.top.postMessage(" +
    payload + "," + JSON.stringify(SITE_ORIGIN) + ");</script></body></html>")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doGet() {
  return HtmlService.createHtmlOutput("This endpoint accepts country feedback via POST.");
}
