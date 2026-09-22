"use strict";
(() => {
  const form = document.getElementById("feedback-form");
  const status = document.getElementById("status");
  const button = document.getElementById("submit-button");
  const medicines = [["nrt", "Nicotine replacement therapy (NRT)"], ["varenicline", "Varenicline"], ["cytisine", "Cytisine / cytisinicline"], ["bupropion", "Bupropion"]];
  const availability = [["available", "Available"], ["unavailable", "Not available"], ["unknown", "Don't know"]];
  const access = [["otc", "Without prescription"], ["prescription", "Prescription required"], ["mixed", "Depends on product/formulation"], ["unknown", "Don't know"]];
  const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
  let pending = false, timer, attemptToken = "", lastPayload = "";
  function message(text) {
    status.textContent = text;
    status.hidden = !text;
  }
  if (typeof DATA === "undefined") {
    message("The country list could not load. Please reload this page.");
    return;
  }
  Object.values(DATA).sort((a, b) => a.n.localeCompare(b.n, "en")).forEach(d => {
    document.getElementById("country").add(new Option(d.n, d.n));
  });
  const grid = document.getElementById("medicines");
  for (const [key, name] of medicines) {
    const card = document.createElement("fieldset");
    card.className = "medicine";
    const legend = document.createElement("legend");
    legend.textContent = name;
    card.append(legend);
    for (const [question, options] of [["availability", availability], ["access", access]]) {
      const group = document.createElement("fieldset");
      group.className = "question";
      group.id = key + "-" + question;
      const title = document.createElement("legend");
      title.textContent = (question === "access" ? "Access" : "Availability") + " *";
      group.append(title);
      for (const [value, label] of options) {
        const wrapper = document.createElement("label");
        wrapper.className = "choice";
        const input = document.createElement("input");
        Object.assign(input, {type: "radio", name: key + "_" + question, value, required: true});
        wrapper.append(input, document.createTextNode(label));
        group.append(wrapper);
      }
      card.append(group);
    }
    const na = document.createElement("input");
    Object.assign(na, {type: "hidden", name: key + "_access", value: "not_applicable", disabled: true});
    const note = document.createElement("p");
    note.className = "not-applicable"; note.hidden = true;
    note.textContent = "Access: not applicable because this medicine is not available.";
    card.append(na, note);
    card.addEventListener("change", () => {
      const unavailable = form.elements[key + "_availability"].value === "unavailable";
      const group = document.getElementById(key + "-access");
      group.disabled = unavailable;
      group.querySelectorAll("input").forEach(input => {
        input.required = !unavailable;
        if (unavailable) input.checked = false;
      });
      na.disabled = !unavailable;
      note.hidden = !unavailable;
    });
    grid.append(card);
  }
  form.elements.started_at.value = String(Date.now());
  form.hidden = false;
  const configured = typeof GOOGLE_APPS_SCRIPT_URL === "string" && /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(GOOGLE_APPS_SCRIPT_URL);
  if (!configured) {
    button.disabled = true;
    message("Feedback submissions are not open yet. Please return once setup is complete.");
    return;
  }
  form.action = GOOGLE_APPS_SCRIPT_URL;
  message("");
  function failed(text) {
    clearTimeout(timer);
    pending = false;
    button.disabled = false;
    button.textContent = "Retry submission";
    form.removeAttribute("aria-busy");
    message(text);
  }
  form.addEventListener("submit", event => {
    if (pending) { event.preventDefault(); return; }
    if (!form.reportValidity()) { event.preventDefault(); return; }
    if (Date.now() - Number(form.elements.started_at.value) < 3000) {
      event.preventDefault(); message("Please take a moment to check your answers, then submit."); return;
    }
    const payload = Array.from(new FormData(form)).filter(([key]) => !["submission_id", "response_token", "started_at"].includes(key));
    const signature = JSON.stringify(payload);
    // Retrying unchanged answers retains the ID, allowing durable server-side deduplication.
    if (signature !== lastPayload) form.elements.submission_id.value = randomId();
    lastPayload = signature;
    attemptToken = randomId();
    form.elements.response_token.value = attemptToken;
    pending = true;
    button.disabled = true;
    button.textContent = "Submitting...";
    form.setAttribute("aria-busy", "true");
    message("Submitting your feedback...");
    timer = setTimeout(() => failed("We could not confirm submission. Your answers are still here. Please retry."), 45000);
    // Allow native form POST into the iframe. An iframe load is NOT proof of success.
  });
  window.addEventListener("message", event => {
    const trusted = /^https:\/\/(?:[a-z0-9-]+-)?script\.googleusercontent\.com$/.test(event.origin) || event.origin === "https://script.google.com";
    const result = event.data;
    // Apps Script uses a nested sandbox iframe, so event.source is not the outer iframe.
    if (!trusted || !result || result.type !== "country-feedback-result" || result.token !== attemptToken || !attemptToken) return;
    if (result.ok !== true) {
      if (pending) failed("Submission was not accepted. Check your answers and retry. If this continues, please return later.");
      return;
    }
    clearTimeout(timer);
    attemptToken = ""; pending = false;
    form.hidden = true;
    message("");
    const thanks = document.getElementById("thank-you");
    thanks.hidden = false;
    thanks.focus();
    setTimeout(() => { window.location.href = "../"; }, 5000);
  });
})();
