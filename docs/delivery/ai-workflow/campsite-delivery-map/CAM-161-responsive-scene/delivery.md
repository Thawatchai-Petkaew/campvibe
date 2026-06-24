# CAM-161 delivery notes — responsive scene: fixed-canvas scale + 2-layout switch

## Files changed

- `app/status/map/campsite-scene.tsx` — new CSS model (`.map-viewport`/`.map-bg`/`.map-stage`
  as fixed canvas + `transform:scale`), `LAYOUT_WIDE`/`LAYOUT_NARROW` tables, `YOU_POS_WIDE`/
  `YOU_POS_NARROW`, `matchMedia` aspect-ratio listener, `setLayoutKey` state, `homeStyle()` reads
  from `currentLayout`, `YouScout` takes `youPos` prop, `<img class="map-bg">` added.
- `app/status/map/campsite-engine.ts` — `EngineHandle` adds `setHomes()` method; implementation
  snaps idle scouts and redirects walking scouts. Loop logic unchanged.
- `__tests__/status-map.test.ts` — 18 new source-inspection assertions for CAM-161 (3 describe blocks).
- `docs/delivery/ai-workflow/campsite-delivery-map/CAM-161-responsive-scene/` — this artifact set.

## Key technique: fixed-canvas scale + decoupled background

### Old approach (CAM-160)
```
.map-wrap (fixed, inset:0)
  .map-stage (position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
              width:max(vw, vh*ar)*zoom; height:max(vh, vw/ar)*zoom;
              background:url(forest.webp) cover)
    .scout-layer (position:absolute, inset:0)
      [characters with --scout-size: clamp(88px,7.2vw,116px)]
```

Problem: character size (7.2vw) and character position (% of stage) scale independently on
non-16:9 screens. Stage grows proportionally to viewport but character size stays viewport-small.

### New approach (CAM-161)
```
.map-wrap (position:fixed; inset:0)
  .map-bg (position:absolute; inset:0; object-fit:cover)       ← background, not scaled
  .map-viewport (position:absolute; inset:0; display:grid; place-items:center)
    .map-stage (width:1920px; height:1080px;                   ← fixed design canvas
                transform:scale(max(vw/1920, vh/1080)))        ← scales canvas + chars together
      .scout-layer (position:absolute; inset:0)
        [characters with --scout-size: 104px]                  ← fixed design-px, scales with canvas
  ViewToggle (position:fixed)                                   ← HUD: never scales
  MapOverlays (position:fixed)                                  ← HUD: never scales
```

Result: characters + canvas scale as one unit. Background covers independently (atmosphere on portrait).

### Cover formula
```
--s: max(calc(100vw / 1920), calc(100vh / 1080))
```
- 16:9 (1920×1080): `--s` = max(1, 1) = 1 → canvas fills viewport exactly
- 4K (3840×2160): `--s` = max(2, 2) = 2 → canvas fills at 2× (all elements visually 2× bigger, proportional)
- Portrait 9:16 (1080×1920): `--s` = max(0.5625, 1.78) = 1.78 → height drives scale, canvas is 1.78× design size
- Portrait 3:4 (1080×1440): `--s` = max(0.5625, 1.33) = 1.33

## 2-layout switch

| Layout | Aspect ratio condition | Characters |
|---|---|---|
| `LAYOUT_WIDE` | `min-aspect-ratio: 7/5` (≥ 1.4) | Art-measured positions on dock/tents/tables |
| `LAYOUT_NARROW` | `max-aspect-ratio: 7/5` (< 1.4) | Centre-band cluster x∈[38,62], y∈[25,61] |

Switch mechanism: `matchMedia("(min-aspect-ratio: 7/5)")` with `change` listener.
On change: update module vars → `setLayoutKey()` → React re-render → `engine.setHomes()`.
Engine rAF loop keeps running (no remount, no teardown, no flash).

## Narrow scout-size override

Under portrait scaling `--s ≈ 1.78`, a 104px design scout → 185px on screen.
Override: `@media (max-aspect-ratio: 7/5) { :root { --scout-size: 82px; } }`
82px × 1.78 ≈ 146px — compact enough for the 2-column cluster. Visual judgement, owner-tunable.

## Self-verify results

- `npm run lint` — 0 errors (226 pre-existing warnings, unchanged from CAM-160 baseline)
- `npm run typecheck` — clean (0 errors)
- `npm test` — 42 test files, 2360 tests, all passed (18 new, 2342 pre-existing)
- `npm run build` — compiled successfully; `/status/map` still Dynamic (server-rendered)
- `npm run check:palette` — PASS (0 violations)

## CWV scorecard

| Metric | Value | Notes |
|---|---|---|
| LCP | not measured | `<img class="map-bg">` is now the LCP candidate (was CSS background-image on .map-stage). Potential improvement: add `fetchpriority="high"` to the img. Story B (srcset) will address this. |
| CLS | not measured | `.map-stage` has fixed px dimensions + `transform-origin:center` — no layout shift risk. The grid `.map-viewport` has `overflow:hidden` to clip any overflow. |
| INP | not measured | No new JS interaction added. `matchMedia` listener is a passive listener (no paint-blocking work). |

Potential regression risk: the `<img class="map-bg">` is not in `<head>` as a preload `<link>`.
The `#070d1c` fallback on `.map-wrap` prevents a white flash while the WebP loads.
Add `fetchpriority="high"` to the `<img>` tag when Story B (srcset) is implemented.

## Screenshot-tuning caveats (owner must verify on staging)

1. `LAYOUT_WIDE` positions are estimated from the art description. The owner must screenshot at
   1920×1080 and confirm each character sits on its named station (dock, tent, board, table).
   Expected adjustment: ±3–5% per character.

2. `LAYOUT_NARROW` positions are a starting 2-column arrangement. The owner must screenshot on
   a 9:16 portrait device (iPhone or similar) to confirm all 8 characters are visible, not
   overlapping, and readable.

3. `--scout-size: 82px` for narrow layout may need adjustment. If characters appear too large
   (overlapping) or too small (hard to read), edit the `@media (max-aspect-ratio: 7/5)` block.

4. The 7/5 threshold may need adjusting for specific device classes (e.g. if 4:3 iPad in portrait
   should use wide layout). The threshold is a single string change in the `matchMedia` call.

These are all visual judgments that cannot be resolved without a real browser screenshot.
They are intentionally documented as owner-to-confirm rather than estimated as "done".
