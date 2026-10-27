# Quality baseline: measurement and visual reproducibility

Baseline source: 2026-10-23 `main` at `f64e86b3`; first capture run date and runner SHA must be recorded from GitHub Actions. No source data, production HTML/CSS/JS, production design or WHO sync are modified by this feature branch.

## Existing coverage

The original `npm test`, `npm run check:data`, `python3 tests/data.test.py`, and `npm run test:browser` remain in place and use Chromium, mobile Chromium and mobile WebKit where configured. New tests use Chromium on Ubuntu 24.04 for deterministic pixels; these are *not* real iOS screenshots.

## Running locally

```bash
npm ci
bash scripts/baseline/install-deps.sh
npx playwright install --with-deps chromium
npx playwright test -c playwright.baseline.config.cjs
```

The initial snapshot images are stored in `tests/baseline/visual.spec.cjs-snapshots` and reviewed as GitHub PNG diffs before acceptance. To intentionally re-record after a reviewed change:
```bash
npx playwright test -c playwright.baseline.config.cjs tests/baseline/visual.spec.cjs --update-snapshots
```
Never regenerate snapshots in routine regression CI. Screenshot assertions allow only a 0.2% pixel difference and disable animations and caret painting. The CI workflow has a one-time bootstrap restricted to its named feature branch and commits baseline PNGs there. It does not auto-merge. On PRs, snapshots are strictly compared.

Seven CSS widths (320, 375, 390, 768, 1024, 1280, 1440), light/dark schemes and six map states (medicines, TB incidence, smoking-attributable TB and access comparisons at >100, >200, >400) are captured. The map is compared at every intersection; full-page capture covers medicines for each intersection and comparison controls for representative mobile and desktop widths.

Determinism: Playwright is pinned to 1.63.0 in package-lock.json; dedicated visual project fixes OS in CI, Chromium project, device scale = 1, color scheme, 900px height, locale, timezone and reduced motion. CDN D3 and topojson are intercepted and replaced with locally installed exact versions (7.8.5 and 3.1.0). Google fonts are blocked and a bundled system Arial fallback is forced *for testing only*, with the actual web CSS unchanged. Data fixtures are immutable copies of `data/map-data.js` and `data/tb-data.js` at baseline commit. Fixture updates require explicit review; WHO automation never updates these copies. Browser engine, OS font version, and image-rendering differences may still affect cross-platform pixels; generate/compare approved snapshots on the prescribed runner.

Accessibility scans use axe-core 4.10.3 for WCAG 2 A/AA, WCAG 2.1 A/AA and best practices at 375 and 1280px, both schemes, all layers, thresholds, tooltip and feedback. Each scan attaches `axe-report.json` with individual nodes and severity counts. The first stage inventories rather than suppresses existing violations; move to a fail-on-new-violations policy after approving a baseline.

Functional checks include initial rendering and reload, form-state simulation, layer switches, all thresholds, filters, search, map tooltips, zoom and browser navigation. The existing suite continues to protect cross-browser behavior.

## Laboratory and field metrics

Run the independent lab measurements documented in `docs/BASELINE_REPORT.md`. Browser PerformanceNavigationTiming, PerformancePaintTiming and paint observers measure a controlled lab run. They do *not* establish CrUX field LCP/CLS/INP. INP requires real user interaction distributions and is **not** claimed from synthetic switching timing. Lighthouse lab LCP/CLS and accessibility audits are specific to tested settings; obtain field metrics separately from CrUX when available.

## Findings and known limitations

- The world topology is a large render-blocking geography payload relative to individual scripts. Measure before deciding on simplification or compression.
- The map SVG has one image label but its individual paths lack keyboard navigation and country-specific accessible names. This is a keyboard and screen-reader evaluation priority, not proof of a specific axe rule violation.
- Color categories require nearby legend and text explanation for non-color perception.
- Tooltip behavior and fixed bottom sheets deserve manual mobile keyboard and screen-reader review.
- The browser-native form restoration across BFCache varies by browser; test observes it, while the existing Firefox restoration regression test simulates it deterministically.
- Screenshots with system Arial are an *engine-stable testing approximation*; they are not screenshots of the externally hosted Public Sans rendering.
- No automatic comparison to a production RUM/field INP distribution is possible in this static repository alone.

## Priorities

P1: establish reproducible initial map render and layer switching, avoid exceptions and broken controls.
P1: determine and document accessible interaction strategy for non-focusable country paths and accessible tooltips, without changing production in this PR.
P2: investigate geography transfer size, LCP timing, and initial D3 rendering cost using measured lab results.
P2: inspect 320/375px layouts and zoom controls for touch target and overflow behavior.
P3: improve tooling for Lighthouse regression budgets, CrUX coverage, contrast checks and multi-browser screenshot approval.

## Preservation

Only testing files, reference fixtures, documentation and a separate CI workflow are introduced. Live medicine data, classifications, WHO sync, and visual appearance remain exactly as they were.
