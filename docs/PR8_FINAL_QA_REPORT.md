# PR8: Final integrated quality audit and release decision

**Audit date:** 2026-10-27. **Repository:** `Pikirenia/tobacco_cessacion_map`.
**Production:** `main` at `f64e86b3d242b7e1e4db2ebce43415fc34d43399`.
**Integrated baseline:** `optimization` at `7d92a0ec5caf475b72b5c1bda306896683ee290a`.
**QA branch:** `optimization-pr8-final-qa`. [QA pull request #15](https://github.com/Pikirenia/tobacco_cessacion_map/pull/15).
**Workflow evidence:** [PR8 integrated QA workflow run](https://github.com/Pikirenia/tobacco_cessacion_map/actions/runs/40563627009).

> **Provisional decision: NOT READY FOR PRODUCTION RELEASE.**
> This reflects release-gate evidence still in progress, not a demonstrated critical application defect. A final production PR must not be opened or merged until the full QA gate has passed and the owner has approved the actual release.

## 1. Optimization inventory and integration

GitHub PR metadata was checked individually. The following are **merged to `optimization`**, not to `main`: PR #7 (stage 1, reproducible baseline), #8 (stage 2, desktop), #9 (stage 3, mobile), #10 (stage 4, accessibility), #11 (stage 5, measured geographic performance), #12 (stage 6, WHO reliability), #13 (stage 7, feedback and sharing), and #14 (two supplemental PR7 WebKit landscape screenshots).

GitHub compared `main...optimization` and reported **113 commits ahead, 0 behind**, before QA changes. The comparison did not list modified source medicine CSV/Excel, country map JS, WHO TB snapshot, topology, or licensing files. Production `main` remained at the SHA above during the initial QA checks.

## 2. Scientific data integrity: checks executed

- Independently imported the owner-supplied validated `smoking_cessation_COUNTRY_FINAL_EN.xlsx` (not the repository copy) and compared **all columns of all 195 rows** of its *By country* and *WHO detail* worksheets against `optimization` CSV files. Results match exactly after common CSV/worksheet normalization. Country, medication, legal status, dispensing, and reimbursement fields matched, not just counts.
- Verified the original Full package formula: **NRT + bupropion + (varenicline OR cytisine)**, confirmed available only for **41 of 195** countries.
- Confirmed the four-medicine available totals: **NRT 96, varenicline 46, cytisine 46, bupropion 61** countries.
- The intended medicine comparison partitions all 195 countries by **confirmed retail availability**: 80 zero confirmed (red), 53 one (light green), 21 with two/three but no full package (green), 41 full package (dark green). `Uncertain` does not add a separate comparison category; zero confirmed is *not* equivalent to proven unavailability.
- Parsed the checked-in WHO TB snapshot: reference year **2024**, dated **2026-10-23**, with values for **194 of 195** countries, and 43 countries without a smoking-attributable estimate. A genuine **zero TB incidence for San Marino** is distinct from absent data.
- Independently calculated the comparison groups for incidence strictly greater than threshold:

| TB incidence cutoff | Countries above | Below or equal | No TB incidence | Zero confirmed | One available | Two/three without full | Full package |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| >100 | 62 | 132 | 1 | 39 | 14 | 3 | 6 |
| >200 | 34 | 160 | 1 | 21 | 8 | 0 | 5 |
| >400 | 11 | 183 | 1 | 10 | 1 | 0 | 0 |

The source comparisons above verify stored data and deterministic arithmetic, **not** the exact visual appearance of the still-running PR8 browser checks. WHO methodology/source definitions and malformed CSV behavior are checked by the repository's existing Python tests and must be reconfirmed in the integrated CI runs. No live WHO download or scientific value changes were attempted.

## 3. Functional tests and resilience

The [integration head's Site checks run](https://github.com/Pikirenia/tobacco_cessacion_map/actions/runs/40560862503) succeeded, providing prior integrated automation evidence. Original browser suites cover medicine filters, both TB layers, >100/>200/>400, class/legend counts, initial load, URL restoration and history, country search and popup, table pagination/sort, zoom, failure recovery and mocked feedback. A separate PR8 browser suite was added to explicitly test all medicine options, exact threshold boundaries, zero versus null, and the requested responsive widths. Actual PR8 results and failures must be taken from workflow run #40563627009.

The existing resilience suite injects local resource failures for D3, TopoJSON, topology, WHO TB, and map JS. The WHO synchronization unit suite uses offline fixtures for schema and coverage regressions. All tests run on a local checkout or intercepted network requests, **not** the production Google Sheet or public site's state.

## 4. Desktop/mobile and accessibility

- Historical baseline screenshots are retained in version-controlled screenshot directories. The PR8 workflow executes snapshot comparisons without `--update-snapshots`.
- Requested responsive widths **320, 375, 390, 430, 768, 1024, 1280, 1440 px** are included in added map/table/feedback light/dark checks. Existing mobile tests include portrait and landscape, mobile Chromium and WebKit. Desktop baseline includes 768–1440 px screenshots in both themes.
- Axe-core inventory and serious/critical PR4 gates, focus management, table, landmarks and mobile dialog assertions run in the baseline job. Automated checks alone cannot establish WCAG 2.2 AA: final manual keyboard, screen-reader, zoom, touch and visual review remain required.
- Responsive screenshot and accessibility artifacts: [PR8 workflow run](https://github.com/Pikirenia/tobacco_cessacion_map/actions/runs/40563627009), when jobs finish.

**Final numeric accessibility violations, visual regressions, and manually reviewed screenshots:** pending evidence.

## 5. Performance

Historical reported baselines (not precise budgets): desktop Lighthouse score ~97; mobile ~79–83; mobile CLS ~0.20. Stage 5's controlled five-run evidence reported mobile Lighthouse medians **77 before / 80 after**, desktop **97 / 97**, and the full-geography fit median **53.4 ms / 0.4 ms mobile** and **54.0 ms / 0.3 ms desktop**. This directly reduces geometry-fit work, but stage 5 did *not* establish a certain end-to-end page speed improvement.

The PR8 workflow is configured to obtain **five cold-context interactive profiles** and **five Lighthouse 12.4 runs per desktop/mobile device**, with output JSON artifacts. It uses synthetic browser/network settings, not real-user field data. Actual PR8 LCP, CLS, TBT, resource transfers, map render timings, switching times and variability: **pending completed run evidence**. No field INP claim is made.

## 6. Licensing and update integrity

Original MIT code licensing, CC BY 4.0 content attribution, and third-party notices remain available. Stage 6 added a guarded WHO snapshot pipeline with fail-closed schema and coverage controls, atomic validated snapshot + cache asset updates, and dry-run support. The final production merge of changes to the WHO workflow/synchronization scripts may itself trigger the existing `push: main` WHO synchronization workflow. This is a **release-operation consideration**: review any WHO changes or commit generated after the merge as a distinct scientific update, and inspect its approval/coverage diagnostics. The integration-only PR8 workflow does not update WHO.

## 7. Defects, limitations and regression risk

| Severity | Finding or open verification | Release effect |
| --- | --- | --- |
| Critical | No confirmed critical application defect in the checks completed so far; independent final cross-browser evidence incomplete | **Release blocked until complete** |
| High | End-to-end PR8 browser, mobile, visual/a11y, and 5-run performance outcomes not yet all inspected | **Release blocked until complete** |
| Medium | Automated accessibility inventory can leave untested screen-reader and touch interactions; must manually review remaining issues | Must triage any findings |
| Low | Historical screenshot baseline uses controlled CI browsers, not all real operating systems/browsers | Documented residual risk |

Risk focus: interacting URL state vs browser restoration, responsive dialog and table sizing, map dependency recovery, cached asset mismatch, and WHO snapshot publication. There is no authorization to change scientific values. Final severity changes must follow actual failure logs, not assumptions.

## 8. Release readiness and owner steps

**Current decision: NOT READY FOR PRODUCTION RELEASE** until all PR8 workflow jobs complete successfully, their screenshots/axe and performance artifacts are inspected, any critical/high regressions are fixed on a branch based on `optimization`, and corrections are reviewed/merged into `optimization`. Confirm again that `main` has not diverged, including any scheduled WHO update. Only then prepare the **final PR `optimization` → `main`**, attach this revised report and specify the merge SHA and deployment expectation. Leave that production PR unmerged for explicit owner approval.

Before approving deployment, the owner should manually review representative mobile/desktop light/dark screenshots, accessible keyboard and mobile dialogs, country table, real link restoration, attribution text, and feedback submission behavior **without sending a dummy production response**.

## 9. Production and rollback procedure (for later authorized release)

1. Record the latest `main` SHA just before merge; check the GitHub Pages publishing source/settings in the repository settings and the latest successful deployment. There is no guarantee here that publication occurs instantly, so verify the deployed site SHA and UI independently.
2. After owner approval, merge the final `optimization` → `main` PR. Monitor Pages build/deployment and the WHO sync workflow if the merged diff changes paths matched by its `push: main` trigger. Confirm all public layers, data, share URLs, feedback UI, and licensing text manually.
3. If a blocker is observed, revert the production merge via a new reviewable rollback PR against `main` (for a merge commit, use `git revert -m 1 <merge-sha>`; for squash/rebase, revert the specific change commits). Keep later unrelated/validated WHO updates in mind. **Do not force-push** or overwrite data.
4. Merge the rollback PR only with appropriate authorization. Wait for the Pages deployment to complete and verify the public site was restored. If needed, use the hosting system's previous deployment recovery mechanism after checking repository settings. Do not assume reverting a Git commit immediately invalidates users' caches; hashed assets, reload behavior and CDN propagation require post-rollback verification.

## 10. Evidence limitations

The current production website was read without interaction; no destructive production tests were run. At the time this report was drafted, the final new GitHub CI run was still in progress and screenshots/5-run metrics were not independently reviewed. This report deliberately separates completed file and arithmetic verification from incomplete functional, accessibility and performance evidence.
