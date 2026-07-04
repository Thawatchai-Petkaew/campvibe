# S3 — Test / Verify

## Gate (self-verify, all green)
- `npm run lint` — 0 errors (224 pre-existing warnings, none new)
- `npm run typecheck` — clean
- `npm test` — 2282 pass
- `npm run build` — pass

## AC verification
| AC | How verified |
|---|---|
| 1 idle-sway alive | code: `breathe` keyframe under `no-preference`; rAF loop runs |
| 2 entrance walk | code: `buildScoutState` mode `entering` → path traversal → `enterIdle`; walk-* sprites via `dirFor` |
| 3 working state | code: `agent.active` → `working` class + aura |
| 4 reduced-motion static | code: `startLoop()` gated behind `!mq.matches`; live `change` listener |
| 5 no rAF leak | code: effect cleanup → `engine.stop()` → `cancelAnimationFrame` |

## Notes
No new unit tests required by S3 AC (motion is visual/behavioral). Source-inspection coverage of the map route continues via `__tests__/status-map.test.ts`. Visual smoothness = browser/Staging check (owner glance on the token URL).
