# PR 7: Feedback form UX and shareable map URLs

Target: `optimization`. No production deployment. No scientific or feedback-backend changes.

## Feedback changes and UX comparison

| Interaction | Before PR7 | PR7 candidate |
| --- | --- | --- |
| Question sequence | Country, all medicine cards, optional notes | Numbered Country, Medicines and access, Optional details sections; unchanged questions and values |
| First impression | Four medicine cards always showed both question groups (3+4 radio options each) | Access questions start collapsed, reveal after selecting Available or Don't know |
| Unavailable medicine | Access inputs disabled; a hidden `not_applicable` value submitted | Same payload semantics; access group visibly collapsed and concise not-applicable note shown |
| Don't know availability | Access choices remain applicable and mandatory | Same rule with access choices now revealed, including an explicit Don't know option |
| Mobile | Four long cards with all options visible | Two-column answer grids, shorter cards, no horizontal overflow; minimum target dimensions retained |
| Submission | Token-checked POST to original Apps Script, retry and durable deduplication | Unchanged protocol; no new fields in the Google Sheet, no actual test submissions |

The Google Apps Script code, Google Sheets columns, destination, submission origin/token checks, honeypot, 3-second minimum, 45-second timeout, idempotent retries and 5-second success redirect are unmodified.

## URL specification (v1)

No external libraries, analytics, or trackers. Query parameters control **presentation only**. Defaults are omitted from generated links. Unknown or invalid values are ignored and replaced with safe defaults in the view. Existing scientific classifications and thresholds are untouched.

| Parameter | Allowed values | Default | Role |
| --- | --- | --- | --- |
| `layer` | `medicines`, `tb-incidence`, `tb-smoking` | `medicines` | Primary map layer |
| `view` | `all`, `full`, `0`, `1`, `2`, `3` | `all` | Medicines view: all four, full package, or NRT / varenicline / cytisine / bupropion |
| `display` | `rate`, `access` | `rate` | TB incidence rate shading vs medicines comparison |
| `threshold` | `100`, `200`, `400` | `100` | TB comparison: incidence strictly greater than N / 100,000 |
| `medicine` | `any`, `full`, `0`, `1`, `2`, `3` | `any` | TB highlighting: all countries, full package, or selected medicine |
| `status` | `A`, `U`, `X` | `A` | TB highlighting: Available, Unavailable, Uncertain |
| `country` | ISO 3166-1 alpha-3 code in the study, e.g. `POL` | none | Selected, pinned country and zoom |

The two separately configured TB layers and rate/comparison modes retain their existing legend, classifications and data. Options not visible for a selected mode are retained so users can switch modes without losing them; they do not change the science of another layer.

Browser history: user interactions push view-state entries only when the URL changes. `popstate` restores the complete state without adding history entries. The initial URL is applied before the first final paint, and country selection is restored synchronously with no animation. No-query reloads preserve native select restoration, with `pageshow` repainting restored browser values.

Clipboard: the control copies the current view's URL with the native Clipboard API. If denied or unavailable, it attempts a native selection-copy and presents a selectable, read-only URL for manual copying. It does not invoke third-party SDKs or collect feedback answers.

## Example links

These are intended production URLs **after** PR review, integration into `main`, and deployment. They must not be described as already active on the current production site.

1. [Full package availability](https://pikirenia.github.io/tobacco_cessacion_map/?view=full)
2. [TB incidence, WHO rates](https://pikirenia.github.io/tobacco_cessacion_map/?layer=tb-incidence)
3. [TB incidence >200 and medicine access](https://pikirenia.github.io/tobacco_cessacion_map/?layer=tb-incidence&display=access&threshold=200)
4. [TB incidence >400 and Poland pinned](https://pikirenia.github.io/tobacco_cessacion_map/?layer=tb-incidence&display=access&threshold=400&country=POL)
5. [Smoking-attributable TB, full package unavailable](https://pikirenia.github.io/tobacco_cessacion_map/?layer=tb-smoking&medicine=full&status=U)
6. [Varenicline retail availability](https://pikirenia.github.io/tobacco_cessacion_map/?view=1)

The same query strings are tested locally by Playwright against the PR branch. Public URLs must be manually checked after any future production release.

## Validation and screenshot artifacts

- `npm test`: feedback payload/backend mock tests, shared country integrity and URL serialization unit tests.
- `npm run check:data` and `python3 tests/data.test.py`: original scientific invariants.
- `python3 scripts/version_assets.py`: ensure Git-blob content hashes match HTML links.
- `npm run test:browser`: existing browser suites plus PR7 browser tests in desktop Chrome, mobile Chromium and mobile WebKit.
- `npx playwright test -c playwright.baseline.config.cjs`: existing accessibility, visual and functional baseline, where applicable.
- PR7 browser tests capture responsive before/after *candidate* views of feedback initially collapsed and expanded, and the TB access map share state. The CI workflow uploads `test-results/` with PNG screenshots; no live submissions.
- Existing historical screenshots are preserved. New screenshots are distinct artifacts rather than overwriting previously approved PR1–PR4 references.

### Scope and limitations

No files under `data/` or `apps-script/` change. No backend schema, map classification, WHO indicator, additional health metric, personal identifier or tracking service is introduced. Country codes are explicitly validated against the dataset. Zoom/center encoding is deliberately excluded: selected-country deep links reproduce country-focused zoom without inflating URLs. Browser tests do not replace manual iOS Safari testing, nor do synthetic visual snapshots establish accessibility conformance.

## Review checklist

- Confirm link opens the right layer, legend, status and country **on first load**.
- Confirm all three thresholds (`>100`, `>200`, `>400`) and 3 primary layers.
- Inspect screenshots for 320px overflow and card clarity, including dark mode.
- Try back/forward, reload, invalid URLs and clipboard denial.
- Verify no real feedback data were submitted. Only mocked POSTs are permitted.
