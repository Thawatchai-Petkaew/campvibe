# S4 — Delivery

## Status

Built and self-verified. PR pending (G3 gate — human approval before merge into `staging`).

## Files created / edited

### New
- `app/status/map/campsite-overlays.tsx` — `<Overlay>` primitive + `DeliveryPanel` + `CrewPanel` + `EnvPanel` + `BacklogPanel` + `GatesPanel` + `MapOverlays` root (~400 lines)
- `docs/delivery/ai-workflow/campsite-delivery-map/CAM-154-s4-overview-overlays/` — story/design/tech/test/delivery docs

### Edited
- `app/status/map/campsite-scene.tsx` — widened `MapModel` interface (added `MapGate`, `MapBacklogItem`, `MapEnvItem`, overlay fields); added `openOverlay` state + `useCallback` open/close; renders `<MapOverlays>`; converted `you-alert` from `div` to `button`; removed `map-stat-bar` HTML/CSS (replaced by Delivery chip)
- `app/status/map/page.tsx` — widened `mapModel` projection to include `gates: MapGate[]`, `backlogItems`, `envLanes`, `epicsActive`, `totalEpics`; imports `epicOf` from `status-model`, `MapGate`/`MapBacklogItem`/`MapEnvItem` from `campsite-scene`

## Self-verify

```
npm run lint      → PASS (0 errors in new/edited files; pre-existing warnings in other files untouched)
npm run typecheck → PASS (0 errors)
npm run build     → PASS (/status/map renders ƒ dynamic)
npm run check:palette → PASS (0 violations)
```

## CWV scorecard

| Metric | Result |
|---|---|
| LCP | not measured (no browser run in this session) |
| CLS | not measured |
| INP | not measured |

Potential risks to flag to QA:
- Panel content is rendered via React state toggle — no layout shift expected (fixed-position panels).
- OVERLAY_CSS is injected via `dangerouslySetInnerHTML` inside the client component — no separate CSS file, no additional network request.
- No images added in S4.
- JS bundle impact: one new client-side file `campsite-overlays.tsx` added to the `/status/map` lazy bundle. Build output shows `/status/map` still builds without error. Actual gzipped size: not measured in this session.

## Next

- G3 (PR review + merge to `staging`) — human gate.
- QA: verify AC rows 1–14 on real Staging URL per `test.md`.
- S5: Epic overlay, scope switcher full list, Progress/Up-next/Board panels.
