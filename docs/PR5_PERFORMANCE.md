# PR 5: Performance and geographic fidelity report

Date: 27 October 2026. Branch: `optimization-performance`, based on integration commit
`c6a0a74f0c1937470b03b53a17bef3ff1bf768ea` (merged PR 4).
The feature branch is named with a hyphen because Git cannot create
`optimization/performance` while a branch called `optimization` already exists.
PR target is `optimization`; production `main` was not changed or deployed.

## 1. Experimental design and reproducibility

- Source: a local Python HTTP server serving the actual checkout under the GitHub Pages project path.
- Playwright Chromium, fixed 375 × 900 mobile and 1280 × 900 desktop viewports,
  reduced motion, light color scheme, timezone UTC, five **fresh isolated contexts** per viewport
  for each revision. CSS and browser engine are unchanged across revisions.
- The pinned D3 and TopoJSON third-party JavaScript files are fulfilled locally from npm
  to separate application computation from external CDN delays. Remote Google Fonts is blocked
  **in Playwright profiles only**. Production keeps its fonts and CDN paths.
- Timed sections instrument a served copy of `assets/map.js`; the checked-in production
  source is not instrumented. Specific timestamps separate TopoJSON conversion, geographic fit
  and SVG path generation. Interaction handler timings are synchronous work measured by
  `performance.now()`; the double-rAF measure is a **frame-quantized proxy, NOT field INP**.
- Five sequential Lighthouse 12.4.0 **laboratory** runs per device and revision use
  comparable emulation flags and a shared GitHub Actions Ubuntu 24.04 runner *within each job*.
  Distinct workflow runs are separate ephemeral runners; they are not paired CPU measurements.
  Each Lighthouse run retains its JSON artifact.
- A supplementary Playwright trace records load, TB comparison, threshold switching and
  country search independently from timed trials.
- No CrUX or other real-user field metrics are available in these runs. Lighthouse CLS
  and LCP are laboratory measurements; no field INP is reported.

Source experiment workflows:
- [Unmodified topology and baseline, five-run detailed profile](https://github.com/Pikirenia/tobacco_cessacion_map/actions/runs/40510308975)
- [Candidate preset-projection performance profile](https://github.com/Pikirenia/tobacco_cessacion_map/actions/runs/40510443228)
- [Functional, geographic and visual regression plus repeated performance](https://github.com/Pikirenia/tobacco_cessacion_map/actions/runs/40510793153)

The two source variants differ only in whether the map's Equal Earth projection calls
`fitExtent()` over the complete feature collection at load or uses the *exact numeric
scale and translation produced by that call*. Source topology and D3 projection are unchanged.

## 2. Bottlenecks found

The source includes a quantized TopoJSON world representation with **240 feature
geometries**, **1,959 arcs** and **80,617 arc vertices**. The retail-access dataset has
**195 countries**; not every geography is a study country, and one study country
without a topology polygon has a dedicated coordinate representation.

Topological conversion is comparatively fast (~10–11 ms in initial controlled trials).
Generating SVG geometry took ~90–97 ms in the initial profile; more detailed controlled
runs ranged from ~71–119 ms across runners. The original full-feature Equal Earth
`fitExtent()` pass repeatedly streams that same world geometry during initialization
although its source and SVG viewport have not changed.

All interactive layers share one set of SVG shapes. Existing layer switches, full-package
and medicine filters, threshold changes and legend selections already reuse the geometry,
so interaction work is relatively small (typical synchronous handlers ~1.5–5 ms).
Country search involves geometry bounds and zoom, often ~7 ms in the initial profile.
The project already throttles pointer movement with requestAnimationFrame.

The initial page also loads Public Sans from Google Fonts and pinned D3/TopoJSON scripts
from CDNs. All application data scripts use `defer`; CDN latency and font loading
may contribute to real-world variability, but the controlled CPU experiment deliberately
does not measure that uncertainty. GitHub Pages controls HTTP compression and static
asset caching. No third-party resource was added.

## 3. Adopted change

The map retains the existing unsimplified TopoJSON and dynamic D3 SVG path construction.
It replaces only the initial projection fit operation with:

`d3.geoEqualEarth().scale(185.280125196426).translate([500,282.0052039454597])`

These values are produced deterministically by
`node scripts/performance/derive-projection.cjs` using the complete original
topology and the existing 1000 × 520 viewport and [8, 8] padding.
The new browser regression test independently recomputes `fitExtent()` and requires
all 240 generated SVG `d` path strings to be **exactly equal**, with all 195 study
countries represented and dot coordinates agreeing within 1e-9 pixels. If the topology
is updated later, the test will fail until the projection preset is regenerated and reviewed.

The HTML map-script query version was advanced to `performance-pr5` so browsers can
fetch updated JavaScript when a future, separately approved release occurs.

### Direct CPU profile: 5 runs per viewport, median [min, max] in ms

| Operation | Before mobile | After mobile | Before desktop | After desktop |
|---|---:|---:|---:|---:|
| Full geometry fit | 53.4 [52.8, 56.9] | 0.4 [0.3, 0.5] | 54.0 [52.7, 57.0] | 0.3 [0.2, 0.5] |
| SVG path construction | 74.6 [71.5, 75.3] | 104.9 [97.0, 112.7] | 72.0 [70.9, 73.4] | 109.2 [100.5, 119.7] |
| Full measured initialization section | 183.6 [180.7, 189.9] | 178.8 [170.0, 191.1] | 184.3 [183.1, 185.0] | 187.7 [170.2, 197.0] |

**Interpretation:** eliminating the original fit pass produces a large, reproducible
reduction in *that operation*. The differing SVG and total initialization times
indicate runner variability. These experiments do not establish a robust
end-to-end initial-load improvement; none is claimed.

### Lighthouse local laboratory: 5 runs per device and revision

| Metric | Before mobile | After mobile | Before desktop | After desktop |
|---|---:|---:|---:|---:|
| Performance score, median (range) | 77 (58–79) | 80 (59–80) | 97 (97–97) | 97 (96–97) |
| LCP, median ms | 2450.28 | 2432.88 | 1177.43 | 1156.74 |
| LCP, range ms | 2447.82–6072.49 | 2429.75–5964.32 | 1147.23–1181.01 | 1074.53–1157.62 |
| Total Blocking Time, median ms | 675.5 | 616.0 | 78.82 | 105.18 |
| CLS, median | 0.02 | 0.02 | 0 | 0 |

Scores, LCP and TBT vary, especially the mobile LCP tail. The apparent mobile
score and TBT improvements are promising but not sufficiently controlled to claim
a causal page-level speedup. The desktop TBT median moved in the opposite direction.
The source-level fit optimization has low maintenance cost and is kept because it
eliminates measured redundant work with exact-fidelity safeguards.

Original PR 1 **production** Lighthouse values (desktop 97, mobile 79–83, mobile
CLS ~0.20) were from an older application revision, so they must not be treated
as a PR 5 before/after comparison. The figures above compare the current
post-PR4 source, before and after the preset projection.

## 4. Geographic fidelity and file sizes

- `data/world-topology.js` is **unchanged**, blob SHA
  `66d88d29c0810a453db3d98ebf1f78e49ed395c0` (742,414 source bytes).
  The original baseline observed approximately 246 KB transferred **once** from
  production; this was an HTTP-compressed transfer observation, not a universal
  compression ratio or a repeated PR5 network finding. Real transfer sizes depend
  on compression, cache and browser.
- Unmodified source geometry implies zero loss from quantization or simplification;
  polygon vertex counts, islands, arc topology, boundaries, IDs and study coverage
  remain byte-for-byte identical.
- Regenerated reference projection parameters match the fixed parameters; the
  browser compares every rendered SVG path and study-country dot coordinate.
- Existing geography viewbox, zoom/pan extent, mobile touch targets, screen-reader
  table, country search and restored native form controls are unchanged.
- Medicine source `data/map-data.js` and TB source `data/tb-data.js`
  were not modified, nor were CSV/XLSX scientific source data or the feedback form.

## 5. Regression evidence

The CI workflow invokes the new PR5 pixel-exact geometry and 195-country invariants,
existing country search / navigation and restored-control tests, and the PR4
visual snapshots across desktop widths, themes, medicines, TB and all three
comparison thresholds. The existing regular Site checks also run scientific-data
and browser regression tests. The PR branch does not update or recapture
historical screenshots.

The country availability classifications, full-package definition, TB cutoff
comparison, accessible table, mobile bottom sheet, feedback workflow and
state synchronization in `paint()` are not modified by this PR.
No automated axe or screenshot baseline was relaxed.

## 6. Considered and rejected

1. **Simplifying or requantizing geography.** Higher risk to small islands,
   shared international boundaries and hit testing; no acceptable measured
   fidelity-versus-compressed-transfer benefit was demonstrated. Unchanged.
2. **Replacing TopoJSON with precalculated SVG strings.** Might avoid geometric
   projection work, but would require a new generated asset, size/caching
   comparisons and maintenance tooling, plus independent preservation checks.
   The current measurements do not justify this expansion.
3. **Changing raw JS to a separate compressed/JSON geography asset.** GitHub Pages
   already serves HTTP-compressed content; a smaller raw file does not
   establish smaller transfers. Async JSON loading could reintroduce initial
   synchronization defects. Unchanged.
4. **Memoization/caching of country classifications.** Most relevant interactions
   already cost only a few milliseconds; the baseline supplies no strong
   evidence that additional caches or invalidation rules would improve user
   experience. Unchanged.
5. **Rewriting per-frame zoom stroke updates or hover handling.** Potential
   visual and mobile touch regressions without a demonstrated bottleneck.
   Unchanged.
6. **Self-hosting fonts, bundling D3, changing resource priority or adding a
   new frontend build system.** External network contribution is not isolated
   in these runs. Additional assets, dependencies and complexity lack adequate
   comparative evidence. Unchanged.

## 7. Reproduction and interpretation

Run `npm ci`, `bash scripts/baseline/install-deps.sh`,
`npx playwright install --with-deps chromium`, then start
`python3 tests/serve.py` and run:
- `node scripts/performance/profile.cjs` (five cold contexts/viewport,
  timings, resource requests, trace and JSON summary).
- `node scripts/performance/derive-projection.cjs` (canonical
  full-geometry fit and topology counts).
- `npx playwright test -c playwright.baseline.config.cjs tests/baseline/performance-pr5.spec.cjs tests/baseline/functional.spec.cjs tests/baseline/visual.spec.cjs`
  (geographic, functional and pixel-reference checks).

For the five-audit Lighthouse commands, see
`.github/workflows/pr5-performance.yml`. Results and raw JSON are in
GitHub Actions artifacts `pr5-performance-evidence`.

**Decision:** retain the exact-fit preset, whose direct computational benefit is
measured and whose geographic equality is explicitly tested. Retain all other
source geography, rendering mechanisms, data and user controls unchanged.
Do not release automatically. Do not start PR 6.
