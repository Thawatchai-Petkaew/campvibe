---
linear: CAM-664
feature: Camp detail and spot booking
epic: Pitch viewer + mobile booking bar
persona: CAMPER
artifact: test
owner: qa-engineer
status: In Progress (blocked — CAM-671 open)
version: v1
updated: 2026-07-29
---
# Test — CAM-664 spot-viewer verification (real-browser regression pass)

No `story.md`/AC table exists for CAM-664 in `docs/specs/` (the story was built and merged directly from the ticket body). The 6 verification items in this dispatch are the source of truth for this matrix, each mapped 1:1 to a real-browser or unit test — never source-inspection only for a behavioral claim.

## AC→test matrix

| Item | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| 1. Empty-image dominant state (bg-muted, ImageIcon, Thai aria-label, identical box) | H | e2e | `e2e/regression/cam-664-spot-viewer.spec.ts` › `[section--spot-viewer-empty-image-dominant]` | ✅ |
| 1b. `pickSpotDisplayImage` priority + null/empty/boundary | H | unit | `__tests__/cam-664-spot-display-image.test.ts` (pre-existing, verified against current source) | ✅ |
| 2. CLS ≈ 0 across pitch switches (panorama/multi-photo/one-photo/no-image/long-name) | H | e2e | `e2e/regression/cam-664-cls-and-overlap.spec.ts` › `[section--spot-viewer-cls-on-switch]` | ✅ |
| 3. PER_SITE + PER_PERSON keep their own unit word simultaneously (ADR-014 money-bug shape) | H | e2e | `e2e/regression/cam-664-spot-viewer.spec.ts` › `[row--spot-strip-price-unit-independent]` | ✅ |
| 3b. Booked pitch still renders normally | M | e2e | `e2e/regression/cam-664-spot-viewer.spec.ts` › `[tab--spot-strip-booked-pitch-still-renders]` | ✅ |
| 4. 360px: strip scrolls, ≥44px tap floor, body never scrolls sideways (camper/guest) | H | e2e | `e2e/regression/cam-664-spot-viewer.spec.ts` › `[tablist--spot-strip-360-tap-floor]` (guest context) | ✅ |
| 4b. Same AC for a HOST viewing their own camp | H | e2e | `e2e/regression/cam-664-spot-viewer.spec.ts` › `[section--cam671-host-header-row-overflow]` (`test.fail()` — CAM-671, defect, see below) | ❌ expected-red |
| 5. Roving tabindex: arrows move focus only, Home/End jump, Enter/Space activates, arrowing fires 0 image requests | H | e2e | `e2e/regression/cam-664-spot-viewer.spec.ts` › `[tablist--spot-strip-keyboard-roving]` | ✅ |
| 6. CAM-669 chat launcher clears the sticky booking bar (measured gap) | H | e2e | `e2e/regression/cam-664-cls-and-overlap.spec.ts` › `[section--cam669-chat-clears-bar]` | ✅ |
| 6b. No-bar route unaffected (`--bottom-bar-height` stays 0px default) | M | e2e | `e2e/regression/cam-664-cls-and-overlap.spec.ts` › `[section--cam669-no-bar-unaffected]` | ✅ |
| Real wiring — panorama expand opens the real pan-strip viewer | M | e2e | `e2e/regression/cam-664-spot-viewer.spec.ts` › `[btn--spot-viewport-expand-panorama]` | ✅ |
| Real wiring — photo expand opens the real gallery at its own index | M | e2e | `e2e/regression/cam-664-spot-viewer.spec.ts` › `[btn--spot-viewport-expand-photo]` | ✅ |
| Source-level: tab grammar, roving-tabindex arithmetic, price/unit expression, StickyActionBar shape, CampgroundDetailClient wiring, i18n keys | M | unit | `__tests__/cam-664-spot-viewer.test.ts` (pre-existing, verified against current source — 46 cases) | ✅ |

## Validation cases

- **Item 1 (empty image, DESIGN.md CAM-539):** `bg-muted` + whole `ImageIcon` (never an "off"/error glyph) + `role="img"` + Thai `aria-label` = `translations.th.campground.noImageAlt` = `"ไม่มีรูปภาพแคมป์"` (verbatim, no em-dash) — asserted on TWO independently-seeded no-image pitches (a synthetic demo pitch + the seed's real sibling), and the box dimensions equal the photo-pitch box exactly (width + height, real `boundingBox()`).
- **Item 3 (ADR-014):** PER_SITE reads `common.night` ("คืน"); PER_PERSON reads `common.priceUnitLabel.PER_PERSON` ("ต่อคน/คืน"). Because "ต่อคน/คืน" itself contains the "คืน" substring, the PER_SITE card is ALSO asserted to **not** contain the distinctive `"ต่อคน"` fragment — closing the containment-overlap gap a naive `toContainText` pair would miss. Checked before selection, after selecting PER_PERSON, and after reverting to PER_SITE.
- **Item 5:** a real `page.on("request")` listener counts `/next/image` + unsplash image requests; arrowing across all 10 live pitches (a full wrap) fires exactly 0 new ones; `aria-selected`/viewport `img[src]` are provably untouched by arrow-only navigation; Enter on the newly-focused (last) tab activates it for real.
- **Item 6:** the CAM-669 fix lives on an **inner** wrapper `<div>` inside the launcher's outer `.fixed.bottom-10.right-6` div — a CSS `transform` on a child does not move the PARENT's own layout box. An early draft of this test measured the OUTER div and reported a false 21px "overlap"; the corrected test measures the actually-painted inner div (verified live: `matrix(1,0,0,1,0,-61)`, matching the measured `--bottom-bar-height: 61px`) and finds a real 40px clearance gap, 0px overlap.

## Coverage

- New unit-test-relevant production code touched by this dispatch: none (QA does not write production code). The two `__tests__/*.test.ts` files are pre-existing (shipped with the CAM-664 feature commit, `31478aa`) and were verified line-by-line against the current `dev`-tip source during this pass — all 58 cases pass.
- e2e (Playwright, real browser + real seeded throwaway DB): 12/12 pass (11 genuine passes + 1 `test.fail()` expected-red guard for the already-filed CAM-671 defect).
- Coverage % on new code: **not measured** — this dispatch added zero new production code (QA scope); the deliverable is test files only, so a vitest `--coverage` diff-percentage is not a meaningful number here.

## Measured numbers (real run, not estimated)

- CLS across 6 pitch switches (panorama → multi-photo → one-photo → no-image → real-sibling-no-image → multi-photo): **0**
- Spots section height: **656.875px** before and after switching (no shift)
- `--bottom-bar-height` (published by `StickyActionBar`): **61px**
- Chat launcher (real painted box, inner transformed wrapper): `y=651, height=48` → bottom edge `y=699`
- Sticky booking bar: `y=739`
- Measured overlap: **0px** · measured vertical clearance gap: **40px**
- Guest-view 360px page: `document.documentElement.scrollWidth = 360` = `clientWidth` (no sideways scroll)
- Host-view 360px page (CAM-671 repro): `scrollWidth = 408` vs `clientWidth = 360` (48px overflow) — confirmed, matches the already-filed ticket's numbers exactly

## Defect found (already filed, verified reproducible — not fixed by QA)

**CAM-671** — *Host header action row overflows sideways on the camp detail page at 360px* (Backlog, `role=frontend-engineer`, severity Important). Re-reproduced independently in this pass on the CAM-664 verification camp (`scrollWidth=408` vs `clientWidth=360`, identical to the ticket's own repro). Root cause: `components/CampgroundDetailClient.tsx`'s owner-only header action row (`Edit campground` + `Share` + `Wishlist` = ~384px content, no `flex-wrap`) only renders its 3rd child when `isOwner=true`, overflowing a 312px box. The spot viewer itself is innocent — confirmed by the GUEST-persona AC-4 test passing cleanly (`scrollWidth=360`). No new sub-ticket filed (CAM-671 already exists with a matching repro); `test.fail()` on `[section--cam671-host-header-row-overflow]` keeps a live regression guard that will flag ("unexpected pass") the moment CAM-671 ships.

## Environment note (Playwright gotcha, not a product defect)

`browser.newContext()` inherits the `regression` project's configured `use.storageState` (the shared host session) **even when no `storageState` option is passed** — verified live (a fresh, unqualified `browser.newContext({ viewport })` already carried `authjs.session-token` before any navigation). A true guest/unauthenticated context in this project requires explicitly passing `storageState: { cookies: [], origins: [] }`. This is now documented inline in `cam-664-spot-viewer.spec.ts`'s guest-view test for future authors of a guest-context test in this suite.

## Links

`e2e/regression/cam-664-seed.ts` (throwaway-DB seed, reuses `scripts/seed-demo-spots.mjs`'s exported plan builder) · `.claude/rules/qa.md` · CAM-671 (ticket DB)

## Changelog

- v1 (2026-07-29) — created; full real-browser pass against a throwaway local DB (`campvibe_e2e_cam664v`); CAM-671 confirmed still open and reproducible.
