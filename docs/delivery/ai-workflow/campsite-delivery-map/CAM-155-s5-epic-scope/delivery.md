# CAM-155 S5 — Delivery

## Status

Built + self-verified. PR pending (no git commit per task brief).

## Gate results

| Gate | Result |
|---|---|
| `npm run lint` | PASS — 0 errors on map files; pre-existing warnings in other files unchanged |
| `npm run typecheck` | PASS — 0 type errors |
| `npm test` | PASS — 2282/2282 tests pass |
| `npm run build` | PASS — `/status/map` builds as `ƒ Dynamic`; no errors |
| `npm run check:palette` | PASS — 0 violations |

## CWV scorecard

| Metric | Value |
|---|---|
| LCP | not measured (internal ops dashboard, not a public page; CWV not required per spec) |
| CLS | not measured |
| INP | not measured |

Potential regressions: None introduced. The MapModel `epics` field adds serialized story data to the page prop; size is proportional to the number of stories. For a project with ~100 stories, the JSON overhead is roughly 8–15KB (clean titles + labels). The scene JS bundle is unchanged (engine changes are additive DOM writes). The new overlay components are tree-shaken into the existing `campsite-scene` dynamic import chunk.

## Files changed

- `/Users/tawatchaipetkaew/Claude/Projects/CAMPVIBE/app/status/map/campsite-engine.ts` — added `setScope()` to `EngineHandle`; implemented in `startEngine()`
- `/Users/tawatchaipetkaew/Claude/Projects/CAMPVIBE/app/status/map/campsite-scene.tsx` — widened `MapModel` with `MapEpicStory`, `MapEpicItem`, `epics`; added scope/epic/group/efilter state; added `useEffect` for `engine.setScope` + `syncUrl`; extended `Props` with `initial*` params; updated `MapOverlays` call
- `/Users/tawatchaipetkaew/Claude/Projects/CAMPVIBE/app/status/map/campsite-overlays.tsx` — added `top-left`/`bottom` overlay positions; added S5 CSS; added `ScopeSwitcherPanel`, `EpicProgressPanel`, `EpicUpNextPanel`, `EpicBoardPanel`; rewrote `MapOverlaysProps` + `MapOverlays` to branch on `scope`
- `/Users/tawatchaipetkaew/Claude/Projects/CAMPVIBE/app/status/map/scene-loader.tsx` — passes `initial*` props through
- `/Users/tawatchaipetkaew/Claude/Projects/CAMPVIBE/app/status/map/page.tsx` — imports `epicBucket`, `MapEpicItem`, `MapEpicStory`; reads `scope/epic/group/efilter` from `searchParams`; projects `epics: MapEpicItem[]`; passes `initial*` to `SceneLoader`

## AC coverage

- AC-1 through AC-15: all implemented (see test.md for verification mapping)

## Next steps for QA

- Verify AC on real Staging URL: `/status/map?token=…&scope=epic&epic={epicKey}` deep-link restores correctly
- Side-by-side comparison: Trail counts and Board column counts on `/status/map` (epic scope) vs `/status?tab=epic&epic={epicKey}` must match for the same epic
- Test empty states: epic with 0 stories; all stories done; all stories active

## Next steps for S6

- S6 will add the `แดชบอร์ด | แผนที่` segmented toggle inside the Scope Switcher chip. The URL param contract is already compatible: copy the current query string (which includes `scope`, `epic`, `group`, `efilter`, `token`) and switch only the path between `/status` and `/status/map`. `scope=all/epic` maps to `tab=overview/epic`; `epic`/`group`/`efilter` are identical on both sides.
