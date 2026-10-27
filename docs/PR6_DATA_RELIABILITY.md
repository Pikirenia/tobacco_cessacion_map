# PR 6: WHO tuberculosis synchronization and cache reliability

## Fixed scientific scope and sources

Only the WHO Global Tuberculosis Programme CSV files are used:
- `https://extranet.who.int/tme/generateCSV.asp?ds=estimates`
- `https://extranet.who.int/tme/generateCSV.asp?ds=estimates_age_sex`

The two map layers remain (1) `e_inc_100k`, WHO's estimated annual TB incidence per 100,000, and (2) WHO's **best estimate** of incident TB cases attributable to smoking, selected from `risk_factor=smk/smoking/tobacco smoking`, `measure=inc`, `unit=num`, `sex=all`, `age_group=15+`. Other risk factors, prevalence, mortality, and patient smoking status are never substituted. Values are not derived from the medicine dataset.

The parser selects the latest common year **with at least 120 countries having both estimates**. It then includes all available incidence or smoking estimates for map countries in that year; unavailable values remain JavaScript `null`. It does not borrow observations from different years. The historical display policy rounds incidence to two decimal places and attributable cases to integers; original WHO CSV values are not edited. Only the public snapshot is formatted.

## Rules, diagnostics and rationale

| Rule | Behavior | Rationale |
| --- | --- | --- |
| WHO response is empty, invalid UTF-8, above 12 MB, mismatched Content-Length or malformed CSV | Fatal validation error, no update | Reject truncated, error-page or unexpectedly large responses |
| Missing required incidence/risk-factor fields, duplicate/empty headers | Fatal | Prevent silent WHO schema changes or wrong metric selection |
| ISO3 not three Latin letters for data-bearing country rows, invalid year, duplicate selected ISO3/year records | Fatal | Avoid misattribution and indeterminate country estimates |
| Numeric text not recognized, negative, NaN or infinite | Fatal for selected country/metric, no update | Never coerce invalid values to missing or zero |
| Empty cells, NA, N/A, null or period | Missing; no imputation | Preserve the distinction between missing estimates and genuine zero |
| Risk/sex/age/measure/unit not the exact accepted WHO definitions | Excluded from this indicator, no fallback | Prevent use of different age cohorts, populations or measurement units |
| Fewer than 120 paired countries in any common year | Fatal | Catch incomplete WHO publication; preserve latest-adequate-common-year method |
| Existing snapshot cannot be parsed or has impossible values | Fatal | A corrupt comparison baseline must not be silently trusted |
| Previously covered countries disappear for either metric | Human review required | Unexplained country loss is consequential even below the threshold |
| Indicator coverage loss exceeds 8% of previous coverage | Additional high-severity review diagnostic | Configurable early warning (`--coverage-loss-threshold 0.08`) |
| Latest common reference year advances or regresses | Human review required | Flag changes of reporting vintage and unexpectedly older coverage |
| Estimate changes by more than 5x with previous value at least 10/100 (incidence/cases) | Human review required | Identify material revisions without rejecting WHO's estimates as false |
| Valid indicator changes with no warnings | Updated after validation | Avoid blocking ordinary WHO revisions solely on their size |
| Dataset identical to previous year/estimates | No write or commit | Stable asset URL, history and publication timestamp |

Review diagnostics are **not evidence of WHO error**. Large retrospective revisions remain WHO's authoritative published figures. The reviewer should check the official release, country definitions, year and each flagged change. To publish after source verification, manually run the workflow on `main`, clear `dry_run`, and set `approve_review`. Approval bypasses comparison review warnings **but never** validation failures. Exit code 1 indicates a validation or download failure; exit code 2 means a valid update held for review.

The threshold denotes the **fraction of the previous metric's covered countries that vanished**, not a change in mean rate or counts. Even below 8%, disappearing values are reported and require review. A source can include countries outside the study; the comparison uses only the map's 195 ISO3 identifiers. The 120-country safety floor is the established map integration criterion, not a WHO completeness standard.

## Safe publication and branch isolation

`scripts/update_who_tb.py` downloads with up to three attempts, validates both sources fully, compares with the last published `data/tb-data.js`, and writes a temporary file in the target directory. The update is completed by atomic `os.replace`. No WHO data are changed if download, parsing, validation or review fails. `--dry-run` performs the same checks but cannot write.

`.github/workflows/update-who-tb.yml` separates read-only pull-request tests from publication. Only a schedule, eligible push or explicit non-dry-run manual dispatch on the literal `refs/heads/main` can push to `main`; publishing is a separate job with narrowly scoped `contents:write`. On non-main branches, manual runs are read-only dry runs. Concurrency is per ref, and the workflow commits both WHO snapshot and HTML references together after checking diffs, so a unchanged estimate never creates a commit. Production GitHub Pages behavior remains unchanged, and no integration-branch test or pull request publishes anything.

For local diagnostics:
```sh
python3 -m unittest discover -s tests -p 'test_who_tb*.py'
python3 scripts/update_who_tb.py --dry-run
python3 scripts/version_assets.py
```

## Cache integrity and frontend failure modes

`scripts/version_assets.py` computes each local asset's Git blob SHA-1 and places its first 12 hexadecimal digits in the referencing HTML (`?v=<hash>`). This handles `index.html` and the feedback page, including CSS, map code, country data, TB data, geography and local feedback scripts. When editing any referenced asset, run `python3 scripts/version_assets.py --write` and commit asset and HTML together; `python3 scripts/version_assets.py` verifies the hashes in CI. External pinned D3 and TopoJSON versions retain their existing URLs. GitHub Pages serves the same static files; no server, database or third-party cache service is needed.

An inline dependency-free startup monitor detects missing scripts and uncaught initialization errors. It displays an accessible alert with a reload button. If the geographical map or its libraries fail but country data loaded, a read-only 195-country table is shown as fallback. If WHO data alone fail, the medicine map and table continue functioning while missing WHO values display **No data**, never zero. Automatic browser tests simulate blocked WHO, D3, TopoJSON, geography and map scripts, as well as recovery after a retry.

## Limitations

A static GitHub Pages publication is not a transactional multi-file HTTP deployment: during propagation, a client can briefly request a newly referenced hash while an edge still serves old bytes. The failure notice and retry are safeguards, not a CDN-level atomic rollout guarantee. Query hashes prevent stale local browser cache reuse when HTML updates, but a stale cached HTML page cannot learn about future revisions until that HTML is refetched. Client-side resource checks cannot reconstruct untrusted WHO estimates; they deliberately degrade rather than fabricate data. Numeric revision thresholds are review heuristics, not epidemiological plausibility criteria. Tests use controlled WHO CSV fixtures and mocked failures; they never damage the live sources.

**Scope guard:** availability statuses (including Uncertain), Full package, geographic boundary geometry, and the two TB indicator definitions are unchanged.
