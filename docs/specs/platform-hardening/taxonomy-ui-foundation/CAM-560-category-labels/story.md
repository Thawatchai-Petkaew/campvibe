## Story
As a **Camper**, I want every category tab's label to stay inside its own tab on a phone, so that I can read each category name cleanly and tap the one I mean.
Why: owner-reported and reproduced live in a screenshot at 390×844 — `ลานกางเต็นท์` and `แคมป์ด้วยรถ` render as one run-together string, `ลานกางเต็นท์แคมป์ด้วยรถ`.
Scope: fix `components/CategoryBar.tsx` only — the tab item's flex layout so a label can never render narrower than its own content. No new component; the catalog card (measured 67px clear of its review text, no collision) is not touched.
Depends on: CAM-552 (mobile scale — this fix builds on its `min-w`/`gap`/`px` values, does not undo them)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The Home page category strip is rendered at a 390px-wide viewport | The camper looks at any two adjacent category tabs | Each tab's icon and label (e.g. `ลานกางเต็นท์`, `แคมป์ด้วยรถ`) sit fully inside that tab's own space; no label's glyphs visually overlap a neighboring tab's glyphs | No DOM/state change — this is a rendered-geometry fact, measured as non-overlapping bounding boxes for every pair of adjacent labels | EC-1 |
| AC-2 | Same, at a 320px-wide viewport (the narrowest supported phone width) | The camper looks at any two adjacent category tabs | Same as AC-1 — no two labels overlap, at the narrowest width too | Same | EC-1 |
| AC-3 | The category strip's total content width exceeds the viewport width | The camper swipes/scrolls the strip horizontally | The strip scrolls; the right-most tab may sit partly outside the visible viewport edge until scrolled into view — this is the intended scroll affordance, not a defect | No layout/DOM change; `overflow-x-auto` behavior unchanged | EC-2 |
| AC-4 | Any category tab, at any viewport width | The camper taps a tab | The tap succeeds and the tab's hit area measures at least 44×44px (CAM-552's touch floor) | `buildCategoryUrl` navigates as before (unchanged; BR-1/BR-2 from CAM-529 still hold) | — (baseline behavior, not touched by this fix) |

## Rules
- BR-1 Every category tab item keeps `flex-shrink: 0` (Tailwind `shrink-0`) so the browser can never compress its box narrower than its own label's natural (nowrap) content width. `min-w-[56px]`/`md:min-w-[64px]` remains a FLOOR only, for labels shorter than that floor (`ทะเล`, `ป่า`) — it is not, and must never become, a ceiling that content is squeezed into.
- BR-2 The strip's total content width may legitimately exceed the viewport; when it does, the row scrolls (`overflow-x-auto`, unchanged from CAM-552) rather than shrinking any tab below its content width. Overflow is resolved by scrolling, never by compression.

## Edge cases
- EC-1 IF two adjacent category tabs are both long Thai labels (checked across every pair in the full `CATEGORIES` set — `ทั้งหมด`/`ลานกางเต็นท์`/`แคมป์ด้วยรถ`/`แกลมปิ้ง`/`ชายหาด`/`ทะเล`/`ป่า`/`ภูเขา`/`ริมน้ำ`/`น้ำตก`, not only the two named in the report) THEN their rendered bounding boxes never overlap, at both 320px and 390px (BR-1).
- EC-2 IF the strip's content is wider than the viewport THEN the right-most tab may be partially cut off by the viewport edge as a scroll affordance — this is expected and must NOT be "fixed" into always-fully-visible (BR-2).

## Data
- No schema/data change. Pure client-side layout fix in `components/CategoryBar.tsx`. Migration: none.

## Seams & refs
- Reuse: `components/CategoryBar.tsx` is the one file that owns this tab's layout; no parallel implementation exists. The `shrink-0` fix follows the same precedent already used for another horizontally-scrollable strip in this codebase (`components/CampgroundDetailClient.tsx`'s spot-image thumbnail row uses `flex-shrink-0` on each thumbnail for the identical reason: keep each item at its natural size and let the row scroll instead of compress).
- Root cause (verified by reading the flexbox spec's shrink/min-width interaction, confirmed against the reported screenshot): a flex item's default `min-width` is `auto`, which resolves to the item's own content size for a `white-space: nowrap` label — this is what normally stops flexbox from ever shrinking a non-wrapping label narrower than its own text. CAM-552 added an explicit `min-w-[56px] md:min-w-[64px]` to size short labels consistently, but an EXPLICIT `min-width` overrides that automatic content-based floor. With no `shrink-0`, the default `flex-shrink: 1` was then free to compress each tab down toward the new 56px/64px floor whenever the row's total content exceeded the viewport — which is every render, since 10 tabs never fit a phone screen. `ลานกางเต็นท์` (the longest label, ~12 Thai glyphs) shrank to a box narrower than its own text; the nowrap, unclipped label then visually spilled into the next tab (`แคมป์ด้วยรถ`)'s space, reading as one run-together string.
- Refs: — (no ADR; a scoped component bugfix)

## Out of scope
- The right-most tab being partly cut off by the viewport edge — that is the intended scroll affordance (AC-3/EC-2), not a defect, and is explicitly not changed here.
- Shortening any Thai category label — the fix is a layout fix (`shrink-0`); no label needed to change, so `locales/translations.json` is untouched.
- The catalog card title/review-text spacing — measured clear (67px) and out of scope per the ticket.

## Self-verify
- AC-1/AC-2 → e2e (`e2e/regression/cam-560-category-label-overlap.spec.ts`): real browser, measures each label's bounding box at 320px and 390px viewports and asserts no two adjacent boxes intersect, across every adjacent pair in the full `CATEGORIES` set (not only the reported pair).
- AC-3 → e2e: same spec asserts the strip's `scrollWidth > clientWidth` (still horizontally scrollable) and that scrolling to the end reveals the last tab.
- AC-4 → unit (`__tests__/cam-560-category-label-overlap.test.ts`): source-level assertion that every tappable tab retains `h-11`-equivalent sizing / no floor breach (reuses `findFloorBreaches` from `scripts/check-scale.mjs`, the same guard CAM-552 introduced).
- Story-specific: Prove-It — the e2e spec is written to fail against the pre-fix source (no `shrink-0`) and pass after, per `.claude/rules/qa.md`.
- Gate = `/quality-gate` (lint 0 errors · typecheck clean · full vitest suite green · `check:ds`/`check:palette`/`check:scale` PASS). Done = every AC verified on localhost before merge into `dev`.

## Changelog
- v1 (2026-07-26) — created
