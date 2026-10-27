# PR 4: Accessibility and complementary country data table

## Scope and branch
Source: `optimization` following PR 3 merge (merge commit `002a4d91`). Feature: `optimization-accessibility`. Git does not permit the literal `optimization/accessibility` child ref while the parent `optimization` branch exists. PR #10 targets `optimization`. Production `main` and deployment are untouched.

This change aims to address issues identified by the reproducible October 27, 2026 axe baseline. **Automated testing alone is not a WCAG 2.2 AA conformance audit**. Desktop and touch-screen reader testing on actual devices remains necessary.

## Preservation of interpretation and scientific data

No `data/*`, source workbook, `scripts/update_who_tb.py`, or `apps-script/*` files are changed. The map keeps the same four retail medicines, full-package classifier, TB rates, smoking-attributable TB cases, year, threshold semantics, and all six medicine views.

In TB access comparison, the meaning is unchanged: red = zero medicines confirmed available (may include uncertain statuses), light green = one confirmed, medium green = two or three without full package, dark green = full package. The single-available shade is darkened slightly and its country boundaries outlined to distinguish it better from the pale ocean. `Uncertain` is not reinterpreted.

The new table computes statuses from the *same* `DATA`, `TB.countries`, `RET`, and `fullPackageStatus` functions as the map. Missing TB estimates display `No data`; an actual numeric zero displays `0`. All 195 countries can be accessed through name search or the eight 25-country pages. Numeric sort leaves missing estimates last in either sort direction. Wide screens use the native table, while narrow layouts display labelled per-country fields via CSS without changing the semantic underlying table.

## Accessibility changes
- One `main` landmark; existing labelled contribution navigation; added credits `footer`, labelled map region, labelled methods section, skip-to-table link, and table section.
- The map is exposed as a named SVG image; pointer, touch, zoom and existing country search remain functional. SVG subshapes are removed from the sequential tab order because the searchable table is the complete nonvisual equivalent. Map toolbar, legend and zoom use real buttons and their existing pressed state.
- Pinned country details have a dynamic accessible dialog name (country heading), focus moves to the close button, Escape closes, and focus returns to the originating country/search control. Mobile bottom sheets use `aria-modal=true` with Tab containment. Desktop pinned popovers are nonmodal and do not trap focus. Hover-only tooltips remain outside assistive-technology reading order.
- Contrast improvements include footer attribution text, link foregrounds, dark text on lighter status pills, stronger focus indicators and explicit outlined light-green TB comparison countries. Segmented controls, legend controls, zoom, close, page navigation and primary feedback link have increased targets (usually at least 44 CSS px).
- On small screens, a visible labelled sort `select` replaces tab stops in visually clipped table header buttons. A paginated table prevents extremely long mobile pages.

## Baseline versus PR4

The historical PR1 baseline in `docs/BASELINE_REPORT.md` reported serious `color-contrast` in **30 state occurrences**, serious `aria-dialog-name` in **28**, moderate `region` in **28**, and moderate `landmark-one-main` in **24**. Counts are across scanned states, **not unique defects**. PR2/PR3 had already improved some landmarks and country dialog naming; therefore comparing PR1 directly with PR4 does not attribute all changes solely to this PR.

An initial PR4 run against source commit `1e82e0b`, before the subsequent pagination refinements, completed **31 Playwright tests passed**, including **24 axe-core scenarios** (375 and 1280px, light/dark, three layers, incidence comparison, country dialog and feedback). Each scanned state passed the new serious/critical-violation gate, and test attachments recorded the complete findings. `npm test` and `npm run check:data` passed, with 195 validated countries. See [the successful initial run](https://github.com/Pikirenia/tobacco_cessacion_map/actions/runs/40504745459) and [its axe/screenshots artifact](https://github.com/Pikirenia/tobacco_cessacion_map/actions/runs/40504745459/artifacts/12734138020). This report must be updated if later runs reveal regressions.

The final PR4 workflow is `.github/workflows/accessibility.yml`. It runs axe across 24 light/dark/mobile/desktop page states, semantic landmark checks, named dialog and focus behavior, keyboard operation for controls and table, pagination across all 195 countries, text contrast sampling, reflow checks at narrow viewport equivalents, and separately captured candidate screenshots. The baseline inventory remains available under `tests/baseline/a11y.spec.cjs`.

## Screenshots and historical baseline

Historic PR1/PR2/PR3 PNG files have **not** been overwritten or automatically approved. PR4 test artifacts attach independent 375px and 1280px light/dark screenshots of map and country table. Differences in target size, colours, added landmarks/table, and the longer page are intentional, but these screenshots need visual inspection before new permanent golden snapshot references are committed. Until that review, older screenshot suites may report mismatches; those are not presumed harmless and should be inspected.

## Open work and limitations

1. Test manual keyboard and speech output with NVDA + Firefox/Chrome, VoiceOver + Safari (macOS and iOS), TalkBack + Chrome (Android), including the mobile CSS card presentation of the native table. Axe cannot prove the table relationship is announced correctly when its rows switch to CSS block/grid layouts.
2. Check 200% and 400% **actual browser zoom**, not solely the equivalent narrow CSS viewport; also verify text-only zoom with user font substitutions.
3. Inspect screenshots, then record approved PR4 golden references without changing historical snapshots; rerun the pre-existing visual test workflows with intentional snapshot versioning.
4. Test real touch drag/pinch, focus restoration from SVG country selections, and mobile screen readers on physical devices. Synthetic browser gestures and desktop emulation cannot fully validate these.
5. Contrast scans cover representative rendered states, not every possible combination of geographic fill/outline or high-contrast forced-colors mode; map classification is always available as text in the table.

**Release policy:** keep PR #10 unmerged pending review, do not modify `main`, do not deploy, do not begin PR5.
