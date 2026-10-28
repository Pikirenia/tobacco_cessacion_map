# Smoking cessation medicines

Interactive world map of legal retail availability of four smoking cessation medicines (NRT, varenicline, cytisine and bupropion) in 195 countries, plus two WHO-modelled TB indicators and IHME GBD 2023 age-standardized lung cancer incidence for adults aged 50–79.

**Live map:** https://pikirenia.github.io/tobacco_cessacion_map/

## What the map shows

- **Colour** — number of medicines with confirmed retail availability (0–4). White: status of all four medicines is uncertain (no data). Grey: territories outside the 195-country study.
- **Tooltip** (hover or tap) — retail status per medicine, WHO "legally sold" status (2024), dispensing category (OTC/Rx), reimbursement, and inclusion of NRT in the national essential medicines list.
- **Layer switch** — medicines, WHO TB incidence, WHO smoking-attributable TB cases, or GBD 2023 lung cancer incidence (ages 50–79). The original per-medicine availability views remain unchanged.
- **Combined exploration** — in either TB layer, filter/highlight countries by retail availability of an individual medicine or the Full package; country tooltips display both TB measures and medicine availability.
- **High-incidence medicine access comparison** — in the TB incidence layer switch "TB incidence display" to "Medicine access comparison", then select a strict threshold (>100, >200, or >400 per 100,000). Above-threshold countries are coloured red for **0 confirmed available medicines**, light green for **exactly 1**, medium green for **2 or 3 medicines without the full package**, and dark green for **full package confirmed available** (NRT + bupropion + either varenicline or cytisine). Countries at/below the threshold are muted and missing TB estimates remain distinct. The red category is *no confirmed retail availability*, which can include UNCERTAIN medicine statuses; it is not a claim that all medicines have been confirmed unavailable.

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

## IHME GBD 2023 lung cancer incidence (static, non-commercial data)

The **Lung cancer** layer shows annual modelled incidence of tracheal, bronchus and lung cancer (GBD cause 426; ICD-10 C33–C34) among adults aged 50–79, per 100,000, age-standardized within this age range. Both sexes, Male and Female are derived separately from their respective GBD rates, not by averaging sex-specific rates. The six Segi–Doll standard weights for ages 50–54 through 75–79 are 5,000; 4,000; 4,000; 3,000; 2,000; 1,000, normalized to 19,000. The GBD reference year is 2023.

Incidence display uses <50, 50–99.9, 100–149.9 and ≥150. **Medicine access comparison** uses cumulative, inclusive thresholds **Moderate+ ≥50**, **High+ ≥100**, and **Very high ≥150**, for the selected sex. These are project-specific descriptive thresholds, not categories defined by IHME or WHO. The access colour scheme matches the TB comparison: red means zero medicines confirmed available (not necessarily all confirmed unavailable), light green one, green two or three without Full package, and dark green Full package. Lower-incidence countries are muted; missing data are not zero.

GBD 2023 original export: **204 locations × six ages × three sex categories = 3,672 observations**. The existing medicine study remains **195 countries**; all 195 map to explicitly validated ISO3 codes. The nine other GBD locations (American Samoa, Bermuda, Greenland, Guam, Northern Mariana Islands, Puerto Rico, Taiwan, Tokelau and US Virgin Islands) are not added to the medicine study. No country observations were imputed.

To reproduce using an *authorized local export* from the [GBD Results Tool](https://vizhub.healthdata.org/gbd-results/):

```sh
python3 scripts/build_lung_cancer.py --input /path/to/IHME-GBD_2023_DATA.csv --check
# Omit --check to rebuild the derived static data resource after validation.
```

The original IHME export is **not stored or published** in the repository. The compact `data/lung-cancer-data.js` resource contains only the 195 study-country derived rates, without uncertainty intervals. The build script independently verifies 204 locations, six age groups per sex, unique and nonnegative observations, ISO3 matching, expected full-GBD category counts and reference country rates. There is no live IHME API call or automatic synchronization.

Interpretation: total lung cancer incidence is **not** smoking-attributable cancer incidence or present-day smoking prevalence. It partly reflects smoking exposure accumulated over decades, but also other risk factors, cancer surveillance, ascertainment and modelling uncertainty. A disease-burden/medicine-access mismatch must not be interpreted causally.

**IHME terms:** The [Free-of-Charge Non-Commercial User Agreement](https://www.ihmeclientservices.org/noncommercial.html) governs use of the IHME-derived data. Source: Institute for Health Metrics and Evaluation. Used with permission. All rights reserved. These data are **not licensed under the website's CC BY 4.0**; IHME does not endorse the site. See [third-party notices](THIRD_PARTY_NOTICES.md).

## WHO tuberculosis estimates (automatically synchronized)

The map includes precisely two additional WHO indicators:

1. **TB incidence per 100,000 population:** WHO estimate of new and recurrent TB cases each year, including HIV-associated and drug-resistant TB.
2. **Smoking-attributable TB cases:** WHO estimate of new TB episodes attributable to smoking, among adults aged 15 years and older, based on population attributable fractions. This is not a count of people with TB who smoke.

The authoritative downloads are the WHO Global TB Programme's machine-generated CSV files:
- https://extranet.who.int/tme/generateCSV.asp?ds=estimates
- https://extranet.who.int/tme/generateCSV.asp?ds=estimates_age_sex

`scripts/update_who_tb.py` uses Python's standard library to fetch and validate both files and selects the **latest common reference year** with adequate country coverage. It uses WHO's smoking risk-factor best estimate (sex=all, adult age group, incidence, unit=number), never calculates an attributable number from smokers among TB cases. Missing values are not replaced by zero or values from earlier years. Countries are matched using ISO3 codes to the existing 195-country map.

The `Sync WHO tuberculosis estimates` GitHub Actions workflow validates on pull requests and synchronizes weekly on Mondays, on relevant pushes to `main`, or via a non-dry-run manual dispatch **on `main` only**. Data and schema failures preserve the last verified snapshot. Important reference-year, missing-country, coverage or magnitude changes require human verification and an explicitly approved main-branch manual dispatch. Routine unchanged downloads make no commit. See [WHO validation rules and safe publication](docs/PR6_DATA_RELIABILITY.md). Country medicine records and feedback forms are unaffected.

Initially, the TB layers show No data until the first successful automated sync. The latest source year and last successful update date are displayed beneath the map. WHO routinely revises past-year estimates, so do not compare series from different report vintages without caution.

Source: [WHO Global Tuberculosis Programme](https://www.who.int/teams/global-programme-on-tuberculosis-and-lung-health/data). WHO-derived material retains WHO's attribution and applicable [dataset terms](https://data.who.int/about/data/terms-and-conditions). No WHO endorsement is implied. This project's MIT code license and CC BY 4.0 license for original project content do not replace any applicable third-party rights.

## Technical notes

Static `index.html`, `assets/map.js` (D3 v7, topojson-client), shared `assets/site.css`
and map dataset in `data/map-data.js`; WHO TB estimates are independently generated in `data/tb-data.js`, and the GBD-derived layer has a separate static resource `data/lung-cancer-data.js`. Unchanged Natural Earth/world-atlas 50m
geometry is in `data/world-topology.js`, cached independently of page edits.
Scripts use `defer` and execute in dependency order. No production build step or new runtime dependencies.

Local CSS, JavaScript, country data and geography use automatic content-addressed `?v=` hashes in the HTML for reliable cache invalidation. Run `python3 scripts/version_assets.py --write` after updating a referenced resource, and commit the HTML and resource together. CI runs `python3 scripts/version_assets.py` to detect outdated references. The frontend displays a retry notice on missing dependencies and a basic country table when geographic initialization fails.

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

Run `npm ci`, `npm test`, and `npm run check:data` for local checks. WHO parser regression tests can also be run directly with `python3 -m unittest discover -s tests -p 'test_who_tb*.py'`.
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
