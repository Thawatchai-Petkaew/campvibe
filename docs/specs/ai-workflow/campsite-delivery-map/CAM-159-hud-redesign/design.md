# CAM-159 Design Brief — HUD Redesign

## Overview

Replace four scattered corner glass chips with a cohesive single-surface HUD. The design draws directly from the campsite-campsite.html mockup's `.kanban` aside and the campvibe-delivery.html mockup's glass treatment, header, progress bar, metric pills, and Kanban board.

## 1. Command Dock (bottom-center)

**Structure:** One horizontal glass bar fixed at `bottom: 18px; left: 50%; transform: translateX(-50%)`. Rounded pill `border-radius: 999px`. `max-width: min(960px, 94vw)`, horizontally scrollable on narrow screens.

**Glass treatment (sourced from campvibe-delivery.html `.glass`):**
- `background: rgba(10,20,36,.82)` (slightly more opaque than chip, for readability)
- `backdrop-filter: saturate(165%) blur(22px)`
- `border: 1px solid rgba(255,255,255,.18)`
- `box-shadow: 0 16px 48px rgba(0,0,0,.52), inset 0 1px 0 rgba(255,255,255,.12)`

**Segments:** Divider `border-right: 1px solid rgba(255,255,255,.12)` between each. First segment rounded-left pill, last rounded-right pill. Each segment:
- `min-height: 48px`, `min-width: 44px` (tap ≥44px)
- Value: `font-family: JetBrains Mono, font-size: 14px, font-weight: 700, color: #5BE9B0`
- Label: `font-size: 10.5px, color: rgba(223,234,245,.55)`
- Hover: `background: rgba(255,255,255,.07)`
- Focus: `outline: 2px solid rgba(91,233,176,.8) outline-offset: -2px`
- Active (panel open): `background: rgba(91,233,176,.12), color: #5BE9B0`

**Overview segments (left → right):**
1. `ทุก delivery ▾` (scope picker)
2. `{pct}% เสร็จ` + mini inline progress bar (4px high)
3. `⚑ {n} gate` (amber when >0)
4. `{n}/7 ทีม`
5. `Dev{n}·St{n}↑·Pr{n} Env`
6. `{n} Backlog`

**Epic mode segments (left → right):**
1. `‹ Overview · {epicName} ▾` (scope picker + back)
2. `Stage {i}/5 {stageName} ขั้นตอน`
3. `▶{n} ⚑{n} ⏳{n} ✓{n} สตอรี`
4. `{n}/7 ทีม`
5. `{n} ในคิว`
6. `เปิดบอร์ด` button (teal-filled, prominent CTA, rounded-right pill)

## 2. Expand Panel (rises above dock)

Triggered by clicking a dock segment. One panel open at a time.

**Position:** `position: fixed; bottom: 80px` (above dock), horizontally aligned to segment position. Left segments → `PANEL_LEFT`; center → `PANEL_CENTER`; right segments → `PANEL_RIGHT`.

**Glass treatment (matches `.kanban` in campvibe-campsite.html):**
- `background: rgba(10,20,36,.92)`
- `backdrop-filter: saturate(165%) blur(24px)`
- `border: 1px solid rgba(255,255,255,.18)`
- `border-radius: 18px`
- `box-shadow: 0 24px 56px rgba(0,0,0,.56), inset 0 1px 0 rgba(255,255,255,.1)`
- `padding: 18px 20px 20px`
- `min-width: 260px; max-width: min(360px, 92vw)`

**Animation (prefers-reduced-motion:no-preference only):**
- `@keyframes panelRise { from { opacity:0; transform: translateY(12px) } to { opacity:1; transform: translateY(0) } }`
- Duration: `180ms cubic-bezier(0.23,1,0.32,1)` (within 120–250ms spec)

**a11y:** `role="dialog" aria-modal="true" aria-label={title}`, focus-trap, Esc closes + returns focus to trigger button.

## 3. Kanban Modal (large centered)

Opens from `เปิดบอร์ด` segment. Heavy data — full 5-column Kanban.

**Treatment (sourced from campvibe-delivery.html `.board-wrap`, `.kc`, `.orb`; and campvibe-campsite.html `.kanban`, `.kb-bar`, `.kb-metrics`):**

**Box:**
- `width: min(900px, 96vw); max-height: 88vh; overflow-y: auto`
- `background: rgba(10,20,36,.94)`
- `backdrop-filter: saturate(165%) blur(26px)`
- `border: 1px solid rgba(255,255,255,.18)`
- `border-radius: 22px`
- `box-shadow: 0 32px 72px rgba(0,0,0,.64), inset 0 1px 0 rgba(255,255,255,.12)`
- `padding: 24px 26px 28px`

**Header:** Epic name (Outfit 17px 700) + sub (12px muted) + close button (44×44 icon-only).

**Progress bar (sourced from campvibe-campsite.html `.kb-bar`):**
- `height: 6px; border-radius: 3px; background: rgba(255,255,255,.1)`
- Fill: `background: linear-gradient(90deg, rgba(91,233,176,.65), #5BE9B0)`

**Metric pills (sourced from campvibe-campsite.html `.m`, `.kb-metrics`):**
- Grid, `background: linear-gradient(180deg, rgba(11,42,43,.3), rgba(8,19,22,.18))`
- `border: 1px solid rgba(255,255,255,.06); border-radius: 10px; padding: 8px 14px`
- Value: JetBrains Mono 18px 700; Label: 9.5px muted
- Color coding: กำลังทำ=`#5BE9B0`, ตรวจสอบ=`#B7A6FF`, รอทำ=`#8FB8F0`, เสร็จ=faint, รอคุณ=`#FFB454`

**Kanban columns (sourced from campvibe-delivery.html `.board`, `.kc`):**
- `display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px`
- Column headers color-coded: Backlog=#aebcc9, Todo=#8FB8F0, In Progress=#5BE9B0, In Review=#B7A6FF, Done=#76E0AE
- Cards: `background: linear-gradient(180deg, rgba(11,42,43,.32), rgba(8,19,22,.2))`, `border: 1px solid rgba(255,255,255,.07)`, `border-radius: 11px; padding: 10px 11px`
- Active card: `border-color: rgba(91,233,176,.34)`
- Awaiting card: `border-color: rgba(255,150,52,.4)`, amber gradient background
- YOU badge: `background: #FFB454; color: #241402; font-size: 8px; padding: 2px 6px; border-radius: 4px`

**Animation (prefers-reduced-motion:no-preference only):**
- `@keyframes modalIn { from { opacity:0; transform: scale(.92) } to { opacity:1; transform: scale(1) } }`
- Duration: `200ms cubic-bezier(0.23,1,0.32,1)` (within 120–250ms spec)
- Backdrop: `@keyframes bdFade { from { opacity:0 } to { opacity:1 } }`

**a11y:** `role="dialog" aria-modal="true" aria-label="บอร์ด {epicLabel}"`, focus-trap, Esc + click-outside closes, `aria-label` on close button, progress bar `role="progressbar"`.

## 4. View Toggle (top-center)

Replace top-left positioned nav with centered pill.

**Position:** `position: fixed; top: 18px; left: 50%; transform: translateX(-50%); z-index: 22`

**Glass pill:**
- `background: rgba(16,26,42,.62)`
- `backdrop-filter: saturate(150%) blur(18px)`
- `border: 1px solid rgba(255,255,255,.16)`
- `border-radius: 999px`
- `box-shadow: 0 8px 24px rgba(0,0,0,.32)`

**Items:** Real anchor links (`<a>` for dashboard, `<span role="tab">` for current). `padding: 10px 20px; min-height: 44px`. Active: `background: rgba(91,233,176,.15); color: #5BE9B0`.

## 5. Epic Bug Fixes

### Bug 1: Overlapping chips (position="right" × 2)
**Root cause:** `EpicUpNextPanel` and `CrewPanel` both used `position="right"` in the old `<Overlay>` system, rendering at the same fixed coordinates.
**Fix:** Eliminated by moving to the single dock — all segments are in one horizontal bar; panels are horizontally anchored by PANEL_LEFT/CENTER/RIGHT computed positions. No two panels can overlap.

### Bug 2: Blank scene (all agents dimmed)
**Root cause:** `engine.setScope("epic", roles)` called with `roles = []` when the epic's stories have no `[role]` tags resolved. The engine sets all agents to `opacity: 0.18` when no roles match.
**Fix:** In `campsite-scene.tsx` scope effect: guard `if (roles.length > 0) { engine.setScope("epic", roles) } else { engine.setScope("all", []) }`.

### Bug 3: activeEpicData deep-link fallback
**Root cause:** Deep-link `?epic=X` passes `X` as `activeEpic`; if `epics` array hasn't loaded or `X` doesn't exist in it, `epics.find(e => e.key === activeEpic)` returns `undefined` (coerced to `null`). The scene would try to use `activeEpicData.stories` which is null.
**Fix:** Explicit guard: `const activeEpicData = activeEpic ? (epics.find((e) => e.key === activeEpic) ?? null) : null`. All epic panel content uses `activeEpicData?.stories ?? []` so empty state renders gracefully.

## Interaction States (all 8 required)

| State | Dock segment | Panel | Modal |
|---|---|---|---|
| default | glass bg, white text, divider | not rendered | not rendered |
| hover | `rgba(255,255,255,.07)` bg | — | — |
| focus | `outline: 2px solid rgba(91,233,176,.8)` | first focusable element receives focus | close button receives focus |
| active | `rgba(91,233,176,.12)` bg, teal text | panel open | modal open |
| loading | n/a (data pre-loaded) | n/a | n/a |
| empty | segment shows 0 / "—" | panel shows Thai empty string | modal shows "ยังไม่มีสตอรีใน epic นี้" |
| error | gates ⚑ amber | Gates panel shows gate items | — |
| disabled | n/a | n/a | n/a |

## Reduced-motion

All CSS animations (`panelRise`, `modalIn`, `bdFade`, `hud-prog-fill transition`) are inside `@media (prefers-reduced-motion: no-preference) { ... }` blocks. Under `reduce`, panels and modals appear/close instantly but remain fully usable.
