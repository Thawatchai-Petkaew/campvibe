## Story

CAM-165 — Portrait centering fix + coordinate tune

**Version:** 1.0.0
**Status:** Done

## Why

After CAM-164 introduced the `?grid=1` tool and rebalanced coordinates, two issues remained
visible in portrait screenshots:

1. The background campfire art (visual landmark at ~x50% of the forest image) appeared at
   grid x≈30 on a portrait screen, while the Designer/Backend/Frontend characters (the x60
   column) were clipped past the right edge.
2. The wide-layout characters sat on empty terrain rather than on the dock, tent areas, and
   tables — the grid-based tuning from dark screenshots was imprecise.

Root cause: TWO conflicting `.map-wrap` rules were injected into the page:
- `campsite-assets.ts` (server HTML, renders first): `.map-wrap{position:relative; display:flex; ...padding:24px}` — leftover from before the CAM-161 redesign.
- `campsite-scene.tsx` SCENE_CSS (dynamic `ssr:false`, injects after): `.map-wrap{position:fixed;inset:0}`.

Because `campsite-scene.tsx` is lazy-loaded (`ssr:false`), the OLD rule from `campsite-assets.ts`
applied for the first render and interfered with the fixed-canvas centering. The background image
(`position:absolute;inset:0` inside `.map-wrap`) and the viewport grid (also inside `.map-wrap`)
competed with the old relative positioning and padding, breaking the alignment between the
background campfire landmark and the character canvas on portrait viewports.

## AC

| # | Given | When | Result |
|---|---|---|---|
| AC-1 | Portrait viewport (aspect < 7:5) | Page loads | Only ONE `.map-wrap` rule applies to the scene (position:fixed;inset:0); canvas and background center identically on the same viewport |
| AC-2 | Portrait viewport | Page loads | Campfire landmark and character canvas are aligned (same centering origin); no characters clipped off-screen |
| AC-3 | Wide viewport | Page loads | Characters sit on furniture (dock, tents, tables); Backend pulled in from right tree-edge; Security/QA pulled in from left margin |
| AC-4 | Gate/error states | Token missing or Linear fetch fails | Gate box (.gatebox) and error placeholder (.map-placeholder) still render correctly; their CSS is unchanged |

## Out of scope

- Pixel-perfect per-device tuning beyond the grid-read values supplied
- Any engine, overlay, HUD, or animation behavior changes
