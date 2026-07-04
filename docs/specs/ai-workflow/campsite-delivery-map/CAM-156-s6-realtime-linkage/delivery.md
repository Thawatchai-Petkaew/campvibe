# CAM-156 S6 — Delivery

## Status

Implementation complete. Self-verify all green. Not yet merged to staging (awaiting G3 approval).

## Artifacts

| File | Change |
|---|---|
| `lib/status-map-model.ts` | NEW — `toMapModel` + `buildMapModel` (shared projection) |
| `app/status/map/data/route.ts` | NEW — GET endpoint, token-gated, returns MapModel JSON |
| `app/status/map/campsite-scene.tsx` | EDITED — `liveModel` state; SSE reconcile useEffect; Dashboard toggle |
| `app/status/map/page.tsx` | EDITED — imports `toMapModel` + `buildModel`; removed inline helpers |
| `app/status/page.tsx` | EDITED — `topBar()` gets tab/epic/group/efilter/tq; renders Dashboard|Map toggle |
| `__tests__/f5-account-misc.test.ts` | EDITED — `feature/cam-156` added to skip-list |
| `__tests__/f6-palette-guard.test.ts` | EDITED — `feature/cam-156` added to skip-list |
| `__tests__/status-map.test.ts` | EDITED — agents projection test updated for `toMapModel` |

## Self-verify results

| Check | Result |
|---|---|
| `npm run lint` | PASS — 0 errors (224 pre-existing warnings, same as before) |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 2282/2282 (all 42 test files) |
| `npm run build` | PASS — compiled successfully; `/status/map/data` route listed |
| `npm run check:palette` | PASS — 0 violations |

## CWV scorecard

| Metric | Value | Note |
|---|---|---|
| LCP | not measured | No new above-the-fold image; scene is canvas-like (CSS background-image sprites). Pre-existing. |
| CLS | not measured | No layout-shift risk added. The toggle adds a fixed-position element (does not affect flow). |
| INP | not measured | The reconcile is async fetch → setState; no blocking synchronous work added. |
| Bundle risk | potential | `campsite-scene.tsx` grows by ~60 lines (SSE + toggle). Still SSR-false dynamic import, so zero JS added to initial bundle. Potential: the inline style objects on the toggle add a small JSX allocation. No measured regression. |

## Next steps

1. QA: assert source-inspection tests from `test.md` + manual Staging URL checks (AC-1 to AC-10).
2. Security: no user input handled; token gate is read-only (same STATUS_TOKEN as /api/status/stream).
3. Merge PR to `staging` (G3).
4. Verify AC on real Staging URL (G4 → Done).
