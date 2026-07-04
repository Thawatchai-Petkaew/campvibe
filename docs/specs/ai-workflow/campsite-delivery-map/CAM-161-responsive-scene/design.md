# CAM-161 design notes — canvas-scale model + 2-layout switch

## Architecture: Fixed-canvas scale model

### The root cause of the proportion bug

The old approach (CAM-160) used `.map-stage` as both the background carrier and the character
container. Its size was computed as `max(100vw, 100vh * ar) * zoom` — a viewport-relative value.

Characters used `left/top` as % of `.map-stage`, making their *position* tied to `.map-stage`.
But their *size* was `--scout-size: clamp(88px, 7.2vw, 116px)` — viewport-relative, not stage-relative.

On a 16:9 screen: stage-width ≈ viewport-width → character size ≈ 7.2% of viewport ≈ 7.2% of stage-width. Proportional.
On a portrait screen: stage-width = 100vh * ar * zoom >> viewport-width → stage is wide, but
character size = 7.2% of the viewport (small). Characters appear tiny relative to the map.

### The fix: transform:scale() as the single scaling unit

The new model uses a **fixed 1920×1080 design canvas** scaled by a single `transform:scale(--s)`:

```
--s = max(calc(100vw / 1920), calc(100vh / 1080))   /* cover: picks larger scale */
```

This is the same cover formula as `background-size:cover`, applied to the canvas as a whole.
Because `--scout-size` is now a **fixed design-px value (104px)**, it scales with the transform:
`104px × --s = visually proportional` to the canvas on every screen shape.

### CSS structure

```css
.map-wrap { position:fixed; inset:0; overflow:hidden; background:#070d1c; z-index:5; }

/* Full-viewport background — decoupled from the canvas */
.map-bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
           z-index:0; pointer-events:none; display:block; }

/* Viewport grid — centres the fixed canvas */
.map-viewport { position:absolute; inset:0; overflow:hidden;
                display:grid; place-items:center; z-index:5; }

/* Fixed 1920×1080 design canvas, scaled as one unit */
.map-stage { position:relative; width:1920px; height:1080px;
             --s:max(calc(100vw / 1920), calc(100vh / 1080));
             transform:scale(var(--s)); transform-origin:center; }

/* Character layer — inset:0 of the 1920×1080 canvas */
.scout-layer { position:absolute; inset:0; z-index:30; }
```

### Why background is decoupled from the canvas

The background (`<img class="map-bg">`) is placed as a direct child of `.map-wrap`, NOT inside
`.map-viewport`/`.map-stage`. This decouples it from the character scaling:

- On 16:9: both bg cover and canvas cover ≈ 1:1 to viewport → characters align to the art
- On portrait: bg covers (atmosphere); characters use `LAYOUT_NARROW` (centre cluster)
- Story B will add `srcset` for hi-res (forest-1280/1920/2560/3840.webp)

### Scout size under narrow layout

Under `LAYOUT_NARROW` (portrait screens) the scale factor `--s` is large (~1.78 for 9:16).
A 104px design-canvas scout becomes `104 × 1.78 ≈ 185px` on screen — too large for a compact
cluster. The narrow media query overrides:

```css
@media (max-aspect-ratio: 7/5) {
  :root { --scout-size: 82px; }
}
```

82px × 1.78 ≈ 146px on screen. Starting value — the owner will fine-tune via screenshot.

## 2-layout table

### Threshold: `(min-aspect-ratio: 7/5)` = 1.4

- Wider than 7:5 → `LAYOUT_WIDE` (art-measured positions)
- Narrower than 7:5 → `LAYOUT_NARROW` (centre cluster)

7:5 was chosen as the threshold because:
- It sits between 16:9 (1.78) and 3:4 (0.75), catching tablets in portrait
- At exactly 7:5 the visible canvas band under cover is ≈ x 34–66%, exactly where `LAYOUT_NARROW` places all characters

### LAYOUT_WIDE — art-measured positions (% of 1920×1080 canvas)

| Role | Station (art) | x% | y% |
|---|---|---|---|
| You | dock/boat (top-left) | 41 | 26 |
| Architect | large tent (top-centre) | 55 | 30 |
| Designer | board (top-right) | 66 | 33 |
| Backend | right tent | 67 | 55 |
| Frontend | right table (bottom) | 60 | 68 |
| DevOps | left table (bottom) | 39 | 68 |
| QA | left-centre tent | 33 | 50 |
| Security | left tent (upper) | 35 | 40 |

These are starting values measured from the art. The owner must confirm alignment by screenshot
on the real staging URL before these are finalized.

### LAYOUT_NARROW — centre-band cluster (% of 1920×1080 canvas)

All 8 characters packed into x∈[38,62], y∈[25,61] — the visible band under 9:16 cover scaling.

| Role | x% | y% |
|---|---|---|
| You | 50 | 25 |
| Architect | 38 | 33 |
| Designer | 62 | 33 |
| Security | 50 | 40 |
| QA | 38 | 47 |
| Backend | 62 | 47 |
| DevOps | 38 | 61 |
| Frontend | 62 | 61 |

You sits top-centre; Security at the campfire centre; others in 2-column formation.
These are starting values — the owner will fine-tune via screenshot.

## Layout switch mechanism

1. `window.matchMedia("(min-aspect-ratio: 7/5)")` evaluated at mount.
2. `applyLayout(isWide)` called immediately + on `change` events.
3. `applyLayout` sets module-level `currentLayout` + `currentYouPos` + `YOU_POS`.
4. `setLayoutKey("wide"|"narrow")` triggers React re-render so `YouScout` + `homeStyle()` pick up new positions.
5. `engine.setHomes(layout)` called if engine is running — snaps idle agents, redirects walking agents. No teardown.
6. Under reduced-motion (engine not running): DOM writes applied directly to `rootEl` for each agent.

## HUD invariant

`ViewToggle`, `MapOverlays` are `position:fixed` siblings of `.map-wrap` — outside `.map-viewport`.
They never scale, never clip. Confirmed by the existing S7 tests which pass unchanged.
