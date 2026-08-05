---
linear: CAM-672
feature: Camp detail and spot booking
epic: Spot booking — the camper picks a pitch, then sees its price (CAM-660)
persona: CAMPER
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-08-06
---
# Test — CAM-672 the price shown next to Reserve is the price Booking.totalPrice records

No `story.md` exists for CAM-672 in `docs/specs/` (built directly from the ticket body, spec-lite). The ticket's own AC text is the source of truth for this matrix; each clause below is mapped 1:1 to a real-browser test that reads the database directly, never a mocked-Prisma proxy for the claim "the shown price is the recorded price."

## AC→test matrix

| AC (ticket body) | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| Per-pitch camp, PER_SITE pitch (฿400, 1 night) → UI shows ฿400, `Booking.totalPrice=400`, `Booking.spotId`=that pitch | H | e2e | `e2e/regression/cam-672-price-shown-is-price-recorded.spec.ts` › "per-pitch camp, PER_SITE pitch: shows and records a flat 400 regardless of guest count" | ✅ |
| Per-pitch camp, PER_PERSON pitch (฿500 x 3 guests x 1 night = 1500) → UI shows 1500, row records 1500 | H | e2e | same file › "per-pitch camp, PER_PERSON pitch: shows and records 500 x 3 guests x 1 night = 1500" | ✅ |
| Ordinary camp (no per-pitch), PER_PERSON (฿250 x 3 guests x 1 night = 750) — the owner's original bug, reproduced as a passing test | H | e2e | same file › "ordinary camp, PER_PERSON: shows and records 250 x 3 guests x 1 night = 750 (the owner's original bug, reproduced as a passing test)" | ✅ |
| Ordinary camp, PER_SITE (฿250 x 3 guests → still 250, guest term must NOT apply, asserted against a hard-coded 250) | H | e2e | same file › "ordinary camp, PER_SITE: shows and records a flat 250 for 3 guests — the guest term must NOT apply" | ✅ |

Every row asserts **both sides of the AC independently, then against each other**: `shown === EXPECTED` (a literal, never derived via the production formula) · `Number(booking.totalPrice) === EXPECTED` · `Number(booking.totalPrice) === shown`. This is deliberate — a test that only checked the recorded value against `EXPECTED` would have stayed green while the owner's original bug (client and server silently agreeing on the wrong shared formula) was live; asserting the DOM-read value against the same literal closes that gap. Each row also asserts `booking.spotId` (the picked pitch, or `null` for an ordinary camp) and `booking.guests` — the full round trip, not price alone.

## Coverage matrix (per case bucket, ISTQB-style)

- **normal (happy path):** all 4 rows above.
- **boundary:** PER_SITE with `guests=3` (case 1) proves the multiplier is bounded to exactly 1x regardless of a >1 guest count — the same boundary the PER_SITE ordinary case (row 4) re-proves at the whole-camp level.
- **null/empty:** `booking.spotId` asserted `null` for both ordinary-camp cases (no pitch to record) vs a real spot id for both per-pitch cases — both branches of the nullable field are covered.
- **error/validation:** N/A for this ticket — no invalid-input AC was in scope (CAM-672 is a proof-of-round-trip ticket, not an input-validation ticket); `lib/validations/booking.ts`'s own boundary tests already cover the 400/401/403/404/409 contract for `POST /api/bookings` from prior stories (CAM-651/652/666/668/670).
- **concurrent/ordering:** the two per-pitch cases book the SAME `campSiteId` + SAME date with two different spots — proves the whole-camp daily-capacity check (`lib/campsite-availability.ts`) does not falsely collide two different pitches' bookings on the same day. `test.describe.configure({ mode: "serial" })` is used for TEST-INFRA determinism only (Playwright can otherwise shard this file's `beforeAll` across two workers and race the seed's own `campSite.upsert`) — it does not change what the booking transaction itself proves.

## Prove-It (red-before-green) — real teeth, demonstrated

Reverted `lib/booking-pricing.ts`'s `computeBookingPrice` to the pre-CAM-651 formula (`const safeQuantity = 1;`, ignoring the `quantity` argument entirely — reproducing the exact historical bug: `unitPrice x nights`, no guest term) **locally only, never committed** (confirmed via `git status`/`git diff` before and after; `git checkout -- lib/booking-pricing.ts` restored it before any commit). Re-ran the suite:

- Case 1 (PER_SITE per-pitch, ฿400) → still **green** (unaffected — PER_SITE was never multiplied by guests even before CAM-651).
- Case 2 (PER_PERSON per-pitch, expected 1500) → **red**: `shown=500`, `recorded=500` (both wrong, agreeing with each other — exactly the historical failure mode: a shared formula both sides trust, wrong).
- Case 3 (PER_PERSON ordinary, expected 750) → **red**: `shown=250`, `recorded=250` — this is the owner's literal 2026-07-29 report, reproduced byte-for-byte.
- Case 4 (PER_SITE ordinary, ฿250) → still **green** (unaffected).

Restored `lib/booking-pricing.ts` (`git checkout --`), re-ran: all 4 green again. This is the precise sensitivity the AC asks for — the two guest-multiplier cases catch the regression, the two PER_SITE cases correctly stay unaffected by it.

## Defect found (filed, not fixed — out of QA's file surface)

**CAM-688** — *Language/currency flash on load: `LanguageContext` defaults to `en` before correcting to a persisted `th` preference* (severity: Suggestion — cosmetic/timing, self-correcting within one client render, no data-integrity impact). `contexts/LanguageContext.tsx`'s `language` state initializes to `'en'` and only reads `localStorage.campvibe_lang` inside a post-mount `useEffect`, so even with the shared regression `storageState` already holding `campvibe_lang=th`, the very first client paint briefly renders the USD-converted amount before settling to Thai. Directly reproduced: `row--booking-total` read `"Total\n$21"` on one `innerText()` call and `"฿750"` a moment later on the next. Test made robust by polling for the settled `"฿"`-prefixed value (`toContainText`) rather than reading the first visible paint — a legitimate wait-on-a-real-condition fix, not a flaky-test workaround. Full repro + root-cause read + a secondary observed symptom (see below) are in the CAM-688 ticket body.

## Pre-existing, unrelated flakiness observed under full-suite parallel load (not caused by this diff, not chased)

Running the full `regression` project together (not just this file) intermittently surfaced `ac6-spot-lifecycle.spec.ts` (strict-mode violation: two `btn--availability-add` elements, one English-labelled, one Thai-labelled) and, separately, `ac3-logo-roundtrip.spec.ts`. **Both are already documented as known pre-existing artifacts** in `docs/specs/camp-detail-and-spot-booking/pitch-viewer-mobile-booking-bar/CAM-664-spot-viewer-verify/test.md` §"Two other apparent failures during debugging were confirmed NOT regressions" (a concurrency artifact under local auto-parallel workers, and local DB-state pollution across repeated runs against the same persistent throwaway DB — neither is a CI concern, since CI's Postgres service container is ephemeral per run). Confirmed independently in this pass: re-ran the full suite with `e2e/regression/cam-672-*` files **excluded entirely** — the same two specs still failed, proving this diff does not cause or worsen either. `e2e/regression/cam-672-price-shown-is-price-recorded.spec.ts` itself was re-run standalone 3x (default parallel workers) and once at `--workers=1` alongside the full suite — 4/4 (then 110/111, only the pre-existing `ac3` failure) green every time, never flaky.

## Coverage

- New production code touched by this dispatch: none (QA scope; the only reverted-then-restored production edit was a transient, never-committed local experiment for the Prove-It section above — confirmed clean via `git status`/`git diff` before commit).
- `npx vitest run`: 449 test files passed / 5 skipped, 11921 tests passed / 25 skipped, **0 failed** (full suite, real run).
- e2e (Playwright, real browser, real throwaway local Postgres `campvibe_e2e_cam672`): this file's 4 cases pass consistently; full `regression` project 110/111 (the 1 failure is the pre-existing, independently-reproduced `ac3-logo-roundtrip.spec.ts` local-DB-pollution artifact documented above).
- `npm run lint`: 0 errors (357 pre-existing warnings repo-wide, none in the 2 files this dispatch added — confirmed via `npx eslint` scoped to just those 2 files: 0 output). `npm run typecheck`: clean. `npm run check:ds` / `npm run check:palette`: PASS (0 violations) — no UI/token changes in this dispatch, run for completeness.
- Coverage % on new code: **not measured** — this dispatch added zero new production code (test files only per the QA role boundary), so a vitest `--coverage` diff-percentage is not a meaningful number here.

## Links

`e2e/regression/cam-672-seed.ts` (throwaway-DB seed, idempotent upsert, reused from THIS file's own `beforeAll` — see that module's header for why extending `global.setup.ts`/`cam-664-seed.ts` directly is out of this dispatch's file surface and unnecessary) · `e2e/regression/cam-672-price-shown-is-price-recorded.spec.ts` · `lib/booking-pricing.ts` (read-only; the shared pricing engine this ticket proves the round trip against) · CAM-688 (defect, ticket DB) · CAM-664's `test.md` (precedent for the pre-existing-flake documentation cited above)

## Changelog

- v1 (2026-08-06) — created; 4/4 AC cases pass in a real browser against a real throwaway local Postgres DB, each asserting `shown === recorded` (not `recorded === expected` alone); Prove-It red-then-green demonstrated via a local-only, never-committed revert of `lib/booking-pricing.ts`; 1 defect filed (CAM-688, language/currency flash); 2 pre-existing unrelated flakes confirmed independent of this diff.
