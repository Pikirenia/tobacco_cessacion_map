# Smoking cessation medicines and tuberculosis

Interactive world map of legal retail availability of four smoking cessation medicines (NRT, varenicline, cytisine and bupropion) in 195 countries, plus two WHO-modelled TB indicators: annual incidence per 100,000 population and estimated annual TB cases attributable to smoking.

**Live map:** https://pikirenia.github.io/tobacco_cessacion_map/

## What the map shows

- **Colour** — number of medicines with confirmed retail availability (0–4). White: status of all four medicines is uncertain (no data). Grey: territories outside the 195-country study.
- **Tooltip** (hover or tap) — retail status per medicine, WHO "legally sold" status (2024), dispensing category (OTC/Rx), reimbursement, and inclusion of NRT in the national essential medicines list.
- **Layer switch** — medicines, WHO TB incidence per 100,000, or WHO smoking-attributable TB cases. The original per-medicine availability views remain unchanged.
- **Combined exploration** — in either TB layer, filter/highlight countries by retail availability of an individual medicine or the Full package; country tooltips display both TB measures and medicine availability.
- **High-incidence medicine access comparison** — in the TB incidence layer switch "TB incidence display" to "Medicine access comparison", then select a strict threshold (>100, >200, or >400 per 100,000). Above-threshold countries are coloured dark green for Full package confirmed available, light green for at least one medicine confirmed available but no full package, red for Full package confirmed unavailable with none of the four medicines confirmed available, or grey for no confirmed medicine with unresolved package status. Countries at/below the threshold are muted and missing TB estimates remain distinct. Categories are disjoint: red does not absorb the partial-access group.

## Definitions

- **AVAILABLE** — at least one of two independent patient-facing retail sources shows a current way to buy, order or reserve the medicine (September 2026).
- **UNAVAILABLE** — both applicable sources gave a browser-confirmed negative result.
- **UNCERTAIN** — neither condition was met.
- Bupropion counts as available even where it is marketed only as an antidepressant.
- **Full package** — NRT + bupropion + (varenicline or cytisine). A package is confirmed unavailable only if NRT or bupropion is unavailable, or both varenicline and cytisine are unavailable. Otherwise its status is uncertain unless all required components are confirmed available.
- WHO data describe legal status in 2024, not current stock.

## Data

- `data/smoking_cessation_COUNTRY_FINAL_EN.xlsx` — country-level summary workbook
- `data/by_country.csv` — retail status and WHO "legally sold" status per country
- `data/who_detail.csv` — WHO dispensing, reimbursement and essential medicines list fields

## WHO tuberculosis estimates (automatically synchronized)

The map includes precisely two additional WHO indicators:

1. **TB incidence per 100,000 population:** WHO estimate of new and recurrent TB cases each year, including HIV-associated and drug-resistant TB.
2. **Smoking-attributable TB cases:** WHO estimate of new TB episodes attributable to smoking, among adults aged 15 years and older, based on population attributable fractions. This is not a count of people with TB who smoke.

The authoritative downloads are the WHO Global TB Programme's machine-generated CSV files:
- https://extranet.who.int/tme/generateCSV.asp?ds=estimates
- https://extranet.who.int/tme/generateCSV.asp?ds=estimates_age_sex

`scripts/update_who_tb.py` uses Python's standard library to fetch and validate both files and selects the **latest common reference year** with adequate country coverage. It uses WHO's smoking risk-factor best estimate (sex=all, adult age group, incidence, unit=number), never calculates an attributable number from smokers among TB cases. Missing values are not replaced by zero or values from earlier years. Countries are matched using ISO3 codes to the existing 195-country map.

The `Sync WHO tuberculosis estimates` GitHub Actions workflow runs on the first merge to `main`, weekly on Mondays, or manually via **Actions → Sync WHO tuberculosis estimates → Run workflow**. It refreshes `data/tb-data.js` only when an actual indicator changes. Failed downloads or changed schemas fail validation *without overwriting* the previous data file. Country medicine records and feedback forms are unaffected.

Initially, the TB layers show No data until the first successful automated sync. The latest source year and last successful update date are displayed beneath the map. WHO routinely revises past-year estimates, so do not compare series from different report vintages without caution.

Source: [WHO Global Tuberculosis Programme](https://www.who.int/teams/global-programme-on-tuberculosis-and-lung-health/data). WHO-derived material retains WHO's attribution and applicable [dataset terms](https://data.who.int/about/data/terms-and-conditions). No WHO endorsement is implied. This project's MIT code license and CC BY 4.0 license for original project content do not replace any applicable third-party rights.

## Technical notes

Static `index.html`, `assets/map.js` (D3 v7, topojson-client), shared `assets/site.css`
and map dataset in `data/map-data.js`; WHO TB estimates are independently generated in `data/tb-data.js`. Unchanged Natural Earth/world-atlas 50m
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

Run `npm ci`, `npm test`, and `npm run check:data` for local checks. WHO parser regression tests can also be run directly with `python3 -m unittest discover -s tests -p 'test_who_tb.py'`.
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

Uladzimir Pikirenia. *Smoking cessation medicines*.
https://pikirenia.github.io/tobacco_cessacion_map/

For data reuse, include the [CC BY 4.0 licence](https://creativecommons.org/licenses/by/4.0/)
and indicate any changes. Record the access date or commit when citing a specific
version. See [attribution guidance](DATA_LICENSE.md#attribution).

## Licence

- **Original software code:** [MIT License](LICENSE), copyright 2026 Uladzimir Pikirenia.
- **Original data and narrative text:** [CC BY 4.0](DATA_LICENSE.md), allowing reuse
  and adaptation, including commercially, with attribution.
- **Third-party material:** retains its own terms; see [third-party notices](THIRD_PARTY_NOTICES.md).

The MIT licence applies to the original HTML/CSS/JavaScript implementation,
Apps Script backend, scripts, tests and software setup documentation. It does
not replace the data and narrative-content licence, including for data embedded
in JavaScript. Mixed-source CSV files and spreadsheets are covered by CC BY 4.0
only for the author's original contributions, not third-party source material.
