---
linear: CAM-182
feature: ai-workflow
epic: ai-delivery-workflow-the-camper
persona: platform
artifact: tech
owner: frontend-engineer
status: Done
version: v1
updated: 2026-06-25
---
# Tech — Quest UI: Approval Notification + Approval Card (CAM-182)

## Files touched

| File | Change |
|---|---|
| `app/status/map/campsite-scene.tsx` | BellRing import; .you-alert CSS overhaul; YouScout markup — icon + popover copy |
| `app/status/map/campsite-overlays.tsx` | AlertTriangle removed from imports; .hud-appr-* CSS redesign; ApprovalCard markup — ClipboardCheck |
| `__tests__/cam-182-quest-approval-ui.test.ts` | 28 source-inspection guard tests (new) |
| `docs/delivery/.../tech.md` | this file |

---

## Part 1 — Notification bubble redesign (`.you-alert`)

### Icon

Added `import { BellRing } from "lucide-react"` (owner choice: BellRing, overrides design-brief default A1 ClipboardCheck). The `&#9873;` Unicode glyph and `.adot` DOM div are both removed. `<BellRing size={15} strokeWidth={2} aria-hidden="true" />` is rendered inside the `<span className="you-alert">` (which is itself `aria-hidden="true"` — the parent `<button>` carries the accessible name).

### CSS changes

| Property | Before | After |
|---|---|---|
| `font-size` | 11px | 13px |
| `padding` | 5px 11px | 7px 14px |
| `border` | 1px solid rgba(255,207,134,.7) | 1.5px solid rgba(255,220,130,.75) |
| `gap` | 6px | 7px |
| `border-radius` | 11px | 13px |
| `box-shadow` | 0 8px 22px -3px var(--amber-glow) | 0 0 0 1.5px rgba(255,180,84,.55), 0 10px 28px -4px rgba(255,150,52,.7) |
| `.you-alert svg` | — (none) | width:15px; height:15px (icon sizing via class) |

### Dead CSS removed

- `.you-alert .adot` rule (width/height/background for the DOM dot) — removed.
- `@keyframes pdot3` (the ring-pulse on the dot) — removed.
- `.you-alert .adot{animation:pdot3}` inside the `@media (prefers-reduced-motion: no-preference)` block — removed.

### Preserved

- `@keyframes alertPulse` (vertical float 1.9s) — unchanged, still inside `@media (prefers-reduced-motion: no-preference)`.
- `.you-alert{animation:alertPulse 1.9s ease-in-out infinite}` — unchanged.
- `::after` downward caret tail — unchanged.
- `:focus-visible` outline — unchanged.
- `min-height:44px; min-width:44px` — preserved.

### Popover hint copy

Changed from `${gates.length} gate รอการอนุมัติ — กดปุ่ม ⚑` (contained Unicode glyph) to `${gates.length} gate รอการอนุมัติ — กดเพื่อดูรายละเอียด`.

---

## Part 2 — Approval card redesign (`ApprovalCard` / `.hud-appr-*`)

### Icon

Replaced `AlertTriangle` with `ClipboardCheck` (owner choice B1: visual coherence with notification) in all three occurrences: collapsed heading, mini label, and the expanded primary button. Sizes: heading/collapsed = size 13, mini label = size 12, primary button = size 14. `AlertTriangle` removed from the lucide import line entirely.

### CSS changes — card surface

| Property | Before | After |
|---|---|---|
| `border` | 1px solid rgba(255,190,80,.18) | 1.5px solid rgba(255,190,80,.32) |
| `box-shadow` | 0 8px 28px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,220,130,.08) | 0 10px 32px rgba(0,0,0,.44), inset 0 1px 0 rgba(255,220,130,.14), inset 0 0 0 1px rgba(255,190,80,.08) |

### Amber crown top accent (`::before` on `.hud-appr-head`)

A 2px absolute stripe across the top of the card header:
- `background: linear-gradient(90deg, rgba(255,180,84,0), rgba(255,180,84,.6), rgba(255,180,84,0))`
- `border-radius: 18px 18px 0 0` — matches card top radius.

### Card glow animation

New `@keyframes apprCardGlow` (2.8s ease-in-out infinite) oscillates the card's outer amber glow between:
- 0%/100%: baseline box-shadow + border at rgba(255,190,80,.32)
- 50%: adds `0 0 18px rgba(255,160,52,.22)` ambient outer glow + border to rgba(255,190,80,.52)

Applied via `.hud-appr-card { animation: apprCardGlow 2.8s ease-in-out infinite }` inside a `@media (prefers-reduced-motion: no-preference)` block. Under `prefers-reduced-motion: reduce` the card holds the static elevated border/shadow with no movement.

### Typography bumps

| Element | Before | After |
|---|---|---|
| `.hud-appr-heading` font-size | 10.5px | 11.5px |
| `.hud-appr-title` font-size | 11.5px | 12.5px |
| `.hud-appr-badge` font-size | 9.5px | 10.5px |

### Item rows

- `background` up to rgba(255,190,80,.09) (from .06)
- `border` up to rgba(255,190,80,.18) (from .12)
- `border-radius` 11px (from 10px)
- `padding` 7px 8px (from 6px)

### Badge

- `background` rgba(255,190,80,.28) (from .20), `color` rgba(255,210,80,.95) (from .90), `padding` 3px 8px (from 2px 7px)

### Primary button `.hud-appr-btn`

| Property | Before | After |
|---|---|---|
| `padding` | 9px 14px | 11px 14px |
| `min-height` | (none — ~36px via padding) | 44px (explicit — AC critical fix) |
| `background` | rgba(255,190,80,.12) | rgba(255,190,80,.18) |
| `border` | 1px solid rgba(255,190,80,.2) | 1.5px solid rgba(255,190,80,.32) |
| `border-radius` | 12px | 13px |
| `font-size` | 12px | 12.5px |
| `:hover box-shadow` | (none) | 0 0 10px rgba(255,160,52,.2) amber outer glow |
| `:focus-visible` | (none — inherited) | outline: 2px solid rgba(91,233,176,.8); outline-offset:2px |

### Collapsed mini button

Changed inline style from `padding: "5px 12px"` to `padding: "8px 14px"` + `minHeight: "36px"`. 36px is below the 44px ideal — flagged in design.md; acceptable for a compact secondary action in the mini HUD layout (the full expanded card is one tap away).

---

## Reduced-motion handling

Both animations are gated with `@media (prefers-reduced-motion: no-preference)`:
- `alertPulse` (notification float) — pre-existing gate, preserved.
- `apprCardGlow` (card ambient pulse) — new gate added alongside the new keyframe.

Under `prefers-reduced-motion: reduce`:
- Notification bubble is static at its anchored position; glow box-shadow is static (not animated).
- Card holds the elevated static border/shadow from the rule declaration; no pulsing.

---

## a11y

- Notification: `aria-hidden="true"` on `<BellRing>` icon (decorative inside an already-hidden span). Parent button carries accessible name.
- Card: `role="complementary" aria-label="งานรออนุมัติ"` preserved. `ClipboardCheck` icons are `aria-hidden="true"` (decorative; button text `ดูและอนุมัติทั้งหมด` is the accessible name).
- Expanded button: `min-height:44px` explicit tap target. `:focus-visible` teal outline added.
- Contrast: not measured (scene-scoped rgba values, exempt from global palette check). To be verified with axe on Staging.

---

## Guard tests (`__tests__/cam-182-quest-approval-ui.test.ts`)

28 source-inspection tests covering both redesigns:
- AC-notify-1…7: BellRing import/usage; no `&#9873;`; no `.adot`; font-size 13px; padding 7px 14px; amber ring box-shadow; pdot3 gone; alertPulse preserved and in no-preference block.
- AC-card-1…11: ClipboardCheck in JSX; AlertTriangle gone from import; `apprCardGlow` keyframe + reduced-motion gate; crown `::before`; animation wired; type bumps (11.5/12.5/10.5px); `min-height:44px`; border 1.5px.

---

## Self-verify results

| Check | Result |
|---|---|
| `npm run lint` | 0 errors (246 pre-existing warnings, unchanged) |
| `npm run typecheck` | clean (0 errors) |
| `npm test` | 2642 passed (49 files) — all green including 28 new CAM-182 tests |
| `npm run check:palette` | PASS (0 violations) |
| `npm run check:ds` | PASS (0 violations) |
| `npm run build` | clean — /status/map compiled successfully |

---

## CWV scorecard

| Metric | Value |
|---|---|
| LCP | not measured |
| CLS | not measured — no layout shift introduced (no new block elements, no dimension changes to containing layout; glow is box-shadow which does not affect layout) |
| INP | not measured |

Potential risks: none flagged. The `apprCardGlow` animation uses `box-shadow` + `border-color` only — both are GPU-composited properties that do not trigger layout or paint (only composite), so no CLS or INP regression is expected. The `alertPulse` animation was pre-existing and uses `transform` only.

---

## What QA should target

1. Verify `BellRing` icon renders in the `.you-alert` pill when `gates.length > 0` — no `&#9873;` glyph, no DOM dot.
2. Verify `.you-alert` pill is readable at 13px with 7px 14px padding and visible amber glow ring.
3. Verify `ApprovalCard` expanded state shows `ClipboardCheck` in heading + primary button; no `AlertTriangle`.
4. Verify amber crown stripe visible at top of card.
5. Verify card glow pulses in browser with `prefers-reduced-motion` off; static with it on.
6. Verify primary button `ดูและอนุมัติทั้งหมด` tap target is 44px height.
7. Verify collapsed mini button `ดู` is at least 36px height.
8. Verify existing approve/modal flow is unchanged (logic untouched).
9. Contrast check with axe on Staging (scene-scoped rgba, exempt from CI palette guard).
