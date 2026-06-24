# CAM-161 test notes

## Test strategy

Source-inspection tests (Vitest, same style as `status-map.test.ts`) assert:
- The new CSS structure is present and the old structure is absent
- Layout tables and threshold are wired correctly
- `setHomes` is declared and implemented in the engine
- All existing S7/A11y/CAM-152/CAM-159 assertions continue to pass

No browser/Playwright tests: the layout switch is a visual judgment confirmed by owner screenshot.
The engine mechanics (rAF loop, BFS walk) were not changed — their existing passing tests cover the contract.

## New tests added (`__tests__/status-map.test.ts`)

### `campsite-scene.tsx — CAM-161: fixed-canvas scale model` (8 assertions)

| Assertion | What it proves |
|---|---|
| `.map-viewport` has `display:grid` + `place-items:center` | Viewport grid exists |
| `width:1920px` + `height:1080px` on `.map-stage` | Fixed design canvas |
| `transform:scale(var(--s))` + `calc(100vw / 1920)` + `calc(100vh / 1080)` | Cover formula wired |
| `--scout-size: 104px` present; `7.2vw` absent | Fixed design-px scout size |
| `width:calc(max(100vw` absent | Old max-width approach removed |
| `.map-bg` + `object-fit:cover` + `campsite-forest.webp` | Background image element present |
| `className="map-bg"` + `aria-hidden="true"` | Img element (not CSS) with correct a11y |
| `background:url("/status-map/campsite-forest.webp")` absent from `.map-stage` | Stage is no longer the bg carrier |

### `campsite-scene.tsx — CAM-161: LAYOUT_WIDE + LAYOUT_NARROW` (8 assertions)

| Assertion | What it proves |
|---|---|
| `LAYOUT_WIDE` present | Wide art-position table exported |
| `LAYOUT_NARROW` present | Narrow cluster table exported |
| `YOU_POS_WIDE` + `YOU_POS_NARROW` present | Separate You positions per layout |
| `min-aspect-ratio: 7/5` in source | Correct MQ threshold |
| `setLayoutKey` + `arMq.addEventListener` | Listener wired without remount |
| `engine.setHomes` called | Engine updated on layout switch |
| `currentLayout[role]` in `homeStyle()` | Reads from layout table, not NODES |
| `youPos={youPos}` + `youPos: { x: number; y: number }` | YouScout prop typed and passed |

### `campsite-engine.ts — CAM-161: setHomes` (2 assertions)

| Assertion | What it proves |
|---|---|
| `setHomes` + `Record<string, { x: number; y: number }>` in interface | Interface declares the method |
| `setHomes(homes:` + `s.mode === "idle"` in implementation | Implementation handles idle snap |

## Tests unchanged and still passing

All 2342 pre-existing tests (as of CAM-160) continue to pass — 2360 total with the 18 new assertions.

Key existing tests that remain valid:
- `role="img"` + `sceneAriaLabel` on `.map-stage` — unchanged (`.map-stage` still has role="img")
- Reduced-motion: `prefers-reduced-motion` + `rm-label*` — CSS kept intact
- S7 keyboard: `type="button"` + `btn--map-agent-you` + `data-testid` — unchanged
- CAM-159 HUD dock: `hud-dock`, `bottom:18px`, `translateX(-50%)` — overlays untouched
- ViewToggle: `.hud-view-toggle`, `top:18px` — untouched

## Visual confirmation required (owner, post-merge)

These cannot be asserted in source-inspection tests:

1. On 1920×1080 and 4K: each character aligns to its art station (dock, tent, board, table).
2. On portrait 9:16 phone: all 8 characters visible in the centre band, no overlap, readable size.
3. On tablet portrait (3:4 ≈ 0.75 < 1.4 threshold): LAYOUT_NARROW cluster centered.
4. HUD dock (bottom-center) always visible, unscaled, on all screen sizes.
5. No character clips outside the viewport on any tested resolution.

The owner provides screenshots at the 4 sizes specified in the verify section of the plan.
Coordinate and `--scout-size` fine-tuning is expected in a second-pass iteration.
