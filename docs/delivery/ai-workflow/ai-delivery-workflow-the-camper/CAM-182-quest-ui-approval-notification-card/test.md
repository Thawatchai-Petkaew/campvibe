---
linear: CAM-182
feature: ai-workflow
epic: ai-delivery-workflow-the-camper
persona: platform
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-06-25
---
# Test — Quest UI: Approval Notification + Approval Card (CAM-182)

## AC → Test matrix

Layer: unit (static source inspection via `fs.readFileSync` — no DOM renderer, no JSDOM).
Test file: `__tests__/cam-182-quest-approval-ui.test.ts` (28 tests).

### Owner-locked choices verified

| Choice | Dimension | Expected | Verified |
|---|---|---|---|
| A2 (BellRing) | Notification icon | `BellRing` from lucide-react | pass — import + JSX confirmed |
| B1 (ClipboardCheck) | Approval card icon | `ClipboardCheck` replaces `AlertTriangle` | pass — JSX + import confirmed; AlertTriangle absent |
| C1 (subtle glow) | Card glow intensity | `apprCardGlow` peaks at `0 0 18px rgba(255,160,52,.22)` | pass |
| D1 (amber crown) | Header stripe | amber-only gradient `::before` on `.hud-appr-head` | pass |

### Notification bubble (.you-alert) — campsite-scene.tsx

| AC | test-id | Description | Layer | Pass/Fail |
|---|---|---|---|---|
| AC-notify-1 | alert--you-alert-bellring-import | `BellRing` imported from lucide-react | unit | pass |
| AC-notify-1 | alert--you-alert-bellring-jsx | `<BellRing` rendered in you-alert JSX | unit | pass |
| AC-notify-1 | alert--you-alert-no-glyph | `&#9873;` Unicode glyph absent | unit | pass |
| AC-notify-1 | alert--you-alert-no-adot-div | `className="adot"` DOM div absent | unit | pass |
| AC-notify-2 | alert--you-alert-fontsize | `.you-alert` CSS has `font-size:13px` | unit | pass |
| AC-notify-3 | alert--you-alert-padding | `.you-alert` CSS has `padding:7px 14px` | unit | pass |
| AC-notify-4 | alert--you-alert-ring | box-shadow has `0 0 0 1.5px rgba(255,180,84,.55)` amber ring | unit | pass |
| AC-notify-4 | alert--you-alert-glow | box-shadow has `0 10px 28px -4px rgba(255,150,52,.7)` outer glow | unit | pass |
| AC-notify-5 | alert--you-alert-no-adot-css | `.you-alert .adot` CSS rule absent (no dead CSS) | unit | pass |
| AC-notify-6 | alert--you-alert-no-pdot3 | `pdot3` keyframe absent (no dead animation) | unit | pass |
| AC-notify-7 | alert--you-alert-alertpulse-exists | `alertPulse` keyframe still present | unit | pass |
| AC-notify-7 | alert--you-alert-alertpulse-wired | `.you-alert{animation:alertPulse…}` still present | unit | pass |
| AC-notify-7 | alert--you-alert-alertpulse-gated | `alertPulse` appears after `prefers-reduced-motion: no-preference` @media open | unit | pass |

### Approval card (ApprovalCard / .hud-appr-*) — campsite-overlays.tsx

| AC | test-id | Description | Layer | Pass/Fail |
|---|---|---|---|---|
| AC-card-1 | section--appr-card-clipboardcheck-jsx | `<ClipboardCheck` present in JSX | unit | pass |
| AC-card-1 | section--appr-card-no-alerttriangle-jsx | `<AlertTriangle` absent from all JSX | unit | pass |
| AC-card-2 | section--appr-card-no-alerttriangle-import | `AlertTriangle` absent from lucide-react import | unit | pass |
| AC-card-3 | section--appr-cardglow-keyframe | `@keyframes apprCardGlow` defined | unit | pass |
| AC-card-3 | section--appr-cardglow-amber | keyframe 50% has `rgba(255,160,52,.22)` amber glow | unit | pass |
| AC-card-4 | section--appr-cardglow-reduced-motion-keyframe | `apprCardGlow` keyframe inside `prefers-reduced-motion: no-preference` block | unit | pass |
| AC-card-4 | section--appr-cardglow-reduced-motion-animation | `.hud-appr-card` animation rule inside `prefers-reduced-motion: no-preference` | unit | pass |
| AC-card-5 | section--appr-head-crown | `.hud-appr-head::before` amber gradient present | unit | pass |
| AC-card-5 | section--appr-head-crown-height | crown stripe `height:2px` | unit | pass |
| AC-card-6 | section--appr-card-animation-wired | `.hud-appr-card` has `animation:apprCardGlow` reference | unit | pass |
| AC-card-7 | section--appr-heading-fontsize | `.hud-appr-heading` font-size is `11.5px` | unit | pass |
| AC-card-8 | section--appr-title-fontsize | `.hud-appr-title` font-size is `12.5px` | unit | pass |
| AC-card-9 | section--appr-badge-fontsize | `.hud-appr-badge` font-size is `10.5px` | unit | pass |
| AC-card-10 | btn--appr-min-height | `.hud-appr-btn` has `min-height:44px` | unit | pass |
| AC-card-11 | section--appr-card-border | `.hud-appr-card` has `1.5px solid rgba(255,190,80,.32)` border | unit | pass |

## Coverage matrix

All 28 tests are static source inspection (Vitest unit layer; no DOM renderer). Coverage matrix by AC bucket:

| Bucket | Covered | Justification for any gap |
|---|---|---|
| normal (happy path) | all 28 tests | each AC asserts the expected CSS rule / JSX pattern is present |
| null/empty | n/a | static string inspection — no runtime input/output |
| boundary | n/a | CSS values are discrete (pixel values, rgba strings); exact-match tests cover the specified values |
| error/validation | AC-notify-1, AC-notify-5/6, AC-card-1/2 | "absence" tests verify dead code/wrong icon are gone (the negative cases) |
| concurrent/ordering | n/a | CSS order does not affect static source inspection results |

## Scope / regression check

`git diff staging --stat` (code files only, excluding mockup image deletes and docs):

- `app/status/map/campsite-scene.tsx` — 20 lines changed (BellRing icon, CSS overhaul)
- `app/status/map/campsite-overlays.tsx` — 58 lines changed (ClipboardCheck, HUD_CSS redesign)
- `__tests__/cam-182-quest-approval-ui.test.ts` — new file (28 guard tests)

The `app/layout.tsx` modification in the working tree (OG/Twitter metadata) is an uncommitted pre-existing workspace change — it has no commits on this branch and is not part of the CAM-182 story diff. No engine, data model, API route, lib, or modal file was touched.

## Self-verify results (actual run)

| Check | Result |
|---|---|
| `npm test` (full suite) | 2642 passed (49 files), 0 failed |
| CAM-182 tests specifically | 28 passed (1 file), 0 failed |
| `npm run lint` | 0 errors (246 pre-existing warnings, unchanged) |
| `npm run typecheck` | clean (0 errors) |
| Coverage on new code | not measured via `--coverage` (source-inspection tests assert properties of static strings — line/branch coverage does not apply in the usual sense; the AC contract is 100% covered: all 18 AC items map to at least one passing test) |

## a11y / reduced-motion verdict

- `alertPulse` (notification float) is gated inside `@media (prefers-reduced-motion: no-preference)` — confirmed by AC-notify-7 (pass).
- `apprCardGlow` keyframe and `.hud-appr-card` animation rule are both inside `@media (prefers-reduced-motion: no-preference)` — confirmed by AC-card-4 (pass). Under reduce: static elevated border/shadow holds, no pulse.
- Primary button `min-height:44px` explicit tap floor — confirmed by AC-card-10 (pass).
- Button focus-visible: `outline: 2px solid rgba(91,233,176,.8)` on `.hud-appr-btn:focus-visible` — present in source (not a test AC but confirmed by direct read).

## Defects

None. All 28 tests green. No defect sub-ticket opened.

## Next

Ready to merge → staging. After merge, verify AC on the real Staging URL (campvibe-staging.vercel.app/status/map) with `gates.length > 0` to confirm BellRing renders in the notification bubble, ClipboardCheck in the card heading + CTA button, crown stripe visible, and card glow pulses in browser with prefers-reduced-motion off.

## Changelog

- v1 (2026-06-25) — created; 28 tests, all passing; 4 owner choices verified; no defects
