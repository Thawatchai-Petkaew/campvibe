---
linear: CAM-260
feature: status-map-ux
epic: status-map-ux
persona: Admin
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-06-29
---
# Design — Mobile HUD Polish: Three Responsive Defects (CAM-260)

## User Job

An internal operator opens `/status/map` on a phone (~390px) or tablet (640–1023px) and needs the HUD — header, filter row, and bottom stats toolbar — to be fully usable: nothing clipped, controls reachable with a thumb, and visually coherent with the desktop glass-chip language.

## Flow

Operator opens `/status/map` on a mobile device. They see the full-screen campsite scene. The top header, bottom filter row, and bottom stats toolbar are the three zones being fixed. The rest of the scene (agents, fireflies, sheets, panels) is untouched.

---

## Breakpoint Map

Three tiers drive every rule below. Use exactly these breakpoints — they match the existing CSS media query structure.

| Tier | Range | Header | Filter row | Stats toolbar |
|---|---|---|---|---|
| Mobile | `<640px` | Icon-only pill strip (logo + 2 icon buttons + sound toggle); `box-sizing:border-box; max-width:100vw` enforced | `.hud-signposts-bottom` with full-pill joined ends + horizontal inset; clears toolbar | Shows "ทีม" (Users icon) + EnvPipelineCapsule (flex-grow center) + Board (LayoutGrid icon, no ChevronUp); gap-based, not space-between |
| Tablet | `640–1023px` | Same icon-only pill strip | Same `.hud-signposts-bottom` with full-pill ends + horizontal inset | Not visible (tablet uses edge-drawer tabs) |
| Desktop | `≥1024px` | Full text tabs restored (current desktop behavior — DO NOT TOUCH) | `.hud-signposts-desktop` (top row, current desktop behavior — DO NOT TOUCH) | Not visible (desktop uses left/right fixed panels) |

---

## Defect A — Header: Structural Fix + Icon-Only Mobile Composition

### Root Cause

`.hud-topbar` is `display:flex; padding:14px 18px` without `box-sizing:border-box` or `max-width`. The padding is added on top of `left:0; right:0`, meaning the effective inner width is `100vw - 36px` but children still try to fill `100vw`, causing overflow. `.hud-topbar-right` is `flex:none` (never shrinks), so its content spills off the right edge on any viewport narrower than the total natural width of all children.

The icon-only switch at `<1023px` hides `.hud-env-toggle` but leaves `<ViewToggle>` (which renders text "แดชบอร์ด") in the DOM and visible, so the text is still there on mobile.

### Structural rules Frontend must apply

Apply these to `.hud-topbar` in `SCENE_CSS` in `campsite-scene.tsx`:

```
box-sizing: border-box;
max-width: 100vw;       /* hard ceiling — can never exceed the viewport */
overflow: hidden;       /* last-resort clip; should never be needed if children obey */
```

Additionally `.hud-topbar-right` must be allowed to participate in flex shrink:

```
/* Remove flex:none from .hud-topbar-right; replace with: */
flex: 0 1 auto;         /* can shrink if the container is too narrow */
min-width: 0;
```

And `.hud-topbar-spacer` must use a flexible but bounded width:

```
flex: 1 1 0;
min-width: 0;
```

These three changes make the container overflow-proof structurally — no media-query hide/show can cause overflow because the container itself is capped.

### Icon-only switch: make it reliable

Do not depend solely on `.hud-env-toggle{display:none}` + `.hud-topbar-icons{display:none !important}` toggling. The current `ViewToggle` renders text on all sizes. The correct approach:

At `<1024px`, `.hud-topbar-right` shows only `.hud-topbar-icons` (the icon-button group already in the DOM). At `≥1024px`, `.hud-topbar-icons` is hidden and the full-text controls appear.

The existing `.hud-icon-btn` class already handles the icon-button visual language correctly. Frontend must verify `ViewToggle` is either (a) inside the `.hud-topbar-icons` block as an icon-only anchor, or (b) conditionally hidden at `<1024px` via a class that is actually applied.

### Mobile header composition (icon-only, left to right)

At `<1024px`, the topbar renders:

| Slot | Element | Icon (lucide) | Size | Token | aria-label |
|---|---|---|---|---|---|
| 1 (left) | Logo pill (existing `.hud-topbar-logo`) | — (SVG logo) | — | glass-chip surface | `aria-hidden="true"` (decorative) |
| 2 | Spacer (`flex:1 1 0; min-width:0`) | — | — | — | — |
| 3 | Dashboard link | `LayoutDashboard` 20px | `h-11 w-11` (44px) | `.hud-icon-btn` glass chip | `"ดูผลงานทั้งหมด"` |
| 4 | Env/productivity toggle | `Gauge` 20px | `h-11 w-11` (44px) | `.hud-icon-btn` glass chip | `"ผลผลิต Scout Team"` |
| 5 (right) | Sound toggle | Custom SVG (existing) | `w-44px h-44px` (existing `.sound-toggle`) | glass chip | `"เปิดเสียงบรรยากาศ"` / `"ปิดเสียงบรรยากาศ"` |

Total occupied width at 390px: logo pill (~80px) + spacer (flex) + 3 icon buttons (44 + 8 + 44 + 8 + 44 = 148px) + padding (36px) = ~264px natural width + flexible spacer. This fits at 390px with room to spare.

The "แดชบอร์ด" text tab and "ผลผลิต Scout Team" text button do not appear on mobile. They are already hidden via `.hud-env-toggle{display:none}`. Frontend must additionally confirm `ViewToggle` is icon-only at `<1024px` (the `hud-icon-btn` Dashboard link at slot 3 above replaces it).

### No new tokens needed for A

All values come from existing classes (`.hud-topbar-logo`, `.hud-icon-btn`, `.sound-toggle`, `.hud-topbar-spacer`). The structural fix is CSS property additions only.

---

## Defect B — Filter Row: Full-Pill Joined Ends + Horizontal Inset

### Root Cause

`.hud-signposts-bottom .hud-signpost-wrap:first-child .hud-signpost` is `border-radius:8px 0 0 0` (top-left corner only). `.hud-signpost-wrap:last-child .hud-signpost` is `border-radius:0 8px 0 0` (top-right corner only). The middle chip is `border-radius:0`. This produces a sharp-bottomed, flush-to-edges strip.

`left:0; right:0; width:100%` means the row sits flush to both screen edges with no inset.

### Target look

The bottom filter row must visually match the desktop `.hud-signposts` joined-pill treatment: rounded full-pill ends on the first and last chip, flat shared edges between chips. The row must have a horizontal inset so it floats above the screen edges.

### Radius rule (from DESIGN.md §2)

The signpost chips are interactive controls. Per DESIGN.md: "button · input · select-trigger · chip/pill · icon-button → `rounded-full`".

For a joined segmented group (multiple pills sharing borders), the grammar is:

| Position | CSS | Effective visual |
|---|---|---|
| First chip | `border-radius: 999px 0 0 999px` | Left end is fully rounded |
| Middle chip(s) | `border-radius: 0` | Flat on both sides |
| Last chip | `border-radius: 0 999px 999px 0` | Right end is fully rounded |

This matches exactly what the desktop `.hud-signpost-wrap:first-child .hud-signpost` and `:last-child .hud-signpost` rules already produce. The bottom layout must use the **same radius values** — remove the `8px` corner-only treatment and apply `999px` on the pill ends.

The bottom of every chip in the bottom row remains `border-radius-bottom: 0` — the row does not float, it sits on a container that has a bottom inset (see below). Do not add bottom radius — the chips sit flat against each other in a single row.

Correction: since the row has a horizontal inset, it does float. All four corners of the first chip = `border-radius:999px 0 0 999px` (left end fully rounded, right end flat). All four corners of the last chip = `border-radius:0 999px 999px 0`. This is the same as desktop. Middle chip stays `border-radius:0`.

### Horizontal inset

Remove `left:0; right:0; width:100%` from `.hud-signposts-bottom`. Replace with:

```
left: 12px;
right: 12px;
width: auto;   /* width is determined by left+right inset, not 100% */
```

Token reference: spacing scale gap `gap-4` = 16px (standard mobile gutter per DESIGN.md). 12px is tighter — propose using the existing `--pad-x` CSS custom property value (32px/2 = 16px) or define a new layout token.

Proposed new token: `--hud-inset-sm: 12px` — the horizontal breathing gap between a full-width HUD row and the screen edge on mobile. Add to `app/globals.css` as a CSS custom property under the status-map section (not in the main token set — internal layout constant for this page only). Log the change in this file.

If the team prefers to avoid a new token, `12px` may be used inline in this file only (it is a layout constant for the HUD surface, which already uses hardcoded px throughout its CSS block). However, the preferred path is the token to prevent drift.

### Result

At `<1024px` the filter row appears as a floating joined-pill group, identical in visual language to the desktop top-row signposts, with `12px` breathing room on each side.

---

## Defect C — Bottom Stats Toolbar: Icon Swap + Layout Fix

### Root Cause

At `<640px`, `.hud-map-toolbar` is `justify-content:space-between` which squeezes the center `EnvPipelineCapsule` between the two flanking buttons. At `≤380px` the text labels are hidden (`.hud-toolbar-btn-label{display:none}`) but the buttons still use `space-between`, so the capsule is stretched across the full available width, misaligning the glass-chip family.

The "ทีม" button uses `AlignJustify` (a hamburger/lines icon), which communicates "menu" not "team/people".

The Board button appends `ChevronUp` (`.hud-toolbar-caret`) — a directional caret that conflicts with `LayoutGrid` (a grid icon) and confuses the intent of the button.

### Layout fix

Replace `justify-content:space-between` on `.hud-map-toolbar` with:

```
justify-content: center;
gap: 10px;        /* gap-token: existing gap-4 scale; 10px is tighter for the toolbar context */
```

At `≤380px` (the narrow breakpoint where labels disappear), reduce the gap to:

```
gap: 6px;
```

This keeps the three elements — left button, center capsule, right button — visually grouped as a unit rather than stretched apart. The `EnvPipelineCapsule` already has `min-width:44px` and its own padding; it will sit at its natural width between the two flanking buttons.

Gap token reference: existing DESIGN.md spacing scale `gap-4` = 16px (desktop gutter). The toolbar uses a tighter value. Propose using `gap: 10px` inline — this is a HUD-specific layout value within the page's own CSS block (consistent with the rest of `.env-capsule { gap:7px }` approach in the same file). No new DESIGN.md token is needed since this is an internal HUD layout constant.

### Icon changes

| Button | Current icon (lucide) | Replacement icon (lucide) | Rationale |
|---|---|---|---|
| "ทีม" (roster) | `AlignJustify` (hamburger lines) | `Users` | Directly communicates "people / team"; `AlignJustify` reads as a menu toggle, not a roster |
| Board | `LayoutGrid` (keep) | `LayoutGrid` (unchanged) | Correct — grid icon communicates "board view" |
| Board caret | `ChevronUp` (remove) | — | Remove entirely; the button opens a sheet, not an expand; the caret direction conflicts with a bottom-toolbar sheet that opens upward |

The import line in `campsite-scene.tsx` currently has:

```ts
import { AlignJustify, BellRing, ChevronUp, Gauge, LayoutDashboard, LayoutGrid, Layers, X } from "lucide-react";
```

Frontend must:
- Replace `AlignJustify` with `Users` in the import and in the button JSX.
- Remove `ChevronUp` from the import (verify it is not used elsewhere in the file before removing).
- Remove the `<ChevronUp className="hud-toolbar-caret" ...>` element from the Board button JSX.

`Users` icon size: 16px (matches existing `AlignJustify size={16}` — keep consistent).

### aria-label update

The "ทีม" button aria-label is already `"เปิดรายชื่อทีม"` — correct, no change needed.

---

## Token Reference Table

All values must come from the token layer. No new hex values.

| Property | Token / value | Source |
|---|---|---|
| Glass chip background | `rgba(11,30,24,.50)` | Existing HUD glass pattern (`.hud-icon-btn`, `.sound-toggle`, `.hud-signpost`) — not a DESIGN.md semantic token; the HUD has its own dark-glass surface system consistent across the page |
| Glass chip border | `rgba(150,240,195,.13)` | Same HUD glass pattern |
| Glass chip backdrop-filter | `saturate(195%) blur(26px)` | Same |
| Focus ring | `outline:2px solid rgba(91,233,176,.8); outline-offset:2px` | Existing `.hud-icon-btn:focus-visible` |
| Active state color | `#5BE9B0` + `rgba(91,233,176,.12)` bg | Existing `.hud-icon-btn.active` |
| Hover | `rgba(255,255,255,.07)` bg | Existing `.hud-icon-btn:hover` |
| Icon button size | `width:44px; height:44px` | DESIGN.md size scale: `icon-button = h-11 w-11` (44px) |
| Chip/pill radius (full pill end) | `border-radius:999px` (one end) | DESIGN.md §2: "chip/pill → `rounded-full`" |
| Filter row horizontal inset | `12px` (proposed `--hud-inset-sm`) | New HUD layout constant — see Defect B |
| Toolbar gap (normal) | `10px` | Internal HUD layout constant |
| Toolbar gap (narrow ≤380px) | `6px` | Internal HUD layout constant |
| Icon size in toolbar buttons | `16px` | Existing; keep unchanged |
| Icon size in topbar icon buttons | `20px` | Existing `.hud-icon-btn svg{width:20px;height:20px}` |

No DESIGN.md semantic color tokens (e.g. `--primary`, `--card`) are used in this HUD — the HUD uses a custom dark-glass palette that predates the token system and is scoped to `app/status/**` (exempt from `check:palette`). Do not mix in semantic tokens.

### Proposed token addition

`--hud-inset-sm: 12px` in `app/globals.css` under a `/* status-map HUD layout constants */` comment block. Update this file's Token Reference when added. This is an internal layout constant, not a DESIGN.md semantic token, so it does not go in the DESIGN.md token tables.

---

## All 8 States — Icon Buttons (Header + Toolbar)

All three icon buttons in the header (Dashboard link, Env toggle, Sound toggle) and two toolbar buttons (ทีม, Board) use the same state model:

| State | Appearance | Rule |
|---|---|---|
| Default | `background:rgba(11,30,24,.50); border:1px solid rgba(150,240,195,.13); color:rgba(223,234,245,.82)` | Glass chip at rest |
| Hover | `background:rgba(255,255,255,.07); color:rgba(223,234,245,.96); border-color:rgba(91,233,176,.30)` | Subtle lighter fill |
| Focus-visible | `outline:2px solid rgba(91,233,176,.8); outline-offset:2px` | Visible teal ring; required WCAG 2.1 AA |
| Active (pressed) | `transform:scale(.95)` (only under `prefers-reduced-motion:no-preference`) | Press feedback |
| Active/selected (toggled on) | `background:rgba(91,233,176,.14); border-color:rgba(91,233,176,.40); color:#5BE9B0` | Green-glass tinted; applies to Env toggle when panel is open, Sound when on |
| Loading | Not applicable (buttons trigger instant UI actions, no async) | — |
| Error | Not applicable (icon buttons have no error state in this context) | — |
| Disabled | `opacity:.45; pointer-events:none; cursor:not-allowed` | Existing `.hud-icon-btn:disabled` and `.hud-toolbar-btn:disabled` |

The `aria-pressed` attribute must be set on toggle buttons (Sound, Env) to communicate the toggled state to screen readers — this is already implemented for Sound and Env buttons. Verify after the icon swap that the "ทีม" button also has `aria-expanded` (it already does via `aria-expanded={openSheet === "roster"}`).

---

## Accessibility Checklist (WCAG 2.1 AA)

- [ ] **Tap target ≥44px** — all icon buttons are `w-44px h-44px` (44px = the DESIGN.md `icon-button` scale). The EnvPipelineCapsule has `min-height:44px`. Filter chips have `min-height:40px` on desktop but must be `min-height:44px` on mobile — **Critical**: the bottom filter row sets `min-height:30px` at mobile. Raise to `min-height:44px` at `<1024px` (override `.hud-signposts-bottom .hud-signpost { min-height:44px }` at mobile).
- [ ] **aria-label on every icon-only button** — Dashboard link: `"ดูผลงานทั้งหมด"`, Env button: `"ผลผลิต Scout Team"`, Sound toggle: `"เปิด/ปิดเสียงบรรยากาศ"`, ทีม button: `"เปิดรายชื่อทีม"`, Board button: `"เปิด Board"`. All currently set — verify they survive the icon swap.
- [ ] **Focus visible ring** — all buttons use `focus-visible` with the teal outline. The Dashboard link (`<a>`) must also have this — verify `.hud-icon-btn:focus-visible` applies to anchors.
- [ ] **Color not the only signal** — active/selected states combine color change + border change; not color-only.
- [ ] **Keyboard operability** — all buttons are native `<button>` or `<a>` elements; no custom divs acting as buttons.
- [ ] **Contrast** — icon color `rgba(223,234,245,.82)` on `rgba(11,30,24,.50)` background with backdrop-blur: not measured (glass surface contrast is difficult to measure due to backdrop-filter; the light icon on dark-glass background is visually high-contrast and consistent with the existing HUD pattern). Active state `#5BE9B0` on `rgba(91,233,176,.12)` dark-tinted: not measured.
- [ ] **Screen reader** — `aria-label` on every icon-only control; `aria-pressed` on toggles; `aria-expanded`+`aria-controls` on sheet-openers.
- [ ] **Filter chip accessible names** — chips display text labels (persona/feature/epic name or "ทุกกลุ่ม" etc.), so they do not need separate aria-labels. Verify the label text is visible in the DOM (not hidden via `display:none`).

**Critical finding — filter chip tap target**: the `.hud-signposts-bottom .hud-signpost` rule sets `min-height:30px`. This is below the 44px minimum for touch targets (WCAG 2.5.5). Frontend must set `min-height:44px` on mobile. This must be fixed as part of this story.

---

## Copy (locales)

No new user-facing copy strings are introduced by this defect fix. All aria-labels are already present in the code. Thai copy in aria-labels follows existing patterns — no em-dash, no technical jargon.

Existing aria-labels to verify are unchanged after the icon swap:

| Key | Current Thai value | Status |
|---|---|---|
| Dashboard link | `"ดูผลงานทั้งหมด"` | Keep |
| Env toggle button | `"ผลผลิต Scout Team"` | Keep |
| ทีม button | `"เปิดรายชื่อทีม"` | Keep (aria-label does not change with icon change) |
| Board button | `"เปิด Board"` | Keep |
| Sound toggle on | `"ปิดเสียงบรรยากาศ"` | Keep |
| Sound toggle off | `"เปิดเสียงบรรยากาศ"` | Keep |

No additions to `locales/` required.

---

## Error / Empty States

Not applicable to this structural polish story. The buttons and filter chips do not have error or empty states. The EnvPipelineCapsule already handles its own empty/zero state (`isAllZero` → muted bar). Those are untouched.

---

## Anti-Patterns Fixed by This Story

### 1. Edge-to-edge controls (fixed by Defect B)

The bottom filter row currently sits `left:0; right:0` with no inset — controls begin at the physical screen edge. This is a named anti-pattern: controls must have breathing room from the viewport edge (equivalent to the "no flush to screen edge" principle implied by DESIGN.md's spacing scale). Fix: `left:12px; right:12px`.

### 2. Hardcoded radius mixed with pill tokens (fixed by Defect B)

`border-radius:8px 0 0 0` is a hardcoded pixel value that is neither a DESIGN.md scale utility (`rounded-full`, `rounded-3xl`, etc.) nor a design token. The correct value for a pill-end is `999px`. The existing desktop `.hud-signpost` already uses the correct value; the mobile override incorrectly introduced `8px`. Fix: apply the same `999px` pill-end on mobile.

### Recommendation: add anti-pattern entry to DESIGN.md

Recommend adding one entry to the §5 Named Anti-Patterns table:

| Anti-pattern | CampVibe counter |
|---|---|
| Bottom/fixed row at `left:0; right:0` with no inset, controls flush to the screen edge | All HUD rows on mobile have a horizontal inset (`--hud-inset-sm: 12px`) so controls breathe from the viewport edge |

This is an Important (not Critical) recommendation — the current DESIGN.md covers spacing tokens but not this specific mobile-edge rule explicitly. Adding it prevents recurrence in future HUD stories.

---

## Do Not Touch

- Desktop (`≥1024px`) layout: `.hud-topbar` + `.hud-signposts-desktop` + `.hud-left-panels` + `.hud-right-panels` — no change.
- The campsite engine (`campsite-engine.ts`), agent sprites, firefly layer, walk-graph, rAF loop.
- Data / API contracts: `/status/map/data`, `/api/status/stream`, `MapModel` shape.
- The Kanban board, Gate Detail Modal, Roster Sheet content, Delivery Gift — only their trigger buttons are in scope (icon swap on ทีม button only).
- `EnvPipelineCapsule` internal layout — do not touch. Only the toolbar's `justify-content` and `gap` change.
- `FilterSignposts` internal logic — only the CSS applied to `.hud-signposts-bottom` changes (radius + inset).

---

## Anti-Slop Criteria (Design Gate)

Before this PR merges, the screenshot at ~390px must pass:

- [ ] Top header fits entirely within the viewport — no element clipped at the right edge.
- [ ] Three icon buttons in the header are 44px tap targets, glass-chip style, visually consistent with the desktop sound-toggle idiom.
- [ ] No text tabs visible on mobile (no "แดชบอร์ด", no "ผลผลิต Scout Team" text).
- [ ] Bottom filter row has rounded pill ends on left and right (matches desktop joined-pill grammar), and is inset 12px from each screen edge.
- [ ] Bottom filter row tap targets are ≥44px height.
- [ ] Bottom toolbar: "ทีม" shows `Users` icon (not hamburger lines), Board shows `LayoutGrid` only (no ChevronUp caret), three elements are evenly gapped (not space-between stretched).
- [ ] The overall feel matches the dark-glass HUD family — no foreign card look, no flat-gray, no hardcoded colors outside the existing HUD palette.
- [ ] `npm run lint` and `npm run typecheck` green.
- [ ] `npm run check:palette` green (no new hardcoded colors; the HUD palette is already scoped to `app/status/**` and exempt).

---

## Links

- `../../../status-map-ux/status-map-ux/CAM-250-smux-1-responsive-wireframe/design.md` — prior responsive wireframe
- `../../../status-map-ux/status-map-ux/CAM-255-smux-5-header-stats-wireframe/design.md` — prior header/stats wireframe
- `/home/user/campvibe/DESIGN.md` — design system (token tables, radius scale, icon policy)
- `/home/user/campvibe/app/status/map/campsite-scene.tsx` — SCENE_CSS block: `.hud-topbar`, `.hud-topbar-right`, `.hud-topbar-spacer`, `.hud-map-toolbar`, `.hud-toolbar-btn`
- `/home/user/campvibe/app/status/map/campsite-overlays.tsx` — HUD_CSS block: `.hud-signposts-bottom`, `.hud-signpost`, `.hud-icon-btn`

## Changelog

- v1 (2026-06-29) — created; covers three defects A/B/C for CAM-260
