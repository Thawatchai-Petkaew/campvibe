## CAM-163 — Technical: homeX/homeY fix

### Root cause

`enterIdle(ref)` in `campsite-engine.ts` always snapped characters to
`NODES[s.homeNode]` — the old radial compass node coordinates — regardless of what
`setHomes()` had written. The data-flow break:

1. On mount, every scout was in `"entering"` mode (walking the compass graph from an
   arm-tip toward `homeNode`).
2. `setHomes(layout)` ran immediately after mount but only set `s.x / s.y` transiently
   on non-idle scouts; the rAF `stepWalk` overwrote them on the next frame.
3. When the walking scout arrived at `homeNode`, `enterIdle` snapped to
   `NODES[homeNode]` — the old compass coord — ignoring the layout table entirely.

Net: final resting position always = old compass node, never LAYOUT_WIDE / LAYOUT_NARROW.

### Fix

**campsite-engine.ts**

1. Added `homeX: number; homeY: number;` to `ScoutState` — the authoritative resting
   position (% of 1920x1080 canvas), driven by the active layout table.
2. `buildScoutState` accepts optional `homeCoords?: { x: number; y: number }` and
   initializes `homeX/homeY` from it. Default mode changed to `"idle"` so scouts
   start placed at their layout home.
3. `enterIdle(ref)` now snaps to `s.homeX / s.homeY` — NOT `NODES[s.homeNode]`.
4. `setHomes(homes)` updates `homeX/homeY` on ALL scouts (every mode). Idle agents
   also get an immediate DOM snap.

**campsite-scene.tsx**

1. Determine initial layout (via `arMqEarly` matchMedia) BEFORE building `scoutRefs`,
   pass `homeCoords` into `buildScoutState`. Scouts are idle and correctly placed from
   the first frame — no compass entrance walk, no visible position jump.
2. `stopLoop` (reduced-motion / cleanup) uses `s.homeX / s.homeY` instead of
   `NODES[s.homeNode]` so the static fallback also respects the active layout.
3. `onMqChange` (motion re-enable) rebuilds scouts via `buildScoutState` with the
   current `{ x: s.homeX, y: s.homeY }` so no entrance walk on re-enable either.
4. `NODES` import removed from the scene (was only used in the now-fixed `stopLoop`).

### Invariants preserved

- BFS path traversal (`stepWalk`) still uses `NODES` / `ADJ` — the graph is unchanged.
- `triggerWalk(role)` still walks the BFS path; `enterIdle` lands at `homeX/homeY`.
- `setScope` (Epic opacity dim) is untouched.
- `LAYOUT_WIDE` / `LAYOUT_NARROW` coordinate values are unchanged.
- `engineReady` / S7 deep-link scope fix still works.
- Reduced-motion: static at current layout home; switches on aspect change.
