# CAM-159 Test Plan — HUD Redesign

## Test approach

Source-inspection style (same as S1–S7 suite). Every AC row has at least one `describe/it` block that reads the file with `readFileSync` and asserts the structural change. No DOM rendering (Next.js client components; source inspection is the established pattern for this feature).

## Tests added to `__tests__/status-map.test.ts`

### AC1 — Single bottom dock

```
describe("campsite-overlays.tsx — CAM-159 AC1: single bottom command dock")
  - exports MapOverlays + ViewToggle
  - dock--hud-overview + dock--hud-epic testids present
  - role="toolbar" on dock
  - no CHIP_POSITIONS / "top-left" / "bottom-right" / "bottom-left" (old positions removed)
  - dock segments are <button aria-expanded>
  - hud-dock CSS: bottom:18px, translateX(-50%)
```

### AC2 — Expand panels

```
describe("campsite-overlays.tsx — CAM-159 AC2: expand panels")
  - role="dialog" aria-modal="true"
  - bottom:80px (above dock)
  - panelRise animation inside prefers-reduced-motion:no-preference
  - FOCUSABLE selector + Escape handler (focus trap)
```

### AC3 — Kanban modal

```
describe("campsite-overlays.tsx — CAM-159 AC3: Kanban modal")
  - hud-modal-box + hud-modal-backdrop
  - modalIn animation
  - 5 column names present
  - metric pill testids
  - empty state: ยังไม่มีสตอรีใน epic นี้
  - board testid: board--hud-{epicLabel}
```

### AC4 — Epic scope dock (no overlapping)

```
describe("campsite-overlays.tsx — CAM-159 AC4: Epic scope dock structure")
  - seg--hud-epic-progress testid
  - seg--hud-upnext testid
  - hud-board-btn + เปิดบอร์ด text
  - btn--scope-back-overview present
```

### AC5 — View toggle top-center

```
describe("campsite-overlays.tsx — CAM-159 AC5: ViewToggle top-center")
  - .hud-view-toggle CSS with top:18px and left:50%
  - nav[data-testid="nav--map-view-toggle"] with แดชบอร์ด and แผนที่
  - link--map-toggle-dashboard + tab--map-toggle-map testids
```

### AC6 — setScope non-blank fix (scene)

```
describe("campsite-scene.tsx — CAM-159 AC6: setScope non-blank fix")
  - roles.length > 0 guard present
  - engine.setScope("all", []) fallback present
  - CAM-159 Epic bug fix comment present
  - activeEpicData fallback guard: activeEpic ? (epics.find...
```

### AC7 — Reduced-motion compliance

```
describe("campsite-overlays.tsx — CAM-159 AC7: reduced-motion compliance")
  - panelRise + modalIn + bdFade inside prefers-reduced-motion:no-preference
  - .hud-prog-fill present (transition also gated)
```

### ViewToggle in scene

```
describe("campsite-scene.tsx — CAM-159: ViewToggle integrated top-center")
  - ViewToggle imported from campsite-overlays
  - <ViewToggle dashboardHref= rendered
  - old top:70/left:16 corner style NOT present
```

## Manual verification (browser-only)

- [ ] Overview dock visible at bottom-center on desktop (≥960px) and mobile (scrollable)
- [ ] Each segment opens its panel above the dock; panel closes on Esc/click-outside/close button
- [ ] Gates count amber when >0, green when 0
- [ ] `เปิดบอร์ด` opens centered Kanban modal with correct data
- [ ] Epic scope: no overlapping surfaces; scene shows agents (not blank)
- [ ] prefers-reduced-motion: reduce — panels appear instantly, no animation
- [ ] View toggle appears top-center (not top-left)
- [ ] Tab order: You → agents → dock segments → open panel/modal
- [ ] Axe (browser) — 0 violations on dock + panels + modal
