# Smoking cessation medicines — availability map

Interactive world map showing how many of four first-line smoking cessation medicines — nicotine replacement therapy (NRT), varenicline, cytisine and bupropion — patients can actually obtain through legal retail in each of 195 countries, alongside what each country reported to WHO.

**Live map:** https://pikirenia.github.io/tobacco_cessacion_map/

## What the map shows

- **Colour** — number of medicines with confirmed retail availability (0–4). White: status of all four medicines is uncertain (no data). Grey: territories outside the 195-country study.
- **Tooltip** (hover or tap) — retail status per medicine, WHO "legally sold" status (2024), dispensing category (OTC/Rx), reimbursement, and inclusion of NRT in the national essential medicines list.
- **View switch** — all four medicines, or one medicine at a time.

## Definitions

- **AVAILABLE** — at least one of two independent patient-facing retail sources shows a current way to buy, order or reserve the medicine (September 2026).
- **UNAVAILABLE** — both applicable sources gave a browser-confirmed negative result.
- **UNCERTAIN** — neither condition was met.
- Bupropion counts as available even where it is marketed only as an antidepressant.
- **Full set** — NRT + bupropion + (varenicline or cytisine).
- WHO data describe legal status in 2024, not current stock.

## Data

- `data/smoking_cessation_COUNTRY_FINAL_EN.xlsx` — country-level summary workbook
- `data/by_country.csv` — retail status and WHO "legally sold" status per country
- `data/who_detail.csv` — WHO dispensing, reimbursement and essential medicines list fields

## Technical notes

Static `index.html`, `assets/map.js` (D3 v7, topojson-client), shared `assets/site.css`
and map dataset in `data/map-data.js`. Unchanged Natural Earth/world-atlas 50m
geometry is in `data/world-topology.js`, cached independently of page edits.
Scripts use `defer` and execute in dependency order. No production build step or new runtime dependencies.

## Updating data and checking changes

The reviewed country workbook `data/smoking_cessation_COUNTRY_FINAL_EN.xlsx`
is the source for the repository CSVs and map availability/WHO fields. After
reviewing feedback, update its `By country` and `WHO detail` source tabs and
any affected summary tabs. Keep the separate research/source workbooks in sync
as part of that review; this tool only checks the workbook in this repository.

Run `python3 scripts/check-data.py` to compare every country and field with the
CSVs and map. It also validates the availability flags and consistency of WHO
sold values between the two workbook tabs. Mismatches fail with a diagnostic.
Run `python3 scripts/check-data.py --write` to regenerate CSVs and map fields
from the reviewed workbook. It preserves map IDs and island coordinates and
never edits Excel. Adding/removing countries requires explicit geography review.
Commit the source workbook and regenerated files together after reviewing the diff.

Run `npm ci`, `npm test`, and `npm run check:data` for local checks.
For real browser checks, run `npx playwright install --with-deps chromium webkit`
then `npm run test:browser`. Playwright is a development-only dependency.
Tests serve the site under `/tobacco_cessacion_map/`, exercise desktop/mobile
Chromium and mobile WebKit, and intercept Google POSTs so no test responses are
written to the real Sheet. The `Site checks` GitHub Actions workflow runs on
pushes and pull requests. Pages publishing remains separately configured;
a failing check does not automatically roll back or block an existing Pages deployment.

## Country feedback

The map introduction links to `feedback/`. It uses the same country dataset and stylesheet. Submissions remain disabled until `GOOGLE_APPS_SCRIPT_URL` in `feedback/config.js` is configured.

See [Apps Script setup and deployment](apps-script/README.md) for the private Google Sheet backend, anonymous deployment, confirmation protocol and acceptance checks. Run local checks with `node tests/feedback.test.cjs`.

## Citation

<!-- Add citation / DOI once available -->

## Licence

<!-- Choose a licence for code and data -->

