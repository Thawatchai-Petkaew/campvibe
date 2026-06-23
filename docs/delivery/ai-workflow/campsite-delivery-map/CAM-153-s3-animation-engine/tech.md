# S3 — Tech

## Architecture
- **`app/status/map/campsite-engine.ts`** (new, ~374 lines) — pure TS engine, no React. Exports `NODES`, `ADJ`, `dirFor`, `WALK_SPRITES`, `buildScoutState`, `startEngine`, types `ScoutState`/`ScoutRef`/`EngineHandle`. Ported from the `requestAnimationFrame` engine in `design/campvibe-campsite.html` (`step`/`render`/`loop`/`enterIdle` + eased path traversal + direction→sprite frame swap), with `churn`/`enterWander`/random-rest deliberately **omitted**.
- **`app/status/map/campsite-scene.tsx`** (edited) — mounts the engine in a single `useEffect`; per-agent DOM refs; mutates `style.transform/left/top/zIndex/backgroundImage` directly (no per-frame React setState); `engineRef` holds the `EngineHandle` for S6.

## Hybrid motion enforcement
- **idle-sway** = CSS keyframe `breathe` on `.scout.idle .body`, inside `@media (prefers-reduced-motion: no-preference)`. Always-on, not data-driven, first to die under reduced-motion.
- **walk** = engine moves a scout only in `entering` or `walking` mode. The only transition into walk is (a) entrance on first mount (`buildScoutState` starts `entering` → walks to home station → `enterIdle`), and (b) the public `triggerWalk(role, toNode?)` API (called by S6, not here). No random timer/wander.
- **working** = S2's `working` class + aura/glow CSS preserved.
- Only `transform`/`opacity` (+ `box-shadow` for glow) animate.

## Reduced-motion
`matchMedia('(prefers-reduced-motion: reduce)')`: if matches → never `startLoop()`, render static at home stations (S2 behavior); `addEventListener('change')` starts/stops the loop live; effect cleanup removes listener + `cancelAnimationFrame` (no leak).

## S6 hook
`engineRef.current.triggerWalk(role: string, toNode?: string): void` — role = canonical key (e.g. `frontend-engineer`); `toNode` defaults to home station. S6 calls this when live data changes an agent's state.

## Known risk (browser-only)
Entrance walk speed/smoothness + walk-sprite flash before first load (suggest prefetch in S6/S7). Not measured.
