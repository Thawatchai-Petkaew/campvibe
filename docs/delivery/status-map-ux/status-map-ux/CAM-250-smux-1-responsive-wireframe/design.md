---
linear: CAM-250
feature: status-map-ux
epic: status-map-ux
persona: platform
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-06-28
---
# Design — /status/map Responsive Wireframe (CAM-250 SMUX-1)

## Flow

User path (from AC):

1. Owner opens `/status/map` on any device.
2. **Desktop ≥1024:** three panels visible simultaneously — FilterSignposts (top, 3 dropdowns), Team Roster (left side panel), StatusBoard (right side panel, visible when filter active). Bottom dock for summary + gates. No change from today.
3. **Tablet 640–1023:** map fills full width. FilterSignposts collapses to a single "กรอง ▾" compact chip. Roster and Board are hidden; their tab affordances appear as edge strips on left and right. Tap left strip → Roster Sheet opens from left. Tap right strip → Board Sheet opens from right. Esc or backdrop tap closes.
4. **Mobile <640:** map fills 100vw/100svh. Filter = minimal chip top-right. Bottom toolbar: `≡ ทีม` (left) · stats centre · `Board ▸` (right). Tap either toolbar button → Sheet side=bottom slides up from the bottom (one sheet at a time). Drag handle down or Esc closes. Map is always visible (dimmed behind open sheet).

---

## States (8) — per interactive element

| Element | default | hover | focus | active | loading | error | empty | disabled |
|---|---|---|---|---|---|---|---|---|
| Agent sprite (map) | ring faint, aura glow | ring brightens, speech bubble | `outline: 2px solid #5BE9B0` | scale-down + pulse | — | — | opacity .35, pointer-events:none | `aria-disabled`, opacity .35 |
| Toolbar button (mobile) | glass chip, muted text | bg `rgba(255,255,255,.07)` | `outline: 2px solid rgba(91,233,176,.8)` | `scale(.96)` | spinner inside | — | — | opacity .45, cursor:not-allowed |
| Edge-drawer tab (tablet) | glass strip, muted label | bg `rgba(255,255,255,.06)` | outline teal | bg `rgba(91,233,176,.12)` | — | — | — | — |
| Sheet close button | `rgba(255,255,255,.08)`, `44×44px` | bg `rgba(255,255,255,.14)` | outline teal | `scale(.94)` | — | — | — | — |
| Board kanban card | bg `rgba(255,255,255,.07)`, left-border | bg `rgba(255,255,255,.11)` | outline teal | — | skeleton row | error text in sheet | empty state text | — |
| Roster row | bg `rgba(255,255,255,.05)` | bg `rgba(255,255,255,.09)` | outline teal | — | skeleton row | — | "ว่าง" label | — |
| Compact filter chip | glass, muted text | bg lightens | outline teal | bg `rgba(91,233,176,.12)`, text teal | — | — | — | — |
| Sheet backdrop | `rgba(0,0,0,.45)` | — | — | — | — | — | — | — |

Empty states:
- Board: no epic selected → "เลือก Feature หรือ Epic เพื่อดู Board" (centred text, muted, teal icon `Layers`)
- Roster: no agents data → "ยังไม่มีข้อมูลทีม" (centred, muted)

---

## Layout Decision per Breakpoint

### Desktop ≥ 1024px (unchanged)

- FilterSignposts: 3 separate dropdown chips top-bar (`position:fixed; top:0; left:0; right:0`)
- Team Roster: left side panel `position:fixed; top:80px; left:18px`, width ~130px
- StatusBoard: right side panel `position:fixed; top:80px; right:18px`, width ~180px, visible when `showBoard === true`
- Bottom dock: `position:fixed; bottom:18px; left:50%; transform:translateX(-50%)` (unchanged)
- Agent ring: LAYOUT_WIDE (wide oval, agents spaced evenly on landscape oval)
- Map canvas: fills full screen behind all panels

### Tablet 640–1023px (new — drawers)

- FilterSignposts: collapses to a single `hud-chip` "กรอง ▾" that opens a compact popover with the 3 filters stacked
- Team Roster: hidden. Left edge tab (32px wide strip, glass, label "≡ Roster" vertical text). Tap → `<Sheet side="left">` opens. Swipe left or Esc closes.
- StatusBoard: hidden. Right edge tab (32px wide strip, glass, label "Board ▸" vertical text). Tap → `<Sheet side="right">` opens. Swipe right or Esc closes.
- Bottom dock: slimmed to 2–3 segments (summary numbers only, no persona/feature labels). Stays `position:fixed; bottom:18px`.
- Agent ring: LAYOUT_WIDE (same as desktop — no side panels competing for space, ring has full width)

### Mobile < 640px (new — bottom-sheets)

- FilterSignposts: minimal chip `position:fixed; top:10px; right:10px; z-index:23`. Tap → compact dropdown Sheet or popover.
- Team Roster: removed from fixed position. Accessible via bottom toolbar "ทีม" button → `<Sheet side="bottom">` with full roster list.
- StatusBoard: removed from fixed position. Accessible via bottom toolbar "Board ▸" button → `<Sheet side="bottom">` with full kanban.
- Bottom toolbar: `position:fixed; bottom:0; left:0; right:0; z-index:25`. Height 52px (inside `--pad-y: 140px`). Glass panel: `rgba(11,30,24,.70)`. Three zones: `≡ ทีม` button (left) · stats (centre) · `Board ▸` button (right). Buttons: min-height 44px, min-width 44px, `border-radius:999px`.
- Agent ring: LAYOUT_NARROW — portrait-optimised oval. See §Narrow Ring below.

---

## Narrow Agent Ring (LAYOUT_NARROW)

**Problem:** `LAYOUT_NARROW` at `campsite-scene.tsx:159` is currently `= LAYOUT_WIDE` (alias). On portrait mobile the cover-scale is large (~1.5×), compressing the landscape oval horizontally so agents drift toward the campfire and labels overlap.

**Solution:** Replace `LAYOUT_NARROW` with a genuine portrait-optimised oval. The oval's x-axis contracts by ~35% and y-axis expands by ~40% relative to wide, keeping all 7 agents evenly spaced and the campfire gap ≥ 30px at all scales.

Proposed `LAYOUT_NARROW` coordinates (percent of 1920×1080 canvas — same coordinate system as `LAYOUT_WIDE`):

```ts
export const LAYOUT_NARROW: Record<string, { x: number; y: number }> = {
  "architect":          { x: 50.0, y: 31.0 },  // top
  "ux-designer":        { x: 61.8, y: 37.5 },  // upper-right
  "backend-engineer":   { x: 67.2, y: 52.5 },  // right
  "frontend-engineer":  { x: 60.5, y: 67.0 },  // lower-right
  "devops-release":     { x: 40.5, y: 67.0 },  // lower-left (symmetric with FE)
  "qa-engineer":        { x: 33.8, y: 52.5 },  // left (symmetric with BE)
  "security-reviewer":  { x: 39.2, y: 37.5 },  // upper-left (symmetric with UX)
};
export const YOU_POS_NARROW = { x: 38, y: 27 };
```

The `matchMedia` listener at `:1244` and the existing layout-switch machinery at `:1356–1399` remain untouched. Trigger: `max-width: 639px` (already present or add if missing).

Invariant: no agent coordinate places a sprite within 30% of the campfire centre (`50.1, 52.0`). The minimum gap at LAYOUT_NARROW is ~18% (backend-engineer at 52.5 vs campfire at 52.0 — horizontal offset 17%). This is sufficient given `--scout-size` ≤ 96px on a 1920px canvas = ~5% of canvas width.

---

## Components Used

All from `components/ui/*` (system only). No new components invented.

| Component | Source | Use |
|---|---|---|
| `Sheet` | `components/ui/sheet.tsx` | Roster (bottom/left) + Board (bottom/right) drawer |
| `Button` | `components/ui/button.tsx` | Toolbar buttons (mobile), close button in Sheet header |
| `ScrollArea` | `components/ui/scroll-area.tsx` | Kanban horizontal scroll inside Board Sheet |
| `Badge` | `components/ui/badge.tsx` | Agent status badge inside Roster Sheet rows |
| `Skeleton` | `components/ui/skeleton.tsx` | Roster/Board rows while data loads |
| `Tabs` | (not used — kanban columns are divs, not tabs) | — |

Icon shapes: **lucide-react only** (DS-5 complete). Used:
- `AlignJustify` (roster/menu button)
- `ChevronUp` (board button)
- `X` (sheet close)
- `Layers` (board empty state)
- `Users` (roster empty state)
- `BellRing` (already imported in `campsite-overlays.tsx:32`)

---

## Tokens Referenced

The scene is intentionally immune to the global `.dark` class. All scene surface colours are defined inside `SCENE_CSS` (`campsite-scene.tsx`) and the `dangerouslySetInnerHTML` block (`page.tsx`). They are not global design tokens and are exempt from `check:palette` (the guard excludes `app/status/**`).

The **shadcn Sheet** component is mounted outside the scene CSS block (React portal via `createPortal` or next to the scene in the DOM). It uses global tokens:

| Token | Tailwind class | Use in Sheet |
|---|---|---|
| `--background` | `bg-background` | Sheet panel background |
| `--card` | `bg-card` | Sheet inner surface |
| `--foreground` | `text-foreground` | Sheet title, list items |
| `--border` | `border-border` | Sheet top border |
| `--muted` | `bg-muted` | Skeleton rows |
| `--muted-foreground` | `text-muted-foreground` | Secondary text |
| `--primary` | `text-primary` | Active state, status indicator |

Scene-internal values (inside SCENE_CSS — not global tokens):

| Value | Role |
|---|---|
| `#070d1c` | Night sky background |
| `rgba(11,30,24,.55–.70)` | Glass panel surfaces |
| `rgba(150,240,195,.14)` | Glass border |
| `rgba(91,233,176,.40)` | Active/focus border |
| `#5BE9B0` | Agent active aura, teal-glow text |
| `#FFB454` | Agent busy/gate aura, amber text |
| `#F1F6FB` | On-dark primary text |

New tokens needed: **none**. No `DESIGN.md` or `globals.css` changes required.

---

## A11y Contract (WCAG 2.1 AA)

### Focus and keyboard

- Sheet `role="dialog"` + `aria-modal="true"` + `aria-labelledby` pointing to sheet title.
- Focus moves to Sheet on open (first interactive child). Tab cycles within Sheet. Esc closes Sheet and returns focus to the trigger button.
- Toolbar buttons: `aria-haspopup="dialog"` + `aria-expanded={isOpen}` + `aria-controls={sheetId}`.
- Agent sprites: `role="button"` + `tabIndex={0}` + `aria-label` = "Role · Task title" or "Role · ว่าง" + `onKeyDown` for Enter/Space.
- Edge drawer tabs (tablet): `role="button"` + `aria-label="เปิด Roster"` / `"เปิด Board"`.

### Tap targets

- Toolbar buttons: `min-height:44px; min-width:44px` enforced via Tailwind `h-11 w-11` (or `h-11 px-4`).
- Sheet close button: `h-11 w-11` (matches existing `modal-shell.tsx` pattern).
- Agent sprites: `--scout-size: clamp(44px, 9cqmin, 96px)` already set in SCENE_CSS — minimum clamped at 44px. No change needed.
- Edge drawer tabs: `min-height:80px` (tall enough for a vertical tab affordance), `min-width:32px` (acceptable — this is a drag-target, not a primary CTA; primary interaction is the toolbar button on mobile).

### Contrast

- `#5BE9B0` on `rgba(11,30,24,.70)`: approximately 7.2:1 — AA pass. (measured by eye against approximate effective bg `#070d1c`; label as measured-approximately — Frontend must verify with axe.)
- `#F1F6FB` on glass `rgba(11,30,24,.70)`: approximately 11:1 — AA pass.
- `rgba(223,234,245,.65)` muted night text: **not measured** — Frontend must verify with axe DevTools on the deployed Staging URL.
- Sheet text uses global `--foreground` over `--background`: meets AA by design-system guarantee.

### Color not the only signal

- Agent status: colour (dot) paired with text label (role name, task title in Roster Sheet).
- Board cards: left-border colour paired with column header text ("In Progress", "Done", etc.).
- Toolbar "Board ▸" button: `aria-expanded` state change + chevron direction flip.

### Screen reader

- Scene root has existing `role="img"` + `aria-label` summary (from S7 hardening).
- Roster Sheet has `role="status"` region for live loading state.
- Decorative agent aura/glow rings: `aria-hidden="true"`.

### Reduced motion

- Sheet slide animation: wrapped in `@media (prefers-reduced-motion: no-preference)`. Under `reduce`, sheet appears/disappears without transition (instant). The sheet content is still reachable.
- All existing scene animations (agent sway, campfire, trail) are already wrapped in `prefers-reduced-motion:no-preference` inside SCENE_CSS — no change needed.

---

## CSS / Implementation Notes (for SMUX-2 Frontend)

### Where to add responsive CSS

1. `SCENE_CSS` (constant in `campsite-scene.tsx`, around line 196) — add `@media (max-width:1023px)` and `@media (max-width:639px)` blocks for HUD layout changes (hide/show side panels, hide/show toolbar).
2. `page.tsx` `dangerouslySetInnerHTML` CSS block — if any page-level responsive rules are needed.
3. Do NOT add responsive rules to `app/globals.css` for scene-specific behaviour.

### Bottom toolbar

The bottom toolbar is a fixed-position React element rendered inside `CampsiteScene` (or `campsite-overlays.tsx`), NOT inside the `.map-stage` canvas div. It floats above the scene (z-index ~25, above dock at 40). On desktop/tablet, it is `display:none` via the media query. On mobile, it is visible and takes 52px of the bottom safe area. This sits within `--pad-y:140px` (the existing canvas bottom clearance), so the agent ring has no overlap.

### Sheet mounting

Use shadcn `Sheet` with `createPortal` to mount outside the `.map-wrap` stacking context if needed, or mount inside `CampsiteScene` component body (React appends to the DOM root). Either pattern keeps the Sheet outside the `.map-stage` transform and avoids the `position:fixed` child-of-transformed-ancestor bug.

### Breakpoint trigger for LAYOUT_NARROW

The existing `matchMedia` listener in `campsite-scene.tsx` (:1244, :1356–1399) watches for portrait/landscape changes. For LAYOUT_NARROW on mobile (<640px) the trigger should be `(max-width: 639px)`, not `(orientation: portrait)` — a phone in landscape should still use NARROW (it is very small). Update the listener condition accordingly.

### One-at-a-time sheet constraint

Maintain `const [openSheet, setOpenSheet] = useState<'roster'|'board'|null>(null)`. Opening one closes the other automatically. Pass this state to both Sheet components.

---

## Copy (locales)

New keys needed in `locales/translations.ts` (TH/EN):

| Key | TH | EN |
|---|---|---|
| `map.toolbar.roster` | `ทีม` | `Team` |
| `map.toolbar.board` | `Board` | `Board` |
| `map.toolbar.filter` | `กรอง` | `Filter` |
| `map.sheet.roster.title` | `ทีมงาน` | `Team` |
| `map.sheet.board.title` | `Board` | `Board` |
| `map.sheet.board.empty` | `เลือก Feature หรือ Epic เพื่อดู Board` | `Select a Feature or Epic to view the Board` |
| `map.sheet.roster.empty` | `ยังไม่มีข้อมูลทีม` | `No team data` |
| `map.sheet.roster.idle` | `ว่าง` | `Idle` |
| `map.sheet.close` | `ปิด` | `Close` |
| `map.filter.label` | `กรอง` | `Filter` |
| `map.filter.all_personas` | `ผู้ใช้งานทั้งหมด` | `All personas` |
| `map.filter.all_features` | `ทุก Feature` | `All features` |
| `map.filter.all_epics` | `ทุก Epic` | `All epics` |

Rules:
- No em-dash as separator (none used above).
- No technical jargon in user copy ("Feature" and "Epic" are project-level terms acceptable here as they appear on the current FilterSignposts UI).
- Tablet/desktop labels may use the existing Thai in FilterSignposts — only the new toolbar + sheet labels need new keys.

---

## Error Pattern

Per `components/ui/form-patterns.md`:
- Sheet content load error: `ErrorBanner` at the top of the sheet body (not a modal overlay).
- Transient sync error (filter/board update): `toast` (sonner) — non-blocking.
- No form submit on this page; no inline-below-field errors needed.

---

## Anti-slop Audit (self-check before handoff)

| Check | Status |
|---|---|
| No floating hex in Sheet component (uses global tokens) | Pass |
| No gradient on toolbar / sheet backgrounds | Pass (glass only) |
| No cards nested in cards for no reason | Pass (Roster rows are simple flex rows, not Card components) |
| Clear hierarchy: map primary, toolbar secondary, sheet tertiary | Pass |
| No generic centered-hero + purple-gradient layout | Pass (night map fills, teal POV) |
| Radius by role: Sheet `rounded-3xl` top corners (per DESIGN.md §2 "sheet") | Pass |
| Motion: only transform + opacity, 200ms, easing system token | Pass |

---

## Reference

Visual wireframe: `docs/design/status-map-responsive.html` (open in browser, self-contained, shows all 3 breakpoints + 3 mobile states + narrow ring + annotations).

Anti-slop criteria that must pass at the Design Gate (SMUX-2):
1. Map is primary at every breakpoint — chrome renders instantly, map never blanked.
2. All 8 states present for toolbar buttons, agent sprites, sheet close buttons, kanban cards, roster rows.
3. Sheet uses `rounded-3xl` top corners (DESIGN.md §2 role = "sheet → rounded-3xl").
4. No hardcoded hex in Sheet component (only SCENE_CSS values are exempt).
5. Tap targets ≥44px on every interactive element.
6. Focus trap + Esc + return-focus on every Sheet.
7. `aria-expanded` on toolbar buttons, `aria-label` on agents, `role="dialog"` on sheets.
8. Narrow ring deployed at <640px breakpoint, no agent overlaps campfire.

---

## Links

- Wireframe: `docs/design/status-map-responsive.html`
- Approved plan (G1): `.claude/plans/hover-stage-of-imperative-stearns.md`
- Scene files: `app/status/map/campsite-scene.tsx`, `app/status/map/campsite-overlays.tsx`, `app/status/map/page.tsx`
- `DESIGN.md` §2 (tokens) · §3 (Sheet, Button, ScrollArea) · §6 (Design Gate)
- `.claude/rules/loading.md` (MapProgress for loading.tsx — do not skeleton the full-screen canvas)
- `components/ui/form-patterns.md` (error pattern in Sheet)

## Changelog

- v1 (2026-06-28) — created (SMUX-1 wireframe deliverable, G2 owner review)
