# PR 2: Desktop UI and map controls optimization

## Scope and branch protection

Base: `optimization` at PR 1 merge `9d6465c`. Feature: `optimization-desktop-ui`. The exact requested `optimization/desktop-ui` cannot coexist with `optimization` under Git ref naming rules. This PR targets **optimization**, not `main`. No deployment is configured or requested.

Only the interactive map's HTML/CSS, TB threshold-control wiring, browser tests, and screenshot workflow are changed. Map geometry, source medicine/WHO data, availability logic, full-package definition, TB breakpoints, and the feedback form are unchanged.

## Interface changes

- Controls follow an explicit top-to-bottom hierarchy: map layer, layer-specific visualization, contextual filters, country search.
- A dedicated responsive Grid/Flexbox toolbar keeps search apart from the classification controls; narrow views scroll their own segmented selector instead of overflowing the document.
- TB incidence comparison now uses keyboard-accessible `> 100`, `> 200`, `> 400` segmented buttons. The existing native `#tbCutoff` select remains hidden as a form-state restoration mirror, and the selected button synchronizes from its value on `pageshow`.
- In comparison mode, medicine-specific TB highlight/status selectors are hidden; in incidence-rate mode and smoking-attributable-TB mode they remain available.
- Existing medicine order, legend categories, colors and counting are unchanged. Red still denotes **zero confirmed available medicines**, possibly including uncertain statuses. Below-threshold and missing-incidence data remain separate.
- Header and map remain styled as before. New main landmark and a labeled tooltip dialog improve semantic navigation.

## Before-and-after visual evidence

**Before:** PR 1 committed baseline images under `tests/baseline/visual.spec.cjs-snapshots/`, captured in all six map states at 320/375/390/768/1024/1280/1440 px and in both themes. They are retained unchanged.

**After:** All six map states have new `-desktop-v2-map` snapshots, and layout-sensitive full-page screenshots have a `-desktop-v2-page` suffix, stored beside the originals without replacing them. The dedicated `Desktop UI PR 2 regression and screenshots` workflow captures these using the same Ubuntu 24.04 / pinned Chromium + Arial fallback environment. New functional tests attach additional 1280px and 1920px full-page screenshots for Medicines and TB comparison in light and dark modes to the test artifact. Versioned PR 2 map snapshots compare against post-change references; the original PR 1 map and page PNGs are immutable and remain available for direct before/after review.

Compare screenshot pairs at the same viewport, theme, and scenario; the new filenames are distinguished by `-desktop-v2-map` or `-desktop-v2-page`. Do not compare screenshot pixel output from this harness directly to an unconstrained production screenshot with Public Sans.

## Verification matrix

- Widths: 320, 375, 390, 768, 1024, 1280, 1440 and **1920**; light and dark schemes.
- Medicine views: Full package, All four, NRT, varenicline, cytisine, bupropion.
- Layers: medicines, TB incidence (rate and access comparison), smoking-attributable TB.
- Thresholds: strictly `> 100`, `> 200`, `> 400` incidence per 100,000; selected state, hidden contextual controls and legend categories.
- Screen/document overflow check; search, tooltip, zoom/reset, keyboard activation, form restoration, initial load and refresh.
- Separate existing cross-browser Playwright, data integrity and feedback checks remain enabled in `Site checks`.
- Axe inventory remains measured by PR 1 tests; the new toolbar does not redefine or suppress violations.

## Test commands

```bash
npm ci
bash scripts/baseline/install-deps.sh
npx playwright install --with-deps chromium
npx playwright test -c playwright.baseline.config.cjs
npm test
npm run check:data
python3 tests/data.test.py
npm run test:browser
```

Note: new page reference PNGs are deliberately bootstrapped only on the feature branch by `.github/workflows/desktop-ui.yml`. The bootstrap aborts if it touches any original snapshot; after capture, ordinary PR/CI runs strictly compare the new candidates. Review the visual diffs before merging.

## Baseline benchmarks and remaining issues

PR 1 production Lighthouse lab scores were desktop performance 97/100, accessibility 92/100, LCP 832 ms, CLS 0.10; mobile 79/100, accessibility 92/100, LCP 3.31 s, CLS 0.20 in the corrected run. These are one-run **pre-optimization** laboratory findings, not performance claims for PR 2; field INP is unavailable.

Remaining outside this layout-focused change:
1. Review remaining axe contrast and the need for accessible, keyboard-focusable country paths; a named dialog is only a partial tooltip accessibility improvement.
2. Address production mobile CLS under throttled Lighthouse separately after trace-based diagnosis.
3. Profile geography transfer/rendering and real interaction CPU costs before optimizing map data.
4. Test complex manual mobile screen-reader, touch, and BFCache interactions on physical devices.

CI workflow runs and actual outcomes should be attached to the PR after completion. Failures must be reported, not treated as passing.
