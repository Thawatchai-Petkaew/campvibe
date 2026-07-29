---
linear: CAM-664
feature: Camp detail and spot booking
epic: Pitch viewer + mobile booking bar
persona: CAMPER
artifact: test
owner: qa-engineer
status: In Progress (blocked — CAM-671 open)
version: v3
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

## CI fixture fix (real CI failure, run 30464260329)

The first push passed locally but CI's `e2e-regression` job failed 9/12 specs, all at the identical `waitForSelector('[data-testid="tablist--spot-strip"]')` 15s timeout. Root cause: `cam-664-seed.ts` was a standalone CLI script that nothing in CI ever CALLED — CI's own "Migrate + seed" step runs `prisma migrate deploy && npx tsx prisma/seed.ts` only, never `cam-664-seed.ts`, so the per-pitch camp was silently absent there (present only when a human manually ran the seed locally first).

**Fix (additive, no second seeding mechanism):** `cam-664-seed.ts` now exports `seedCam664Camp(prisma)`; `e2e/regression/global.setup.ts` (the ONE setup step both a local regression run and the CI job already execute via Playwright's `dependencies` mechanism) calls it, right after the BR-1 guard and before login. The CLI `main()` stays for local ad-hoc use, gated on `require.main === module` so importing the module never double-runs it. No CI workflow edit; no change to `scripts/setup-e2e-db.ts`.

**Fixture-isolation check (per the coordinator's explicit ask — "if it would alter any existing spec's fixture, say so and stop"):** Added a NEW, independently-slugged CampSite + its own Zones/Spots via idempotent upsert; grepped every other regression spec for exact-count assumptions on Home/catalog cards — none found (`.first()` selectors throughout). Verified end-to-end against a database seeded EXACTLY the way CI seeds it (`prisma migrate deploy && npx tsx prisma/seed.ts`, no manual `cam-664-seed.ts` call) — the camp appears automatically.

**One real regression found and fixed during this check:** the new camp initially had ZERO CampSite-level gallery images (only per-spot images), which made its Home/catalog card fall into `ImageWithFallback`'s placeholder branch — exposing a PRE-EXISTING, unrelated hydration mismatch in `components/ui/image-with-fallback.tsx` (SSR renders `/placeholder-camp.svg`, client re-renders `/placeholder-camp-dark.svg`, a light/dark theme SSR/CSR divergence, out of this dispatch's file surface to fix). Next.js dev mode's error overlay left a residual `role="dialog"` DOM node on `/`, which broke `cam-561-mobile-search-fullscreen.spec.ts`'s exact-dialog-count assertions (a spec unrelated to CAM-664). Fix: `cam-664-seed.ts` now also gives the camp one real CampSite-level `Image` row — this is not a workaround, it makes the fixture MORE faithful (a real per-spot-eligible camp on staging always has `>=20` of its own gallery photos per `seed-demo-spots.mjs`'s own selection rule, `MIN_CAMP_IMAGES`). Not reported as a new defect ticket (out of scope, low-severity, dev-overlay-only) — noted here for traceability.

**`test.fail()` reporting verified, not assumed:** ran the full regression project with `--workers=1` (matching CI's own `workers: process.env.CI ? 1 : undefined` config exactly) against a database seeded the CI way — 107/107 pass, including `[section--cam671-host-header-row-overflow]` reporting as an expected pass (not a failure) even under this exact configuration.

**Two other apparent failures during debugging were confirmed NOT regressions, not glossed over:**

- `cam-540-dialog-select-dismiss.spec.ts` — a transient artifact from the SAME dev-overlay issue above (resolved by the image fix; confirmed clean on a full fresh run).
- `ac3-logo-roundtrip.spec.ts` — local DB-state pollution from re-running the suite repeatedly against the same persistent throwaway DB during debugging (a prior run's own logo upload never got reset); confirmed clean on a truly fresh DB. Not a CI concern (CI's Postgres service container is ephemeral per run).
- `ac6-spot-lifecycle.spec.ts` — a concurrency artifact from running with the local default (auto/parallel) workers; confirmed clean with `--workers=1`, which is what CI actually uses.

## Links

`e2e/regression/cam-664-seed.ts` (throwaway-DB seed, reuses `scripts/seed-demo-spots.mjs`'s exported plan builder; now exports `seedCam664Camp` for `global.setup.ts`) · `e2e/regression/global.setup.ts` · `.claude/rules/qa.md` · CAM-671 (ticket DB)

## Changelog

- v1 (2026-07-29) — created; full real-browser pass against a throwaway local DB (`campvibe_e2e_cam664v`); CAM-671 confirmed still open and reproducible.
- v2 (2026-07-29) — fixed a real CI failure (run 30464260329): the fixture now seeds via `global.setup.ts` (additive, no second seeding path); found + fixed a fixture gap (camp needed its own gallery image) that was exposing an unrelated pre-existing hydration-mismatch bug; verified `test.fail()` reports correctly under CI's exact `--workers=1` config; 107/107 regression specs pass on a database seeded exactly the way CI seeds it.
- v3 (2026-07-29) — fixed a second real CI failure (run 30467727195, 1 remaining spec red): `feat(cam-666)` (commit 15a6352) merged to `dev` mid-verification and made the mobile `StickyActionBar` (and the desktop widget) stay ABSENT until a pitch is picked (`hasPitchSelection` in `CampgroundDetailClient.tsx`, verified against the current source — the SpotViewer/strip themselves still pre-select the first pitch internally, unchanged). `[section--cam669-chat-clears-bar]` was written against the pre-CAM-666 always-present bar; fixed by selecting a pitch before waiting for the bar. Re-ran the full file + full suite (`--workers=1`, fresh DB seeded the CI way) after merging `origin/dev`: 107/107 pass, geometry assertions unchanged (0px overlap, 40px gap) and kept measuring real bounding boxes.
