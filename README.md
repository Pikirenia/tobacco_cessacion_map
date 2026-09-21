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

Single self-contained `index.html` (D3 v7, topojson-client; geometry from Natural Earth via world-atlas 50m). No build step.

## Citation

<!-- Add citation / DOI once available -->

## Licence

<!-- Choose a licence for code and data -->
