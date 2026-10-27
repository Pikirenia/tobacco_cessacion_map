# PR3 mobile-first optimization

Branch: `optimization-mobile-ux`. Git cannot host `optimization/mobile-ux` alongside the existing `optimization` branch; the naming follows PR2. PR2 merged at `7d6a95d`.

## Mobile design
- The original Equal Earth projection, 1000×520 SVG coordinates, 195-country dataset, country boundaries and island dots remain intact.
- At widths up to 640px, a reserved 320–520px tall region uses `preserveAspectRatio=xMidYMid slice`: geometry retains its proportions and outer areas are clipped. A visible World toggle restores `meet` without losing the full-world view.
- Horizontal medicine/layer strips get explicit `min-width:0` across nested flex/grid items. The initial overflow may stem from `width:max-content` segments and intrinsic flex sizing: **the exact offending element requires confirmation from browser overflow diagnostics.** No `overflow-x:hidden` workaround is applied to the document.
- Mobile uses `touch-action:pan-y` and accepts D3 pinch manipulations only after a two-touch start. Buttons remain available. Screen scrolling is preserved.
- Small polygon hit circles and dot hit circles add invisible interaction area, with unchanged visible geometry. Country search is always present.
- Detail sheet has a height cap, safe-area padding, keyboard close/Escape, and vertically arranged medicine cards with confirmed availability, WHO sold, OTC/Rx, reimbursement, NRT essential-list, full-package, and both TB indicators.
- Map height is reserved before external scripts load to address one plausible CLS source. No metric improvement is claimed without tests.

## Verification
See the GitHub Actions `Mobile UX PR3` workflow and `mobile-ux-pr3-results` artifact for actual screenshots, Chrome/WebKit responsive tests, overflow reports, layout-shift sources and Lighthouse output. Original PR1/PR2 PNGs remain untouched. Lighthouse metrics are lab results; production main and feature branch are different commits. Browser-synthetic multi-touch tests cannot establish real iOS Safari gesture behavior, which remains a manual validation item.
