## Tech

CAM-165 — Portrait centering fix + coordinate tune

### Root cause: duplicate .map-wrap

Two separate `<style>` blocks inject a `.map-wrap` rule into the page:

1. `campsite-assets.ts` CSS (injected by the server component in `page.tsx` as a `<style>` tag
   in the initial HTML):
   ```css
   .map-wrap { position:relative; z-index:5; min-height:100vh;
               display:flex; align-items:center; justify-content:center; padding:24px }
   ```
   This is a leftover from before CAM-161 — it was the centering wrapper used when the scene
   was a simple flex card rather than a fixed-canvas viewport.

2. `campsite-scene.tsx` `SCENE_CSS` (injected by the dynamic `ssr:false` component, which
   loads after the page HTML is painted):
   ```css
   .map-wrap { position:fixed; inset:0; overflow:hidden; background:#070d1c; z-index:5; }
   ```
   This is the correct rule from the CAM-161 fixed-canvas redesign.

**Why it broke portrait centering:** The `campsite-assets.ts` CSS arrives in the server HTML and
is applied first. Before the dynamic scene loads, `.map-wrap` has `position:relative` + `padding:24px`.
Even after the scene injects its `position:fixed` rule, CSS specificity resolves to the last
declaration for equal-specificity single-class rules — but the load-order race means the two
`<style>` blocks can interfere depending on browser rendering order. The old `padding:24px` and
`display:flex` shift the stacking context for `.map-bg` (`position:absolute;inset:0`) so the
background cover origin drifts from the character canvas cover origin on portrait viewports, where
the cover scale factor is large (~1.78x). The campfire art at ~x50% of the forest image appeared
at grid x≈30 because the viewport center was offset by the old padding.

### Fix 1: remove OLD .map-wrap from campsite-assets.ts

Deleted the `.map-wrap` rule entirely from the `CSS` template string in `campsite-assets.ts`.
The gate box and error state in `page.tsx` do NOT depend on `.map-wrap`:
- Gate box: uses `.gatebox` (self-contained: own margin/position).
- Error state: uses inline styles (`position:relative; zIndex:5; minHeight:100vh; display:flex; alignItems:center; justifyContent:center`) in `page.tsx` — never used `.map-wrap`.

After this change, `.map-wrap{position:fixed;inset:0}` from `SCENE_CSS` is the ONLY rule that
applies to the `.map-wrap` element, eliminating the conflict.

### Fix 2: LAYOUT_WIDE grid-read coordinate tune

Updated `LAYOUT_WIDE` in `campsite-scene.tsx` to values read from the `?grid=1` coordinate
overlay on the real campsite image. Characters are now on furniture:

| Role | Old x | Old y | New x | New y | Location |
|---|---|---|---|---|---|
| You | 38 | 24 | 38 | 24 | Upper-left dock (unchanged) |
| Architect | 50 | 32 | 49 | 33 | Camp center board |
| Designer | 66 | 33 | 65 | 35 | Tent area NE |
| Backend | 73 | 52 | 76 | 52 | Right tables (pulled in from tree-edge) |
| Security | 28 | 42 | 33 | 42 | Left clearing (pulled in from left margin) |
| QA | 27 | 55 | 34 | 54 | Left-center area |
| DevOps | 35 | 72 | 39 | 68 | Lower-left table |
| Frontend | 63 | 72 | 61 | 68 | Lower-right table |

### Fix 3: LAYOUT_NARROW tightened to x42/x58

The visible canvas x-range on a 9:16 portrait screen under cover scaling is approximately
34%–66% (derived: `50 ± 50 × vw / (1920 × vh/1080)` = `50 ± 15.8%`). The old x60 column
sat at the boundary (65.82%). Tightening to x58 adds ~2% safety margin so portrait characters
remain fully visible even on narrower-than-9:16 screens:

| Role | Old x | New x | y | Notes |
|---|---|---|---|---|
| Architect | 40 | 42 | 34 | Left column |
| Designer | 60 | 58 | 34 | Right column |
| Backend | 60 | 58 | 50 | Right column |
| Frontend | 60 | 58 | 64 | Right column |
| DevOps | 40 | 42 | 64 | Left column |
| QA | 40 | 42 | 50 | Left column |
| Security | 50 | 50 | 42 | Center (unchanged) |
| You | 50 | 50 | 22 | Top center (unchanged) |

You + Security remain at x50 (center). Symmetric 2-column layout: x42 (left) / x58 (right).

### Files changed

- `app/status/map/campsite-assets.ts` — removed leftover `.map-wrap` rule (line 21)
- `app/status/map/campsite-scene.tsx` — updated LAYOUT_WIDE coords + LAYOUT_NARROW tightened
- `__tests__/status-map.test.ts` — updated LAYOUT_NARROW assertion + added CAM-165 test suite
- `docs/delivery/ai-workflow/campsite-delivery-map/CAM-165-portrait-center-tune/` — this dir
