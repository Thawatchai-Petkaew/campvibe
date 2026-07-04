---
linear: CAM-303
feature: data-trust
epic: availability-correctness-ว่างจริง-blockeddate-part (CAM-22)
persona: platform
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-07-04
---
# Test — One availability read service — same numbers on every screen (CAM-303)

## AC→test matrix

| AC | test-id | layer | file | pass/fail |
|---|---|---|---|---|
| AC-1 mixed range: open day (booking+hold) + a separate blocked day -> both functions derive matching numbers from ONE three-source fixture | `section--availability-mixed-range` | unit | `__tests__/cam-303-cross-source-parity.test.ts` | PASS |
| AC-2 Booking=2+Hold=3 (capacity 10) + whole-camp BlockedDate -> remaining forced to 0, never the numeric partial 5 | `section--availability-blocked-wins` | unit | `__tests__/cam-303-cross-source-parity.test.ts` | PASS |
| AC-3 Booking=2+Hold=3, capacity 5, no block -> remaining 0 from ONE getRemainingCapacity call (boundary) | `section--availability-boundary-exact-capacity` | unit | `__tests__/cam-303-cross-source-parity.test.ts` | PASS |
| AC-4 30-day range, all three sources non-empty -> exactly 1 query each (no N+1) | `section--availability-no-n-plus-1` | unit | `__tests__/cam-303-cross-source-parity.test.ts` | PASS |

## Validation cases per AC

AC-1 / BR-2 / BR-3 (mixed-range parity — describe block "AC-1 + BR-2 + BR-3"):
- normal: the open night (10-01) sums Booking(2) + Hold(1) = combined 3, capacity 5 -> 2 remaining (`เหลือ 2 ที่` equivalent)
- normal: the blocked day (10-03) is flagged `blockedByHost=true` from a whole-camp BlockedDate with ZERO booking/hold usage that day — proves the block is independent of numeric usage
- parity (BR-3): `getRemainingCapacity(10-01,10-02)` derives the identical `bookedGuests`/`heldGuests`/`remaining` as the daily map's 10-01 entry
- parity (BR-3): `getRemainingCapacity(10-03,10-04)` derives `blockedByHost=true` + `remaining=0`, matching the daily map's 10-03 entry
- three-source (BR-2): all three mock legs (`booking`, `blockedDate`, `internalHold`) are non-empty in the SAME `beforeEach` for every test in this describe block — the gap CAM-302 left (its own suite mocks `blockedDate` empty in every case)

AC-2 / BR-1 (blocked wins, never a numeric partial):
- boundary/edge: combined booked+held (5) is well under capacity (10) — WITHOUT the block, remaining would be the partial 5; WITH the block, remaining is forced to exactly 0
- asserts `blockedByHost=true` AND `remaining=0` together (not just one or the other), so a regression that only half-applies the override is caught

AC-3 (boundary — exactly at capacity, no block):
- boundary: `bookedGuests`(2) + `heldGuests`(3) = capacity(5) exactly -> `remaining=0` via ordinary subtraction (not the block-forcing path — `blockedByHost` is asserted `false` to distinguish this case from AC-2)
- normal: `bookedGuests` and `heldGuests` are each asserted individually (2 and 3) before the combined `remaining`, so a future change that shifts the split between the two counters (e.g. miscounting a hold as a booking) is also caught

AC-4 (no N+1):
- normal: a 30-day range with non-empty booking/blockedDate/internalHold fixtures — asserts exactly 1 call each to `booking.findMany` / `blockedDate.findMany` / `internalHold.findMany` (`toHaveBeenCalledOnce()`), guarding against a future per-day-loop regression

## Prove-It (red-before-green evidence)

This story guards ALREADY-shipped, correct production code (CAM-190 / CAM-267 / CAM-302) — there is no known defect to reproduce, so Prove-It was demonstrated by mutation instead of a bug repro: a scratch copy of the suite (never committed) had every numeric/count expectation deliberately swapped for a wrong value —

- `daily['2026-10-01'].bookedGuests` expected `2` -> mutated to `999`
- `daily['2026-10-03'].blockedByHost` expected `true` -> mutated to `false`
- `remaining.remaining` (open-night parity) expected the real computed value -> mutated to `999`
- `remaining.remaining` (blocked-night parity) expected `0` -> mutated to `999`
- AC-2's `result.remaining` expected `0` -> mutated to `5` (the numeric partial the block must override)
- AC-3's `result.remaining` expected `0` -> mutated to `999`
- AC-4's `internalHold.findMany` expected `toHaveBeenCalledOnce()` -> mutated to `toHaveBeenCalledTimes(2)`

All 6 tests went RED against the real, unmodified `lib/campsite-availability.ts` implementation, confirming every assertion has teeth. The mutated copy was discarded; the suite that ships in `__tests__/cam-303-cross-source-parity.test.ts` is the original, unmutated, green version.

## Coverage

| File | Stmts | Branch | Funcs | Lines | Note |
|---|---|---|---|---|---|
| lib/campsite-availability.ts (this suite alone) | 58.41% | 32% | 62.5% | 58.58% | Exercises only `getCampSiteDailyAvailability` + `getRemainingCapacity` (this story's scope). `checkDateAvailability` / `checkDateAvailabilityInTx` are covered by CAM-302's own suite, not re-tested here. |
| lib/campsite-availability.ts (combined with cam-190 / cam-267 / cam-302 / cam-55 suites) | 90.09% | 70% | 100% | 89.89% | Real measured run across all availability suites including this new file — reported for honesty about the file this guard covers. |

No new production code ships in this story (test-only) — there is no "new code" diff to hold to the 80% floor; the numbers above are reported for honesty, not as a gate target.

## Run results

```
 Test Files  1 passed (1)
      Tests  6 passed (6)
   Duration  120ms
```

Full repo suite (`npm test`): 115/116 test files passed, 5254/5255 tests passed. The 1 failing test is the known pre-existing env-dependent failure `__tests__/delivery-client.test.ts` ("DELIVERY_DATABASE_URL is not set") — unrelated to this change, present before this PR.

## Quality gate summary

- `npm run lint`: 0 errors, 235 pre-existing warnings (no new warnings from the new test file)
- `npm run typecheck`: 0 errors
- `npm test`: 5254/5255 passed (1 known pre-existing env failure, unrelated, present before this PR)
- No production file touched (`lib/`, `app/api/`, `prisma/` all untouched — test-only diff)
- `node scripts/ticket-sync.mjs audit`: template-conformant (`## Story` + `## AC` present, no `[NEEDS CLARIFICATION]` marker)

## Staging-verify (non-automated)

Not applicable in the usual sense — this story ships no new user-visible behavior (the numbers it guards are already live and were already verified via CAM-190 / CAM-267 / CAM-302's own Staging sign-offs). Done for this story = the regression suite merged into `staging` and green in CI, per its `story.md` Self-verify Gate line.

## Links

`story.md` (AC/BR) · `.claude/rules/qa.md` · `__tests__/cam-302-internal-holds.test.ts` (the mocking pattern this suite extends, with the `blockedDate` leg populated instead of left empty)

## Changelog
- v1 (2026-07-04) — created
