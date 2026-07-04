# CAM-159 Delivery Notes — HUD Redesign

## Status

Build + self-verify complete. Not yet merged to staging (awaiting G3 gate).

## Files changed

- `/Users/tawatchaipetkaew/Claude/Projects/CAMPVIBE/app/status/map/campsite-overlays.tsx` — full rewrite
- `/Users/tawatchaipetkaew/Claude/Projects/CAMPVIBE/app/status/map/campsite-scene.tsx` — ViewToggle import, setScope guard, activeEpicData fallback, old nav removed
- `/Users/tawatchaipetkaew/Claude/Projects/CAMPVIBE/__tests__/status-map.test.ts` — CAM-159 test blocks appended

## AC coverage

| AC | Coverage |
|---|---|
| AC1: Single bottom dock | `dock--hud-overview` + `dock--hud-epic` testids; role="toolbar"; no corner positions in source |
| AC2: Expand panels rise above dock | `ExpandPanel` role=dialog, aria-modal, panelRise animation in reduced-motion guard |
| AC3: Kanban modal | `KanbanModal` with backdrop, 5 columns, metric pills, scale+fade animation |
| AC4: Epic scope no overlap | Single dock; Up-next + Crew both in dock segments; hud-board-btn |
| AC5: setScope non-blank | `roles.length > 0` guard; fallback `engine.setScope("all", [])` |
| AC6: activeEpicData fallback | `activeEpic ? epics.find(...) ?? null : null` guard |
| AC7: View toggle top-center | `ViewToggle` at `top:18px left:50% translateX(-50%)` |
| AC8: Reduced-motion | All animations in `@media (prefers-reduced-motion:no-preference)` blocks |

## CWV scorecard

| Metric | Value |
|---|---|
| LCP | not measured (browser-only) |
| CLS | not measured (browser-only); potential risk: none — dock is fixed-positioned, no layout shift |
| INP | not measured (browser-only); potential risk: minimal — panel open/close is CSS only, no heavy computation |

**Bundle delta (potential):** campsite-overlays.tsx grew from ~1356 lines to ~970 lines net (rewrite consolidates). No new dependencies added. Potential risk: nil beyond prior S7 baseline.

**Potential regressions to flag for QA:**
- Dock horizontal overflow on very narrow (<320px) screens: overflow-x:auto is set but untested in browser.
- Modal max-height:88vh scroll on short screens: overflow-y:auto is set but untested in browser.

## Design gate

- Token-only: internal ops dashboard (app/status/**) exempt from check:palette; HUD_CSS uses same dark-glass palette as existing campsite CSS.
- a11y: dock segments `<button aria-expanded>`, panels/modal `role=dialog aria-modal`, focus-trap, Esc, return-focus, ≥44px all interactive, visible focus ring (`outline: 2px solid rgba(91,233,176,.8)`).
- Anti-slop: numbers derive from model (no hardcoded counts); all empty states have Thai copy verbatim; no placeholder/lorem text.
- Reduced-motion: all transitions gated.

## Next steps

1. QA: verify each AC row on real Staging URL after merge.
2. Security: no user input on this surface (read-only ops dashboard) — no new authz review needed.
3. Browser-only risks (listed above) to be verified in the browser after staging deploy.
