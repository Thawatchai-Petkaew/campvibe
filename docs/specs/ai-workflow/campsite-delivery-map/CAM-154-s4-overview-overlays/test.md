# S4 — Test

## AC → verification map

| AC | What to verify | How |
|---|---|---|
| 1 | 4 chips visible on load (no panel open) | `data-testid="chip--map-overlay-delivery"` etc. visible; no `panel--map-overlay-*` in DOM |
| 2 | Gd chip → panel opens, chip disappears, canvas dims | click chip, check `panel--map-overlay-delivery` appears, chip gone, scene opacity 0.82 |
| 3 | Switching chips | click delivery chip then crew chip; only crew panel visible |
| 4 | Esc closes + focus returns | open panel, press Esc; panel gone, document.activeElement === chip button |
| 5 | Click-outside closes | open panel, click map-stage; panel gone |
| 6 | Focus trap | open panel, Tab x N times; focus never leaves the dialog |
| 7 | Delivery numbers | `orb--delivery-pct` text === `${model.projectPct}%`, etc. |
| 8 | Crew row You first | `row--crew-you` is first child |
| 9 | Env columns + RELEASE tag | `col--env-staging` contains RELEASE tag when staging non-empty; `col--env-dev` shows — when empty |
| 10 | Backlog groups | `grp--backlog-frontend-engineer` shows role items |
| 11 | Gates panel | `item--gate-CAM-XX` with `ตรวจและอนุมัติ →` link to Linear URL |
| 12 | Empty gates | `empty--gates` text = `✓ ไม่มีงานรออนุมัติจากคุณตอนนี้` |
| 13 | Empty delivery | totalEpics===0 → `ยังไม่มีสตอรีในโปรเจกต์` |
| 14 | reduced-motion | hover transform absent; chips still clickable; panels still open |

## Self-verify results (S4 build)

- `npm run lint` — PASS (0 errors; warnings are pre-existing in other files)
- `npm run typecheck` — PASS (0 errors)
- `npm run build` — PASS (`/status/map` builds ƒ dynamic)
- `npm run check:palette` — PASS (0 violations)

## Tests added

No unit/integration tests added in S4 (scene is canvas/DOM-heavy, covered by browser testing). QA follow-up should cover:

1. Single-open: open delivery, click crew chip → assert only crew panel visible (no delivery panel).
2. Esc closes: `userEvent.keyboard('{Escape}')` after open → panel gone + focus on chip.
3. Click-outside: `userEvent.click(document.body)` → panel gone.
4. Focus trap: Tab loop stays inside dialog — check `document.activeElement` remains within panel.
5. Empty states: render `<DeliveryPanel totalEpics={0} ...>` → assert empty text.
6. Data accuracy: render with known MapModel fixture → assert orb values match.

## a11y browser checks (not automated)

- `axe-core` run on `/status/map` with each panel open in turn.
- Keyboard navigation: Tab to chip → Enter → panel opens → Tab within panel → Esc → focus on chip.
- Screen reader (VoiceOver): chip announces `aria-expanded="true/false"` state; panel announces as dialog with label.
