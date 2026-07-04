---
linear: CAM-260
feature: status-map-ux
epic: status-map-ux
persona: Owner
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-06-29
---
# Test — CAM-260 Responsive HUD polish regression guard

## AC→test matrix

| AC | test-id | layer | test file | pass/fail |
|---|---|---|---|---|
| AC-1: .hud-topbar overflow guard (box-sizing + max-width + overflow) | section--cam260-topbar-overflow | unit/source | `__tests__/status-map-responsive.test.ts` | pass |
| AC-1a: box-sizing:border-box in .hud-topbar rule | section--cam260-topbar-overflow | unit/source | same | pass |
| AC-1b: max-width:100vw in .hud-topbar rule | section--cam260-topbar-overflow | unit/source | same | pass |
| AC-1c: overflow:hidden in .hud-topbar rule | section--cam260-topbar-overflow | unit/source | same | pass |
| AC-1d: all three guards co-exist in same block | section--cam260-topbar-overflow | unit/source | same | pass |
| AC-2: header can shrink (flex:0 1 auto + min-width:0, NOT flex:none) | section--cam260-topbar-shrink | unit/source | same | pass |
| AC-2a: .hud-topbar-right is flex:0 1 auto | section--cam260-topbar-shrink | unit/source | same | pass |
| AC-2b: .hud-topbar-right has min-width:0 | section--cam260-topbar-shrink | unit/source | same | pass |
| AC-2c: NOT flex:none (old blocking value gone) | section--cam260-topbar-shrink | unit/source | same | pass |
| AC-2d: .hud-topbar-spacer is flex:1 1 0 + min-width:0 | section--cam260-topbar-shrink | unit/source | same | pass |
| AC-3: filter inset — --hud-inset-sm on both sides, NOT left:0/right:0/width:100% | section--cam260-filter-inset | unit/source | same | pass |
| AC-3a: left uses --hud-inset-sm token | section--cam260-filter-inset | unit/source | same | pass |
| AC-3b: right also uses --hud-inset-sm (≥2 occurrences) | section--cam260-filter-inset | unit/source | same | pass |
| AC-3c: width:auto, NOT width:100% | section--cam260-filter-inset | unit/source | same | pass |
| AC-3d: NOT left:0 (edge-to-edge old pattern) | section--cam260-filter-inset | unit/source | same | pass |
| AC-4: filter pill ends 999px radius | section--cam260-filter-pills | unit/source | same | pass |
| AC-4a: first chip border-radius:999px 0 0 999px | section--cam260-filter-pills | unit/source | same | pass |
| AC-4b: last chip border-radius:0 999px 999px 0 | section--cam260-filter-pills | unit/source | same | pass |
| AC-5: filter tap target min-height:44px | section--cam260-filter-target | unit/source | same | pass |
| AC-5a: min-height:44px present | section--cam260-filter-target | unit/source | same | pass |
| AC-5b: min-height:30px absent (old below-target value) | section--cam260-filter-target | unit/source | same | pass |
| AC-6: toolbar overflow guard mobile + tablet parity | section--cam260-toolbar-guard | unit/source | same | pass |
| AC-6a: mobile box-sizing:border-box | section--cam260-toolbar-guard | unit/source | same | pass |
| AC-6b: mobile max-width:100% | section--cam260-toolbar-guard | unit/source | same | pass |
| AC-6c: mobile --hud-inset-sm inset | section--cam260-toolbar-guard | unit/source | same | pass |
| AC-6d: tablet block (640–1023px) exists (new for CAM-260) | section--cam260-toolbar-guard | unit/source | same | pass |
| AC-6e: tablet box-sizing:border-box | section--cam260-toolbar-guard | unit/source | same | pass |
| AC-6f: tablet max-width:100% | section--cam260-toolbar-guard | unit/source | same | pass |
| AC-6g: tablet --hud-inset-sm inset | section--cam260-toolbar-guard | unit/source | same | pass |
| AC-6h: tablet > * min-width:0 | section--cam260-toolbar-guard | unit/source | same | pass |
| AC-6i: mobile > * min-width:0 | section--cam260-toolbar-guard | unit/source | same | pass |
| AC-7: icons — Users imported, AlignJustify absent, ChevronUp absent | section--cam260-icons | unit/source | same | pass |
| AC-7a: Users imported from lucide-react | section--cam260-icons | unit/source | same | pass |
| AC-7b: AlignJustify NOT imported | section--cam260-icons | unit/source | same | pass |
| AC-7c: ChevronUp NOT referenced anywhere | section--cam260-icons | unit/source | same | pass |
| AC-7d: Users actually rendered in ทีม button | section--cam260-icons | unit/source | same | pass |
| AC-8: desktop untouched | section--cam260-desktop-guard | unit/source | same | pass |
| AC-8a: (min-width:1024px) still hides toolbar | section--cam260-desktop-guard | unit/source | same | pass |
| AC-8b: (min-width:1024px) still hides edge tabs | section--cam260-desktop-guard | unit/source | same | pass |
| AC-8c: ViewToggle hidden on mobile/tablet | section--cam260-desktop-guard | unit/source | same | pass |
| AC-9: --hud-inset-sm defined in globals.css | section--cam260-token | unit/source | same | pass |
| AC-9a: globals.css has --hud-inset-sm: 12px | section--cam260-token | unit/source | same | pass |
| AC-9b: scene uses var(--hud-inset-sm,12px) | section--cam260-token | unit/source | same | pass |
| AC-9c: overlays uses var(--hud-inset-sm,12px) | section--cam260-token | unit/source | same | pass |
| AC-10: compact capsule ≤420px — lane words hidden, dots shown | section--cam260-capsule-compact | unit/source | same | pass |
| AC-10a: .env-lane-word{display:none} at ≤420px | section--cam260-capsule-compact | unit/source | same | pass |
| AC-10b: .env-lane-dot{display:inline-block} at ≤420px | section--cam260-capsule-compact | unit/source | same | pass |
| AC-10c: .env-lane-word base rule shown by default | section--cam260-capsule-compact | unit/source | same | pass |
| AC-10d: .env-lane-dot base rule present (hidden by default) | section--cam260-capsule-compact | unit/source | same | pass |

## Validation cases

### Defect A (header overflow)
- normal: all 3 guards present together in .hud-topbar block
- boundary: .hud-topbar-right can shrink (flex:0 1 auto, not flex:none)
- error/validation: removal of any one guard turns the corresponding test red

### Defect B (edge-to-edge angular filter)
- normal: filter row uses --hud-inset-sm on both sides
- boundary: pill ends use 999px (not angular 8px)
- error/validation: left:0 in the base rule turns the NOT-left:0 test red
- boundary: tap target at exactly 44px (not 30px)

### Defect C (cramped toolbar)
- normal: mobile block has all 3 structural guards
- boundary: tablet block (640–1023px) exists AND has the same guards (parity)
- error/validation: removing the tablet block causes AC-6d to fail with -1

### Icon contract
- normal: Users imported and rendered in ทีม button
- error/validation: AlignJustify or ChevronUp present → NOT assertions fail

### Desktop unchanged
- normal: (min-width:1024px) toolbar hidden rule still present
- error/validation: removing the rule causes AC-8a to fail

### Token
- normal: --hud-inset-sm defined in globals.css and referenced by both files
- error/validation: removing the token definition from globals.css → AC-9a fails

## Coverage

Source-inspection tests (same methodology as existing CAM-176/CAM-201 tests).
These tests read file source as strings and assert CSS/markup contracts — they
do not invoke runnable JS so V8 coverage does not apply. Coverage metric: all
9 ACs are covered with a 1:1 test-to-assertion mapping (39 assertions total).
New code is the test file itself (no production code added by QA).

## Links
`design.md` (CAM-260) · `.claude/rules/qa.md`

## Changelog
- v1 (2026-06-29) — created: 39 source-contract regression tests for CAM-260 defects A/B/C
