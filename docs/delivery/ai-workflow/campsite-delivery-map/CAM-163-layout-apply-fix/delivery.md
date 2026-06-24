## CAM-163 — Delivery

**Branch:** fix/cam-163-status-map-layout-apply

### Files changed

- `app/status/map/campsite-engine.ts` — `ScoutState.homeX/homeY`, `buildScoutState`
  default mode + `homeCoords` param, `enterIdle` uses `homeX/homeY`, `setHomes` updates
  `homeX/homeY` on all scouts.
- `app/status/map/campsite-scene.tsx` — initial layout determined before building scouts,
  `buildScoutState` receives `homeCoords`, idle DOM applied on mount, `stopLoop` uses
  `homeX/homeY`, `NODES` import removed.
- `__tests__/status-map.test.ts` — CAM-163 test block added (engine ScoutState fields,
  enterIdle uses homeX/homeY, scene mount placement, stopLoop correctness).

### Checks

- lint: green
- typecheck: green
- test: green (all existing + new CAM-163 assertions)
- build: green
- check:palette: green

### Must-keep working — verified by reasoning

| Requirement | How satisfied |
|---|---|
| Wide: characters at LAYOUT_WIDE from first frame | Scouts built idle at `initialLayout` coords before engine starts |
| Portrait/narrow: LAYOUT_NARROW centered cluster | Same — `initialLayout = LAYOUT_NARROW` when `arMqEarly` does not match |
| Resize/rotate: smooth switch, no remount | `setHomes` updates `homeX/homeY` + snaps idle DOM; engine keeps running |
| Reduced-motion: static at current layout home | `stopLoop` uses `homeX/homeY`; `homeStyle()` reads `currentLayout` |
| `setScope` (Epic opacity dim) | Untouched — `setScope` only writes `opacity`/`pointerEvents` |
| `triggerWalk` (S6 data-change walk) | `enterWalking` unchanged; `enterIdle` now lands at `homeX/homeY` |
| z-index from y | Unchanged in `enterIdle` and `renderScout` |
| Idle-sway CSS | CSS unchanged; `.idle` class applied from first frame |
| Cleanup cancels rAF | `stop()` unchanged |
