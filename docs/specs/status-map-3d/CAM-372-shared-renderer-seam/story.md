# CAM-372 — Extract a shared renderer seam for the delivery map (behavior-preserving)

> Epic: CAM-371 — Delivery map as a 3D workroom · Feature: 3D delivery map
> Full design + phase plan: `~/.claude/plans/twinkling-seeking-naur.md` (S1)
> Type: refactor + a thin new control (2D↔3D toggle). Phase 1 of the epic.

## Story

As the **platform** owner watching `/status/map`, I want the delivery map's live data,
overlays, gates, SSE reconcile, and auth lifted into a shared shell with the 2D sprite scene
made a swappable renderer child, so that a future 3D renderer can plug into the exact same live
state without re-deriving or re-wiring any of it — and I get a 2D↔3D toggle to pick the view.

Scope: a behavior-preserving relocation (no change to the 2D experience) + a renderer toggle whose
3D option is a placeholder stub in this story (the real 3D scene is CAM-373 / S2).
Depends on: — (first story of the epic).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The map open in 2D (default) | The page loads | The forest scene with the agent scouts, all HUD panels/filters/gates, exactly as before | No behavior change; `useMapReconcile` drives the same SSE + 15s reconcile; sprites idle-sway then walk on activity | EC-1 |
| AC-2 | The map open | A story's agent becomes active/idle (reconcile) | The matching scout starts walking / rests, unchanged from before | Shell's `activeKey` effect fires `setActivity` once per genuine activity change; unrelated reconcile churn does NOT re-path a mid-walk scout (CAM-176 preserved) | EC-2 |
| AC-3 | The map open on desktop | The user clicks the **3D** segment of the renderer toggle | The renderer switches to the 3D view; the segment shows selected (`มุมมองแผนที่`) | `renderer="3d"` persists to `localStorage` + `?r=3d`; the Canvas3D chunk loads only now (selection-gated); the SSE loop + filters + open modals persist (shell never unmounts) | EC-3 |
| AC-4 | The map in 3D (stub, this story) | The 3D view is shown | A centered placeholder card `กำลังพัฒนามุมมอง 3 มิติ` | Stub reports ready; no `three` bundle loaded; overlays/gates/reconcile still live | AC-3 |
| AC-5 | The map in 3D | The user clicks the **2D** segment | The sprite scene returns exactly as AC-1 | `renderer="2d"`; the reconcile loop was never re-subscribed; a mid-state is preserved | EC-2 |

## Rules

- BR-1: default renderer = 2D. Order of precedence for the initial value: `localStorage["statusmap.r"]`
  (explicit user choice) > `?r` URL param (sanitized: `"3d"` only on exact match, else `"2d"`) > `"2d"`.
- BR-2: the renderer toggle switches the child only; `StatusMapShell` (owning `useMapReconcile`,
  filters, modals) stays mounted — no SSE re-subscribe, no filter/modal reset, across a switch.
- BR-3: the `RendererHandle` contract (`setActivity` / `setScope` / `triggerWalk`) is the ONLY
  coupling between the shell and any renderer; the shell never reaches into an engine/scene directly.
- BR-4: CAM-176 preserved exactly — the activity effect deps stay `[rendererReady, activeKey]`; under
  reduced motion the renderer never reports ready, so `setActivity`/`setScope`+`syncUrl` are skipped
  (same as the old `if (!engine) return`).

## Edge cases

- EC-1: IF `prefers-reduced-motion: reduce` THEN the 2D rAF loop never starts, scouts sit at home
  stations with static labels (unchanged from before the refactor).
- EC-2: IF a reconcile changes only titles/gate-count/backlog (not `activeKey`) THEN no scout re-paths.
- EC-3: IF `localStorage` is unavailable THEN the initial renderer falls back to the `?r`/default (no throw).

## Data

No schema/migration. New client modules only: `map-types.ts` (the 7 `Map*` interfaces + `RendererHandle`),
`use-map-reconcile.ts` (`useMapReconcile`), `campsite-canvas.tsx` (2D renderer), `canvas-3d.tsx` (stub),
`role-config.ts` (`ROLE_DISPLAY`). `campsite-scene.tsx` becomes `StatusMapShell` (default export unchanged).

## Seams & refs

Reuse unchanged: `/api/status/stream` (SSE), `/status/map/data` (reconcile), `toMapModel(buildModel())`,
`isStatusAuthorized`, and every `campsite-overlays.tsx` component + `DeliveryGift`. No new API contract.

## Out of scope

- The real 3D scene (Three.js, GLB characters, animations) → CAM-373 (S2) + S3–S6.
- Repartitioning shell-owned HUD controls' responsive CSS out of the 2D-only `SCENE_CSS` into `HUD_CSS`
  → deferred to S2 (done holistically with the real 3D HUD). Known S1-stub limitation: under the 3D
  stub on mobile, a couple of desktop-only shell controls mis-render; the 2D default is unaffected.

## Self-verify

- `npm run lint` · `npm run typecheck` · `npm test` green (source-grep regression net retargeted to the
  new files; pure-logic tests unchanged); a `renderToStaticMarkup` mount smoke test (Prove-It verified);
  a runtime smoke on a preview server (authed 200 + scene shell + no compile errors; unauth → gate box).
- `next build` verified by CI (worktree symlinked node_modules can't Turbopack-build locally).
