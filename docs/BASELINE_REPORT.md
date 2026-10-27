# Performance, visual, and accessibility baseline (27 October 2026)

Source commit: `f64e86b3d242b7e1e4db2ebce43415fc34d43399`.
The live home page was inspected via publicly indexed HTML; this is **not** a completed scripted browser performance audit.

## Measurements

At the time of setting up the first workflow run, **no browser lab results have yet been obtained**. Do not mistake expected fields for measured values. Reports are generated as GitHub Actions artifacts:

- `performance-local.json` and `performance-production.json`: 375/1280px, Chromium, first page load and 7 repetitions per map-layer click (median and 95th percentile), comparison threshold times, navigation timing, FCP, LCP PerformanceObserver, CLS PerformanceObserver, reported cross-origin resource size and page errors.
- `lighthouse-{local,production}-{mobile,desktop}.json`: Lighthouse 12.4.0 full lab JSON when runnable.
- `lighthouse-summary.json`: performance and accessibility category scores, LCP, CLS, Total Blocking Time.
- axe findings per state in `baseline-artifacts/test-results/**/axe-report.json` and HTML runner report.
- screenshot PNG snapshot references in `tests/baseline/visual.spec.cjs-snapshots`.

Static source file sizes (bytes, source not compression/transfer):
- `data/world-topology.js`: 742,414
- `data/map-data.js`: 29,139
- `assets/map.js`: 14,531
- `assets/site.css`: 8,050
- `data/tb-data.js`: 7,895
- `index.html`: 8,065

The map topology is by far the largest first-party script. Transfer sizes (compression, cache and headers) and render time must be measured before drawing optimization conclusions.

## Protocol and limitations

The standalone performance script uses *unthrottled* Playwright Chromium (Ubuntu 24.04, runner-dependent CPU/network, two viewport sizes). Its map click timings are synchronous DOM dispatch to next two animation frames; they are **not** Core Web Vital INP. Navigation entries, lab first contentful paint, PerformanceObserver LCP and layout shifts are captured when supported; `null` means unavailable. Resource Timing for cross-origin requests may report zero transferred bytes absent a Timing-Allow-Origin header. Run-once results do not measure population p75.

Lighthouse separate desktop and mobile profiles run against localhost and the public GitHub Pages site. They are synthetic laboratory profiles, not CrUX field data. Compare only runs of matching Lighthouse version, browser, runner and throttling. Failed audits leave explicit missing output; no values are fabricated. The screenshots use frozen medicine/TB fixtures and a deterministic Arial fallback instead of a network-dependent font, so they do not represent exact production web-font pixels.

## Accessibilty severity

The automated axe-core scan groups individual findings into **critical, serious, moderate and minor**. Findings appear in CI artifacts, not as assumptions in this report. Manual review is additionally required for SVG map keyboard access, non-color legend comprehension, screen-reader announcement of country data, and mobile bottom-sheet focus order. An accessibility score is not equivalent to WCAG conformance.

## Prioritized initial issues

1. P1: verify the first map paint and BFCache state restoration in all supported engines; existing regression tests cover a previous first-render bug.
2. P1: audit keyboard and screen-reader access to country-level SVG paths and tooltip dismissal, which are pointer-centric in current JavaScript.
3. P2: investigate geography loading and SVG path rendering costs, starting from the 742 KB topology source payload.
4. P2: audit mobile 320/375px control overflow and country-detail tables with actual screenshots.
5. P3: after approving results, introduce performance budgets and a no-new-axe-violations policy instead of setting arbitrary thresholds before measurement.

See [QUALITY_BASELINE.md](QUALITY_BASELINE.md) for repeatable testing and CI instructions. No source application files or data have been modified.
