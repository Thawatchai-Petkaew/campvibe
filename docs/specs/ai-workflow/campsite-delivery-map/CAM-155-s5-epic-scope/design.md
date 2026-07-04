# CAM-155 S5 — Design

## Scope Switcher UX

### Overview mode chip (top-left)
- Chip: `ทุก delivery ▾` — minimal, compact, 44px min-height.
- On open: full panel shows (1) header `ทั้งหมด (Overview)`, (2) segmented `Feature | Persona` toggle, (3) filter row (`ทั้งหมด · กำลังทำ · เสร็จแล้ว · ยังไม่เริ่ม`), (4) scrollable epic list.

### Epic mode chip (top-left)
- Chip: `‹ Overview · {epicName} ▾` (‹ Overview is a button inside the chip that immediately returns without opening the panel).
- `‹ Overview` click: instant scope restore — no panel open needed.
- Chip click (on the name/▾ part): opens switcher panel for browsing/switching epics.
- Panel: same list layout + a "‹ กลับ Overview (ทั้งหมด)" button at top.

### Epic list item
- Button: icon-less to keep density; epic name + feature/persona sub-label; bucket chip (กำลังทำ/เสร็จ/ยังไม่เริ่ม); % completion.
- Keyboard: `Tab` into the list, `Enter`/`Space` selects. The `role="listbox"` + `role="option"` semantics enable keyboard navigation.
- Filter buttons: `aria-pressed` (not `role="radio"`) — correct semantics for toggle buttons.

## Trail visual (Progress panel)

5 nodes in a row: Design — Gate — Build — Verify — Ship.
- Node states: `run` (green glow), `gate` (amber glow), `done` (green filled), `q` (blue outline), `idle` (dim outline).
- Connecting segments lit to match the leftmost active/gate/done node.
- Labels below each node (via `ovl-trail-label`).
- Below trail: 4 orbs for กำลังทำ / รอคุณ / ในคิว / ส่งแล้ว.

## Board (5-col Kanban)
- Columns: Backlog / Todo / In Progress / ตรวจสอบ / เสร็จ — left to right.
- Active card: `border-color: rgba(91,233,176,.4)` (green tint).
- Awaiting card: `border-color: rgba(255,180,84,.4)` (amber tint) + `รอคุณ` badge.
- Board overflows horizontally (`overflow-x: auto`) — acceptable for internal ops.
- Legend at bottom: green dot = กำลังทำ, amber dot = รอคุณ.

## States

| Component | State | Render |
|---|---|---|
| ScopeSwitcherPanel | empty epics | `ยังไม่มี epic ในโปรเจกต์` |
| ScopeSwitcherPanel | filter no match | `ไม่มี epic ที่ตรงกับตัวกรอง` |
| EpicProgressPanel | no stories | `ยังไม่มีสตอรีใน epic นี้` |
| EpicUpNextPanel | empty queue | `— คิวว่าง` |
| EpicBoardPanel | no stories | `ยังไม่มีสตอรีใน epic นี้` |
| Agent (Epic scope) | not in epic | opacity 0.18, pointer-events: none |
| Agent (Overview) | restored | opacity 1 (CSS transition 300ms) |

## A11y

- Scope switcher segmented: `role="tablist"` + `role="tab"` + `aria-selected` (correct ARIA pattern for paired tabs).
- Filter buttons: plain `<button>` + `aria-pressed` (no invalid role override).
- Epic list: `role="listbox"` + `role="option"` + `aria-selected`.
- All panels: `role="dialog"` `aria-modal="true"` + focus trap + Esc (inherited from `<Overlay>` primitive).
- Chips: `<button>` `aria-expanded` (from `<Overlay>` primitive).
- Tap targets: min-height 44px on all interactive elements.
- Scope dimming: CSS opacity transition — not a vestibular risk (no position change, no flash).

## Anti-slop checks

- No hardcoded strings in JSX — all Thai copy is inline in the component (internal ops dashboard; does not use `locales/` per S4 precedent for this page).
- No debug output.
- Trail numbers come from `buildTrail` + the same helpers as `/status` — no fabricated values.
- Board column order matches `COLS` in `app/status/page.tsx` exactly: Backlog/Todo/In Progress/In Review/Done.
- `epicBucket` is called server-side in `page.tsx` — same function as `/status` for consistency.
