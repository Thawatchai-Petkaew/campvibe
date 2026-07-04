# CAM-155 S5 — Test plan

## AC → Verification mapping

| AC | Verification method |
|---|---|
| AC-1: scope chip visible | Visual: `chip--map-overlay-switcher` renders at top-left with text `ทุก delivery ▾` |
| AC-2: switcher panel opens | Click chip → `panel--map-overlay-switcher` renders; contains segmented + filter + epic list |
| AC-3: select epic → scene narrows | Click epic button → `scope=epic&epic=X` in URL; console confirms `engine.setScope` called with role subset; agent elements at `opacity: 0.18` for out-of-scope roles |
| AC-4: scene narrows visually | Inspect DOM: `.scout` elements for irrelevant roles have `style.opacity="0.18"` |
| AC-5: ‹ Overview returns | Click `btn--scope-back-overview` → `scope=all` in URL; all `.scout` opacity cleared |
| AC-6: Progress panel Trail + orbs | `panel--map-overlay-epic-progress` shows 5 trail nodes + 4 orbs; numbers match `buildTrail` output |
| AC-7: Progress empty state | Mock epic with 0 stories → `ยังไม่มีสตอรีใน epic นี้` in panel |
| AC-8: Up Next list | `panel--map-overlay-epic-upnext` lists queued stories (`item--upnext-{id}`) |
| AC-9: Up Next empty | Mock all stories active/done/awaiting → `— คิวว่าง` |
| AC-10: Board 5 columns | `panel--map-overlay-epic-board` renders `col--board-*` × 5; active card has green border; `ovl-you-badge` on awaiting |
| AC-11: deep-link restore | Load `/status/map?scope=epic&epic=X` → scope state = epic, activeEpic = X |
| AC-12: URL updates on change | Switch scope → URL param changes without page navigation |
| AC-13: group toggle | Click Persona segmented → `group=persona` in URL |
| AC-14: efilter toggle | Click กำลังทำ → `efilter=prog` in URL; list filters to `bucket === "prog"` epics |
| AC-15: Esc/click-outside | Inherited from `<Overlay>` primitive (already tested in S4) |

## Numbers parity check (reason only, no fabricated measurements)

`buildTrail` is a pure function imported directly from `lib/status-derive.ts` into `campsite-overlays.tsx`. The same function is imported into `app/status/page.tsx` for the `renderEpic` view. Both receive stories from the same `EpicNode.stories` array (projected via `page.tsx`'s `buildEpicStories`). The `storyAsIssue` adapter reconstructs the `[role]` title tag so `stageOf` produces the same stage classification. Therefore Trail node counts and orb counts on the map MUST match `/status` for the same epic. This can be verified by side-by-side comparison on Staging.

## Empty states to verify on Staging

- Project with no epics → switcher panel shows `ยังไม่มี epic ในโปรเจกต์`
- Epic with 0 stories → Progress panel `ยังไม่มีสตอรีใน epic นี้`; Board `ยังไม่มีสตอรีใน epic นี้`; Up Next `— คิวว่าง`
- All stories active/done/awaiting → Up Next `— คิวว่าง`
- Filter shows no matches → `ไม่มี epic ที่ตรงกับตัวกรอง`

## A11y to verify

- Tab into switcher chip → focus ring visible (2px solid rgba(91,233,176,.8))
- Tab through epic list → each `ovl-epic-item` button is focusable; Enter selects
- Segmented `Feature | Persona`: `role="tablist"` + `role="tab"` + `aria-selected` visible in DOM
- Filter buttons: `aria-pressed` attribute updates on click
- All open panels: focus moves into panel; Tab wraps; Esc closes + focus returns to chip
- Tap targets ≥ 44px: all buttons have `min-height: 44px` or `min-height: 36px` (internal ops; 36px filter buttons are acceptable at this scope per the wireframe)

## Regression

- `npm test` 2282 tests pass (no new test files for S5 — logic is pure + already covered by `lib/status-derive.ts` tests in the existing suite)
- `/status` page unchanged — no modifications outside `app/status/map/`
