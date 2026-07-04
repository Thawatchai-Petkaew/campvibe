---
linear: CAM-180
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
artifact: test
owner: qa
status: Done
version: v1
updated: 2026-06-25
---
# Test: กล่องของขวัญบนกองไฟ — ยก z-index เหนือตัวละคร + เลื่อนตำแหน่งลงนิด (CAM-180)

## AC → Test Matrix

| AC# | test-id | layer | description | pass/fail |
|-----|---------|-------|-------------|-----------|
| AC#1 | `src--delivery-gift-zindex-literal` | source-inspection | `.delivery-gift-wrapper` contains literal `z-index: 1300` | PASS |
| AC#1 | `src--delivery-gift-zindex-gt-agent-max` | source-inspection | parsed z-index value > 1205 (`Math.round(100*12)+5`); regression at ≤1205 goes red | PASS |
| AC#2 | `src--delivery-gift-top-48pct` | source-inspection | `.delivery-gift-wrapper` `top` value equals `48%` (was `44%`) | PASS |
| AC#3/AC#4 | `src--delivery-gift-wrapper-no-sideeffect` | source-inspection | `position: absolute`, `left: 50%`, `pointer-events: none` unchanged | PASS |

All four CAM-180 guard tests live in:
`__tests__/map-delivery.test.ts` — describe block `CAM-180: .delivery-gift-wrapper z-index > agent max + top position guard`

## Diff-scope Confirmation

`git diff staging -- app/status/map/delivery-gift.tsx`:

```diff
-.  top: 44%;
-.  z-index: 25;
+.  top: 48%;
+.  z-index: 1300;
```

Exactly two CSS values changed in `.delivery-gift-wrapper`. No other lines touched in the file.

`git diff staging -- app/status/map/campsite-scene.tsx`: **empty** — the agent engine z-index formula (`Math.round(pos.y * 12) + 5`) is untouched.

## Test Run Results (actual)

Run: `npm test` — 2026-06-25 18:08:51

| Metric | Value |
|--------|-------|
| Test files | 47 passed / 47 |
| Tests | 2596 passed / 2596 |
| Failures | 0 |
| CAM-180 guards | 4 / 4 PASS |

## Quality Gate

| Check | Result |
|-------|--------|
| `npm test` | 2596 passed, 0 failed |
| `npm run typecheck` | Clean (0 errors) |
| `npm run lint` | 0 errors, 246 warnings (all pre-existing, no new warnings added) |
| Coverage on new code | Source-inspection layer (no new branches in production logic; CSS-only change). Existing unit/integration coverage for `lib/map-delivery.ts` and the source-inspection suite remain ≥80%. |

## Prove-It Record

Each CAM-180 guard test was designed to go red under a regression:

- z-index literal test: reverts `1300` → `25` → `expect(src).toContain("z-index: 1300")` fails.
- z-index > 1205 test: reverts to `25` → `expect(25).toBeGreaterThan(1205)` fails.
- top test: reverts `48%` → `44%` → `expect("44%").toBe("48%")` fails.
- side-effect test: would fail if `position`, `left`, or `pointer-events` were removed from the wrapper rule.

The backend developer's tech.md confirms the fix was built red-then-green against these guards (2596/2596 on the final run).

## Defects

None. No defects found.
