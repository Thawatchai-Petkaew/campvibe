---
linear: CAM-181
feature: ai-workflow
epic: ai-delivery-workflow-the-camper
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-06-25
---
# Test — หิ่งห้อยวูปวาบ บน /status/map campfire scene (CAM-181)

## Test file

`__tests__/cam-181-fireflies.test.ts` — source-inspection guard (Vitest, node-only).

## AC → test matrix

| AC# | Description | test-id (describe › it) | Layer | Pass/Fail |
|---|---|---|---|---|
| AC-1 | `.firefly-layer` has `pointer-events:none` | `CAM-181 — .firefly-layer CSS › AC-1: .firefly-layer has pointer-events:none` | unit | PASS |
| AC-1 | `.firefly-layer` has `z-index:35` (in front of scout-layer z-30, owner choice) | `CAM-181 — .firefly-layer CSS › AC-1: .firefly-layer has z-index:35` | unit | PASS |
| AC-1 | Layer carries `aria-hidden="true"` (decorative) | `CAM-181 — firefly layer JSX markup › AC-1: layer has aria-hidden='true'` | unit | PASS |
| AC-1 | `firefly-layer` div appears AFTER scout-layer closing `</div>` in JSX | `CAM-181 — z-index depth: firefly-layer after scout-layer in JSX › firefly-layer div appears AFTER the closing </div>` | unit | PASS |
| AC-1 | `.scout-layer` has `z-index:30` in SCENE_CSS (confirms 35 > 30) | `CAM-181 — z-index depth › scout-layer has z-index:30 in SCENE_CSS` | unit | PASS |
| AC-2 | Exactly **12** `.firefly` span instances (owner chose density-B: 12) | `CAM-181 — firefly layer JSX markup › AC-2: exactly 12 .firefly span elements are present` | unit | PASS |
| AC-3 | `@keyframes fireflyTwinkle` defined in `SCENE_CSS` | `CAM-181 — .firefly-layer CSS › AC-3: @keyframes fireflyTwinkle is defined in SCENE_CSS` | unit | PASS |
| AC-3 | Keyframe uses `opacity:0` and `opacity:0.9` (opacity-only twinkle) | `CAM-181 — .firefly-layer CSS › AC-3: fireflyTwinkle uses opacity only (0 → 0.9 → 0)` | unit | PASS |
| AC-4 | `@keyframes fireflyTwinkle` wrapped inside `@media (prefers-reduced-motion: no-preference)` | `CAM-181 — .firefly-layer CSS › AC-4: prefers-reduced-motion:no-preference wraps the twinkle animation` | unit | PASS |
| AC-4 | Base `.firefly` rule (outside media query) sets `opacity:0.3` — faint static reduced-motion fallback | `CAM-181 — .firefly-layer CSS › AC-4: .firefly default (outside media query) has opacity:0.3` | unit | PASS |
| AC-5 | Each `.firefly` span carries `aria-hidden="true"` (no AT noise) | `CAM-181 — firefly layer JSX markup › AC-5: each .firefly span carries aria-hidden='true'` | unit | PASS |
| AC-5 | No emoji characters inside the firefly layer block | `CAM-181 — firefly layer JSX markup › AC-5: no emoji characters in the firefly layer block` | unit | PASS |
| AC-6 | `data-testid="layer--map-fireflies"` present on layer div | `CAM-181 — firefly layer JSX markup › AC-6: layer has data-testid='layer--map-fireflies'` | unit | PASS |
| AC-8 | `fireflyTwinkle` does NOT contain `transform` or `translate` (twinkle-only, no drift — owner chose motion-A) | `CAM-181 — .firefly-layer CSS › AC-8: fireflyTwinkle does NOT animate transform` | unit | PASS |
| keep-out | Extracts exactly 12 firefly positions from JSX inline styles | `CAM-181 — keep-out zones › extracts exactly 12 firefly positions from JSX` | unit | PASS |
| keep-out | No firefly inside campfire/gift zone (x 43–57 %, y 46–60 %) | `CAM-181 — keep-out zones › no firefly falls inside the campfire/gift keep-out` | unit | PASS |
| keep-out | No firefly in topbar keep-out row (y 0–7 %) | `CAM-181 — keep-out zones › no firefly sits in the topbar keep-out row` | unit | PASS |
| stagger | 12 distinct `--ff-dur` CSS custom property values (out-of-sync blink) | `CAM-181 — stagger › 12 distinct --ff-dur values exist in the firefly layer` | unit | PASS |

Total: **18 tests / 18 pass / 0 fail / 0 skip**

## Owner's four locked choices — verified

| Owner choice | Locked value | Test(s) confirming |
|---|---|---|
| Color | Amber/gold `#FFB454` (color-A) | Source diff shows `background:#FFB454` in `SCENE_CSS`; no alternate hex present |
| Count | **12** fireflies (density-B) | AC-2 test (`exactly 12 .firefly span elements`) + keep-out extraction (`extracts exactly 12 positions`) |
| Motion | Twinkle-only / opacity (motion-A) | AC-3 (opacity:0 / opacity:0.9) + AC-8 (no `transform`/`translate` in keyframe) |
| Depth | z-index **35** in front of scout-layer z-30 (depth-B) | AC-1 (`z-index:35`) + depth order test (layer after scout-layer in JSX) |

## Pointer-events + a11y verdict

- `.firefly-layer` and every `.firefly` span carry `pointer-events:none` — confirmed by AC-1 CSS test.
- Both the layer div and each span carry `aria-hidden="true"` — AC-1 and AC-5 JSX tests confirm.
- No emoji — AC-5 Unicode range test passes.

## Reduced-motion verdict

- `@keyframes fireflyTwinkle` and animated `.firefly` rule are enclosed inside `@media (prefers-reduced-motion: no-preference)` — confirmed by AC-4 test.
- Outside that block, `.firefly` defaults to `opacity:0.3` (faint static dot, no animation) — confirmed by AC-4 fallback test.
- Under `prefers-reduced-motion: reduce` users see 12 faint static amber dots with no flashing. WCAG 2.3.3 safe.

## Keep-out zones verdict

All 12 positions extracted from inline styles (`left`/`top` %):

| ff | left % | top % | In campfire zone (43–57, 46–60)? | In topbar zone (y < 8%)? |
|---|---|---|---|---|
| 1 | 14 | 12 | no | no |
| 2 | 24 | 24 | no | no |
| 3 | 68 | 9 | no | no |
| 4 | 78 | 27 | no | no |
| 5 | 82 | 48 | no | no |
| 6 | 22 | 55 | no | no |
| 7 | 41 | 16 | no | no |
| 8 | 71 | 64 | no | no |
| 9 | 11 | 39 | no | no |
| 10 | 88 | 18 | no | no |
| 11 | 31 | 68 | no | no |
| 12 | 59 | 33 | no | no |

Both keep-out assertions pass.

## Regression / scope confirmation

`git diff staging -- app/status/map/campsite-scene.tsx` is **additive only** (+74 lines, -1 line replacing the closing backtick): new `.firefly-layer` CSS block added to `SCENE_CSS` and new `<div className="firefly-layer">` JSX inserted after `.scout-layer`. Engine, agents, gift wrapper (z-index 1300), modal, reconcile/data logic, and all other source files are unchanged.

Files changed by this story (vs staging):
- `app/status/map/campsite-scene.tsx` — firefly layer CSS + JSX (additive)
- `__tests__/cam-181-fireflies.test.ts` — new guard test (18 assertions)
- `docs/delivery/.../test.md` — this artifact

`app/layout.tsx` has an unrelated OpenGraph metadata change in the working tree (pre-existing, not part of the CAM-181 diff).

## Coverage

New code path: `SCENE_CSS` firefly block (CSS string, no branching logic) + JSX layer (declarative markup, no conditional logic). Source-inspection tests assert every structural property (CSS rules, keyframe contents, JSX attributes, count, positions, stagger values). Coverage for the added code is effectively 100% on all assertable properties. No branch coverage gaps.

## Full suite result (actual run — 2026-06-25)

```
Test Files  48 passed (48)
     Tests  2614 passed (2614)
  Start at  18:25:46
  Duration  1.22s
```

0 failures. 0 flakes. 0 skipped.

## Quality gate results (actual)

- `npm test` — 2614 passed (48 files), 0 fail
- `npm run typecheck` — passed (0 errors)
- `npm run lint` — 0 errors, 246 warnings (all pre-existing tech-debt; 0 new warnings from CAM-181)
- Coverage on new code — effectively 100% (all SCENE_CSS + JSX properties asserted by 18 source-inspection tests; measured structurally, not via v8 line coverage which does not apply to CSS template literals)

## Defects

None.

## Next

Ready to merge → staging. Verify AC on real Staging URL after merge.
