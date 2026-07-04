---
linear: CAM-303
feature: data-trust
epic: availability-correctness-ว่างจริง-blockeddate-part (CAM-22)
persona: platform
artifact: story
class: spec-lite
owner: product-owner
status: In Progress
version: v2
updated: 2026-07-04
---
# One availability read service — same numbers on every screen (CAM-303)

## Story
As a **Platform** team member, I want an automated regression guard proving `getCampSiteDailyAvailability` and `getRemainingCapacity` return correct combined numbers when Booking + BlockedDate + InternalHold ALL apply to the same date range, so that a future change to any one of the three sources cannot silently break the cross-source math with no test catching it.
Scope: test-only story, no production code change. The single shared availability calculation this story guards is already shipped — CAM-190 folded BlockedDate in, CAM-267 built the shared `getRemainingCapacity`, CAM-302 folded InternalHold in — and each shipped its own test suite. No existing suite exercises all three sources populated together in one test: CAM-302's suite (`__tests__/cam-302-internal-holds.test.ts`) mocks `blockedDate.findMany` to an empty array in every case. This story adds ONE new test file (`__tests__/cam-303-cross-source-parity.test.ts`) closing that gap. It touches no file under `lib/`, `app/api/`, or `prisma/`.
Depends on: CAM-302 (InternalHold, shipped — the code under test) · reuses CAM-190 / CAM-267's existing coverage, does not replace it.

## AC
<!-- Then = user-visible (screen text = verbatim Thai) · System effect = data outcome, plain language · Neg/edge = failure twin (EC-n/AC-n); — needs a reason. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | a campsite (capacity 5) has, within one date range, an open day carrying both a Booking and an InternalHold, and a separate day fully covered by a whole-camp BlockedDate | `getCampSiteDailyAvailability` and `getRemainingCapacity` are both computed over that same range | the open day would show `เหลือ {n} ที่` (n = capacity minus combined booked+held guests) and the blocked day would show `เต็มแล้ว` | both functions derive their numbers from the same three-source query set for the same range — the daily per-day map and the remaining-capacity aggregate never disagree on the same night | EC-1 |
| AC-2 | one day carries Booking = 2 guests + InternalHold = 3 guests (combined 5, well under a capacity of 10) AND a whole-camp BlockedDate also covers that day | `getRemainingCapacity` is computed for a stay covering that day | that day would show `เต็มแล้ว`, never the numerically-partial `เหลือ 5 ที่` the booked+held total alone would produce | `remaining` is forced to `0` because `blockedByHost` is `true`, overriding the numeric subtraction entirely (block always wins) | EC-1 |
| AC-3 | capacity 5, one day carries Booking = 2 guests + InternalHold = 3 guests, no BlockedDate | `getRemainingCapacity` is computed for a stay covering that day | that day would show `เต็มแล้ว` | `remaining` = `max(0, capacity - (bookedGuests + heldGuests))` = `0`, computed from booking and hold together inside the SAME call (no second query, no separate math) | — |
| AC-4 | a 30-day range has Booking, BlockedDate, and InternalHold rows all present somewhere inside it | `getCampSiteDailyAvailability` computes the whole range in one call | the page loads without a stuck loading indicator (no per-day repeated queries) | exactly 1 booking query + 1 blockedDate query + 1 internalHold query total for the whole range | — |

## Rules
- BR-1 When a day is covered by a whole-camp BlockedDate, `remaining` (and the per-day `blockedByHost` state) is forced to reflect "fully unavailable" regardless of the numeric booked+held total on that day — a block always wins over a numeric partial result. (proves AC-1, AC-2)
- BR-2 At least one test in this suite populates ALL THREE mock legs (`booking.findMany`, `blockedDate.findMany`, `internalHold.findMany`) with non-empty rows on the SAME fixture range at the same time — not three separate single-source tests — closing the gap left by CAM-302's suite, which mocks `blockedDate.findMany` empty in every case. (proves AC-1, AC-2, AC-3)
- BR-3 `getCampSiteDailyAvailability` (consumed by the campsite detail page / host calendar per-day display) and `getRemainingCapacity` (consumed by the booking widget's stay-level remaining count) must derive identical booked/held/blocked numbers for the same night when evaluated over the same fixture — proven by calling both functions against the same mocked fixture inside the same test, not by re-deriving the math independently. (proves AC-1)

## Edge cases
<!-- cover: invalid · empty/zero · concurrent/duplicate · permission · boundary. -->
- EC-1 IF a day is covered by a whole-camp BlockedDate AND also carries Booking/InternalHold guests THEN the day is treated as fully unavailable (`เต็มแล้ว`), never a partial number computed from capacity minus the numeric booked+held total (BR-1)

## Data
- Read-only test fixtures only — no schema/migration change. Booking, BlockedDate, and InternalHold rows are represented solely as mocked `prisma.*.findMany` results (the same mocking pattern as `__tests__/cam-302-internal-holds.test.ts`); no new field, no migration.

## Seams & refs
- Reuse: `lib/campsite-availability.ts` (`getCampSiteDailyAvailability`, `getRemainingCapacity`) — the single existing implementation (CAM-190 / CAM-267 / CAM-302). This story adds no parallel calculation.
- Refs: ADR-006 (serializable inventory lock — not exercised by this read-only guard) · ADR-012 §4 (InternalHold) · `__tests__/cam-302-internal-holds.test.ts` (the mocking pattern this suite follows, with the `blockedDate` leg populated instead of left empty).

## Out of scope
- Holds surfaced through the campsite catalog/listing search (catalog-level hold visibility) → CAM-344
- Removing or refactoring any dead/superseded availability code path noticed while writing this guard → CAM-345
- Caching the read service's result (deferred from the original CAM-303 read-service scope; no cache need has surfaced) → not scoped
- Exposing this read path directly to the AI assistant → M2 AI Camping Assistant epic (CAM-266)

## Self-verify
- AC-1 → unit (`getCampSiteDailyAvailability` over a mixed fixture range: open day's per-day numbers + blocked day's `blockedByHost`) + a parity assertion cross-checking `getRemainingCapacity` against the same fixture (BR-3)
- AC-2 → unit (Booking = 2 + Hold = 3 + BlockedDate on one day, capacity 10 → `remaining` forced to `0`, never the numeric partial `5`)
- AC-3 → unit (Booking = 2 + Hold = 3, capacity 5, no block → `remaining` = `0`, derived from one `getRemainingCapacity` call; boundary case — exactly at capacity, not over)
- AC-4 → unit (30-day range, all three sources non-empty; assert exactly 1 call each to `booking.findMany` / `blockedDate.findMany` / `internalHold.findMany` — no N+1)
- Story-specific: this is a test-only story — no production file changes. Every new assertion was proven capable of failing (temporarily asserted a deliberately wrong expected value and watched it go red, then restored the correct value and confirmed green) before being kept, since the underlying implementation already ships correct behavior and there is no known defect to reproduce.
- Gate = /quality-gate · Done = merge to `staging` + the new suite green in CI. There is no new user-visible AC to click through on the Staging URL beyond the already-shipped CAM-190/267/302 behavior — this story's Done is the regression suite itself passing, not a new browser flow.

## Changelog
- v1 (2026-07-03) — created. Original scope: build a single availability read-service function returning the combined Booking + BlockedDate + InternalHold daily state, consumed by both the campsite detail page and the host calendar, with a p95 < 200ms performance AC and cache/AI-read explicitly out of scope.
- v2 (2026-07-04) — reclassified **spec-lite** after ground-truth research. `lib/campsite-availability.ts`'s `getCampSiteDailyAvailability` / `getRemainingCapacity` already implement the single combined read path: CAM-190 folded in BlockedDate, CAM-267 built the shared `getRemainingCapacity` function, CAM-302 folded in InternalHold. The core v1 goal — one shared calculation, no cross-screen divergence — is already satisfied in production code; the only real gap is a missing regression test exercising all three sources together in one test (CAM-302's suite mocks `blockedDate` empty in every case). Rewritten as a test-only regression-guard story: no production code change, no new schema/API contract, single file-surface (`story.md` + one new test file), diff well under ~150 lines → G1 folds into G3 (this PR carries both the spec and the guard test for one owner tap).
