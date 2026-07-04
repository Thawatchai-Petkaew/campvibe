---
linear: CAM-180
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
artifact: tech
owner: frontend
status: Done
version: v1
updated: 2026-06-25
---
# Tech: กล่องของขวัญบนกองไฟ — ยก z-index เหนือตัวละคร + เลื่อนตำแหน่งลงนิด (CAM-180)

## Root cause

On `/status/map`, both the walking agents and the gift indicator render inside the same `.scout-layer`
stacking context in `app/status/map/campsite-scene.tsx`.

The agent engine assigns each agent a z-index via:

```ts
Math.round(pos.y * 12) + 5   // pos.y is 0–100 (percent)
```

At the campfire position (y ≈ 44–52%), agents receive z-index ≈ 530–630.
At the absolute maximum (y = 100%), an agent receives z-index = **1205**.

The `.delivery-gift-wrapper` rule in `DELIVERY_GIFT_CSS` had `z-index: 25`, which is below every
agent in the visible campfire band. Agents covered the gift indicator.

The wrapper also had `top: 44%` which the owner observed as visually too high relative to the
campfire centre.

## Fix (two CSS values — no logic changed)

File: `app/status/map/delivery-gift.tsx`, constant `DELIVERY_GIFT_CSS`, rule `.delivery-gift-wrapper`.

| Property | Before | After | Reason |
|---|---|---|---|
| `z-index` | 25 | **1300** | Above agent max (1205); below dev overlays (2000); no impact on HUD (separate stacking context) |
| `top` | 44% | **48%** | Owner-requested visual nudge down toward campfire centre |

All other properties (`position: absolute`, `left: 50%`, `pointer-events: none`) are unchanged.
No changes to `.gift-indicator`, the badge, the modal, or the agent engine's z-index calculation.

## Guard test added

File: `__tests__/map-delivery.test.ts` — new `describe` block `CAM-180: .delivery-gift-wrapper z-index > agent max + top position guard`.

Four assertions:

1. `z-index: 1300` literal is present in `DELIVERY_GIFT_CSS` — catches a copy-paste revert.
2. Parsed z-index value > 1205 (`Math.round(100*12)+5`) — catches any numeric regression below the agent ceiling.
3. `top` value equals `48%` — catches a revert to `44%`.
4. `position: absolute`, `left: 50%`, `pointer-events: none` remain — guards against side-effect edits.

## Files touched

| File | Change |
|---|---|
| `app/status/map/delivery-gift.tsx` | `.delivery-gift-wrapper` z-index 25→1300, top 44%→48% |
| `__tests__/map-delivery.test.ts` | Added CAM-180 guard describe block (4 tests) |
| `docs/delivery/.../tech.md` | This file |

## Self-verify results

| Check | Result |
|---|---|
| `npm run lint` | 0 errors (246 pre-existing warnings, unchanged) |
| `npm run typecheck` | Clean (0 errors) |
| `npm test` | 2596 passed / 47 test files — all green incl. 4 new CAM-180 guards |
| `npm run check:palette` | PASS (0 violations) |
| `npm run check:ds` | PASS (0 violations) |
| `npm run build` | Success — `/status/map` route builds as dynamic server-rendered |
