# Performance, visual regression and accessibility baseline

Measurement date: **27 October 2026**. Application under test: [production GitHub Pages](https://pikirenia.github.io/tobacco_cessacion_map/), corresponding to source commit `f64e86b3d242b7e1e4db2ebce43415fc34d43399`. Reference implementation branch: `test/reproducible-quality-baseline`. Original baseline workflow: [successful GitHub Actions run 40479063852](https://github.com/Pikirenia/tobacco_cessacion_map/actions/runs/40479063852). Actual logs and downloadable artifact `quality-baseline-results` are the source of measured values, not estimates.

## Test execution

- Existing `Site checks` run 40479063785: **success**, including Node/Python data tests, integrity checker, desktop/mobile Playwright browser suites.
- Initial visual capture: **84 passed**, with **110 snapshot PNG files** committed to the feature branch (84 map captures + 26 full-page captures).
- Baseline functional, visual and axe inventory suite: **120 passed** (84 visual, 32 automated axe audits, 4 functional/browser navigation tests).
- Screenshots cover widths **320, 375, 390, 768, 1024, 1280, 1440 px**, light/dark, three main layers, TB medicine comparisons at strictly greater than 100, 200 and 400.
- A second workflow run (40479911969) contains the corrected desktop Lighthouse preset and severity aggregation. **Its results must be checked separately before treating them as verified.** No tests in the original successful run were changed in the production application.

## Lighthouse mobile (measured laboratory results)

Lighthouse **12.4.0**, Chromium **153.0.8010.12**, GitHub Actions Ubuntu 24.04, single synthetic measurement per profile. Not field/CrUX Core Web Vitals.

| Metric | Production mobile | Local mobile |
|---|---:|---:|
| Performance | **83/100** | 82/100 |
| Accessibility | **92/100** | 92/100 |
| Largest Contentful Paint | **2,111.7 ms** | 2,133.5 ms |
| Cumulative Layout Shift | **0.20** | 0.20 |
| Total Blocking Time | **367.3 ms** | 423.5 ms |

Desktop Lighthouse failed in the original run due to inconsistent `--form-factor=desktop` and mobile screen emulation. **No original desktop Lighthouse numbers exist.** The flag was corrected to `--preset=desktop` in commit `4b24481`; verify the rerun, do not infer values from the mobile reports.

**INP is not measured.** It requires field event-distribution observation or a valid interaction-specific estimator and is not equivalent to Playwright double-rAF measurements. No CrUX p75 data were retrieved.

## Independent Playwright first-load laboratory run

Unthrottled Chromium, viewport height 900px, one navigation per viewport. Browser paint observer captures the largest candidate available in this test; it is not necessarily the map SVG. `mapReadyWallMs` is runner-side elapsed time to the first rendered legend followed by double rAF.

| Source and viewport | TTFB | FCP | observed LCP | observed CLS | Map ready |
|---|---:|---:|---:|---:|---:|
| Production 375px | 126 ms | 256 ms | 256 ms | 0.0968 | 834 ms |
| Production 1280px | 48.2 ms | 180 ms | 180 ms | 0.0975 | 422 ms |
| Local 375px | 8.2 ms | 160 ms | 160 ms | 0.1463 | 425 ms |
| Local 1280px | 2.1 ms | 132 ms | 132 ms | 0.0975 | 375 ms |

Switch interaction proxy, **production** (seven repetitions per control, median of DOM-click to two rAF frames):
- 375px: TB incidence **32.1 ms**, smoking-attributable TB **32.3 ms**, medicines **32.3 ms**, comparison **32.3 ms**.
- 1280px: TB incidence **32.2 ms**, smoking-attributable TB **32.2 ms**, medicines **32.3 ms**, comparison **32.3 ms**.
- Incidence threshold changes **>100 / >200 / >400** measured approximately **31–34 ms** across viewports.

These timings are strongly frame-quantized and represent an upper-level paint-synchronization proxy, **not the actual script execution cost, total perceived interaction latency, or field INP**. Given a near-constant double-frame measurement, use Chrome tracing or Long Task measurement for meaningful optimization of filter CPU cost.

## Resource inventory

First-party source sizes at baseline: `data/world-topology.js` **742,414 bytes**, `data/map-data.js` **29,139 bytes**, `assets/map.js` **14,531 bytes**, `assets/site.css` **8,050 bytes**, `data/tb-data.js` **7,895 bytes**, `index.html` **8,065 bytes**.

Production Resource Timing reported transfer sizes approximately **246,005 bytes** for world topology, **77,875 bytes** for hosted D3, **5,651 bytes** for map JS, **4,926 bytes** for country data, **2,855 bytes** for CSS, and **2,114 bytes** for TB data. These are browser-reported transfer sizes for a specific navigation, influenced by gzip/caching/cross-origin policy, not guaranteed wire totals.

## Axe-core accessibility findings (measured)

Axe-core **4.10.3** scanned **32 cases**: 375 and 1280px, both color schemes, six map states, country tooltip, and feedback page. The counts below are *rule occurrences across scan states*, not counts of unique defects or people affected.

| Severity | Rule | Occurrences | Example |
|---|---|---:|---|
| Critical | None detected | 0 | Does not imply full accessibility |
| Serious | `color-contrast` | 30 | Attribution text has approximately **3.43:1** contrast in light mode vs the expected 4.5:1 for standard text |
| Serious | `aria-dialog-name` | 28 | `#tip` dialog has no accessible name |
| Moderate | `region` | 28 | Map filter and control regions are outside landmarks |
| Moderate | `landmark-one-main` | 24 | Map page lacks a `main` landmark |

Manual audit required beyond axe: SVG geographic paths lack keyboard-focusable country semantics, country-tooltip keyboard/focus behavior, legend meaning without color, and narrow-screen country table navigation. The run inventories known violations without failing, to preserve the measurement-only remit; enable regression gating against an approved severity/rule fingerprint later.

## Screenshot/UX observations

Review of checked-in PNG snapshots detected an existing **horizontal document overflow at 320, 375 and 390px in the medicines view**. Full-page PNGs are **419px wide** at each of those narrower CSS viewport settings. TB comparison screenshots at 375px did not exhibit the same overflow. This likely involves the horizontally scrollable medication selector's sizing, and must be diagnosed in a separate optimization PR. The world map also occupies a small vertical area on narrow screens, reducing geographical legibility.

The 110 PNGs are actual rendered snapshots, not mocked diagrams. Snapshots intentionally use frozen data, locally pinned D3/topojson, Ubuntu Chromium, device scale 1, reduced motion, suppressed animation and Arial system fallback, whereas the public page uses Google Public Sans. This limits pixel-exact fidelity to the production web-font rendering and requires approval on the same CI runner.

## Prioritized technical/UX issues (no production code changed)

1. **P1: Mobile horizontal overflow** at 320–390px in the medicines view; fix sizing while preserving filter semantics.
2. **P1: CLS 0.20 on throttled Lighthouse mobile**, identify layout-shift sources and test a fix without compromising first render.
3. **P1: Serious accessibility**: label the dialog and fix attribution/color contrast; design keyboard/screen-reader country-detail interaction.
4. **P2: Missing semantic landmarks** and responsive mobile tooltip/table handling.
5. **P2: Loading cost of 742KB geography geometry source / 246KB compressed transfer**, investigate gzip/cache/timing and mapping cost before simplifying any geography.
6. **P3: Benchmark meaningful interaction work** using trace-backed CPU durations rather than double-rAF floor; add performance budgets only after repeat-run distribution and controlled throttling.

## Reproducibility and limitations

Exact test commands, screenshot fixtures, runner config, app-data preservation and feature-branch-only screenshot bootstrap are documented in [QUALITY_BASELINE.md](QUALITY_BASELINE.md). The first baseline was run in GitHub Actions, not locally in ChatGPT's isolated container. Lighthouse and Playwright are *different* lab profiles and must not be numerically equated. Production may change after this dated capture. No production data, methodology, WHO synchronization or appearance was altered in this PR.
