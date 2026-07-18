---
linear: CAM-400
feature: booking-reliability
epic: booking-reliability-every-camper-can-complete-a-bo (CAM-395)
persona: Camper
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-07-18
---
# Test — Capacity seam agrees everywhere: a camp shown as full can never be booked (CAM-400)

## AC→test matrix

| AC | risk | type | test file | status |
|---|---|---|---|---|
| AC-1 (0-capacity whole-camp -> `จองไม่สำเร็จ`, 409, no Booking) | H | unit (write-gate) + integration (route oracle) | `__tests__/cam-400-capacity-invariant.test.ts` (WC-2 cell + EC-1 group) | PASS |
| AC-2 (calendar disables every date when full) | H | integration (route) | `__tests__/cam-400-capacity-invariant.test.ts` (WC-2 cell, Layer 1) | PASS |
| AC-3 (button greyed out, no request fired from the button) | M | unit (source-inspection) | `__tests__/cam-400-capacity-invariant.test.ts` (AC-3/EC-3/BR-4 group) | PASS |
| AC-4 (null = unlimited, unchanged) | H | unit (write-gate) + integration (route + badge) | `__tests__/cam-400-capacity-invariant.test.ts` (WC-1, EC-4 cells + regression group) | PASS |
| BR-5 (8-cell cross-layer invariant matrix) | H | unit + integration | `__tests__/cam-400-capacity-invariant.test.ts` (all 8 WC/PS cells) | PASS |

## The invariant matrix (BR-5) — 8 cells x 3 layers = 24 agreement assertions

`{null, 0, positive-with-room, positive-full}` x `{whole-camp, per-spot}`, every cell run through all 3 readers (availability-calendar route, `getRemainingCapacity`, `checkDateAvailabilityInTx`) via one shared fixture (`assertAllLayersAgree`):

| Cell | Mode | Capacity | Booked | Requested | Expect | Proves |
|---|---|---|---|---|---|---|
| WC-1 | whole-camp | `null` | 5 | 100 | bookable | unlimited unaffected (regression) |
| WC-2 | whole-camp | `0` | 0 | 1 | **rejected** | **THE BUG** — AC-1, zero pre-existing volume needed |
| WC-3 | whole-camp | 10 | 3 | 2 | bookable | room-left path |
| WC-4 | whole-camp | 10 | 10 | 1 | rejected | exact-full boundary |
| PS-1 | per-spot | stored col `null`, 0 live spots | 0 | 1 | rejected | a null STORED column never means "unlimited" for per-spot (BR-6) — the same raw value means different things by MODE, not a seam divergence |
| PS-2 | per-spot | derived 0 (stale col=999) | 0 | 1 | rejected | stale column never leaks through (closes CAM-399) |
| PS-3 | per-spot | derived 8 | 3 | 2 | bookable | room-left path |
| PS-4 | per-spot | derived 8 | 8 | 1 | rejected | exact-full boundary |

**Matrix completeness note (per-spot "null" cell):** `calculateSpotCapacity` (`lib/spot-aggregation.ts:25-28`) always returns a real `number` for per-spot mode — verified by reading the function signature — so a genuine "per-spot derived capacity = null" state cannot occur in the system. PS-1 covers the correct interpretation of that matrix cell: a `null` STORED column (input) for a per-spot camp, proving it never leaks through as "unlimited" the way it legitimately does for whole-camp (WC-1). This is a derivation-contract fact (`getEffectiveCapacity`), not a coverage gap — confirmed by code-reading, not assumed.

**Tents-dimension note (BR-2 "same for the tents check if present"):** the write gate's tents branch (`checkDateAvailabilityInTx`'s `requestedTents` parameter) is gated on a parameter that **no production caller ever supplies** — grepped both call sites (`app/api/bookings/route.ts:82-87`, `app/api/campsites/[id]/holds/route.ts:64`) and neither passes `requestedTents`. This is a pre-existing, structural fact unrelated to and unchanged by this story's null-vs-0 fix — not re-tested here as a 9th matrix cell (a test exercising an unreachable-from-production parameter would not guard a real regression, per the lean principle). The availability-route's tents clause (`isCapacityFull`'s tents check) IS reachable via real GETs and already shares the same `!== null` gate BR-3 applied — Info-level, non-blocking.

## Prove-It (red-before-green evidence, done by hand, not encoded as a live revert in the suite)

1. **WC-2 cell (write gate)** — reverted `lib/campsite-availability.ts`'s whole-camp guest branch (`!== null` back to the pre-fix `&&` truthy check) → ran `__tests__/cam-400-capacity-invariant.test.ts` → **exactly 1 test went red**: `[WC-2][MANDATORY]... whole-camp, capacity=0 -> closed` (`expected true to be false`, write gate reason `n/a`). All other 8 tests stayed green (proves the revert's blast radius is scoped correctly — no other cell coincidentally also depends on this line). Restored the file (`git diff --stat` empty) → re-ran → 9/9 green.
2. **EC-1 route oracle** — same revert → the new `[MANDATORY ORACLE][ec-1][ac-1]` route-level test also went red, but manifested as `expected 500 to be 409` (not 201) — because with the bug reintroduced, `checkDateAvailabilityInTx` wrongly reports available, the transaction proceeds past the capacity gate into the pricing fetch, and the pricing `campSite.findUnique` mock (shaped only for the capacity-check call) lacks `spots`/`location`, throwing inside the tx → caught by the route's outer catch → 500. Still a genuine failure (red), confirming the oracle has teeth even though the manifestation differs from the unit-level assertion. Restored → 11/11 green.
3. **AC-3/EC-3/BR-4 component group** — reverted `components/CampgroundDetailClient.tsx`'s `disabled={isReserving || isFullyBooked}` back to `disabled={isReserving}` AND removed the `if (isFullyBooked) { return; }` early-return block → ran the file → **exactly the 4 tests asserting those two mechanisms went red** (`disabled` regex no longer matches; `if (isFullyBooked)` gate not found — both the fetch-ordering and bare-early-return sub-assertions cascade-fail on the missing gate); the 5th test in that group (`isFullyBooked` derivation itself, untouched by this revert) stayed green as expected — confirming each assertion's blast radius is scoped to what it actually pins. Restored (`git diff --stat` empty) → 16/16 green.

## Validation cases per AC

**AC-1 / BR-1 / BR-2 (0 = closed everywhere, EARS: IF a direct POST targets a 0-capacity camp THEN 409 every night):**
- normal/boundary: WC-2 cell — zero pre-existing bookings, a single guest request, still rejected (proves the bug was never about "already full from volume" — a completely empty 0-capacity camp is still unbookable)
- integration (mandatory oracle, independent of the button): a direct `POST /api/bookings` against a whole-camp `maxGuestsPerDay=0` camp → `res.status===409`, `body.error==='Capacity exceeded'`, `body.details` matches `/Exceeds maximum guests per day \(0\)/`, and `tx.booking.create` is asserted `not.toHaveBeenCalled()` — the full AC-1 system-effect contract (409 + no Booking row), not inferred from the unit call alone
- Thai copy: `จองไม่สำเร็จ` is a fixed client-side toast per CAM-396 BR-2 (any non-ok response renders it, never the server's raw message) — already asserted verbatim in `__tests__/cam-396-booking-login-gate.test.ts` (`th.newCampground.failedToReserve`); not re-asserted here to avoid duplicating that guard, referenced instead

**AC-2 / BR-3 (calendar agrees with the badge):**
- normal: WC-2 cell's Layer-1 assertion — the availability-calendar GET route's `available` field for the exact requested night is `false` when whole-camp capacity is 0, mirroring `getRemainingCapacity`'s `remaining=0` and the write gate's rejection in the SAME cell (cross-layer agreement, not just an isolated per-route check)

**AC-3 / EC-3 / BR-4 (button + handleReserve double defense):**
- normal: reserve `<Button>`'s `disabled` expression source-matches `isReserving || isFullyBooked` (fades/disables on the banner's เต็มแล้ว state)
- boundary/ordering: `handleReserve`'s `if (isFullyBooked)` gate is positioned AFTER the login gate but BEFORE the date-selection guard — proves the double-defense sits ahead of every other check, not appended as an afterthought that a future refactor could reorder past
- error/defense-in-depth: the gate is a bare `return;` — no side effect fires before it
- derivation guard (BR-1): `isFullyBooked = !!remainingCapacity && (remainingCapacity.blockedByHost || remainingCapacity.remaining === 0)` is asserted verbatim — this is the client-side wiring that consumes the SAME `remaining===0` value the WC-2/Layer-2 assertion already proves the server derives correctly for a 0-capacity camp; a regression here would silently disagree with the server invariant even though the server itself stayed correct

**AC-4 / EC-4 (null = unlimited, no regression):**
- normal: WC-1 cell (huge request, existing bookings, still bookable) + a dedicated EC-4 regression cell (zero existing bookings, request 6, unlimited) + the route-level regression test (a `maxGuestsPerDay=null` whole-camp camp still returns 201 and calls `tx.booking.create` once) — three independent proofs the fix did not tighten the unlimited case

## Coverage

Real measured run (`npx vitest run --coverage`), scoped to the files this story changed:

| File | Stmts | Branch | Funcs | Lines | Note |
|---|---|---|---|---|---|
| `lib/campsite-availability.ts` | 90.47% | 75.24% | 91.66% | 92.57% | Uncovered lines (673, 774-776) are pre-existing, unrelated to this diff — camp-not-found early return (673) and the tents-exceeded body gated on the never-supplied `requestedTents` param (774-776, see Tents-dimension note above). Every line THIS story's diff actually changed (763-773, the whole-camp guest+tents null-check gates) is exercised. |
| `app/api/campsites/[id]/availability/route.ts` | 81.81% | 77.77% | 100% | 81.81% | Uncovered lines (24, 45, 51-54, 145) are pre-existing/unrelated (missing-params 400, camp-not-found 404, the private-camp auth gate). The exact lines this story changed (the `isCapacityFull`/`remainingGuests`/`remainingTents` ternaries) are exercised across all 8 matrix cells. |
| `app/api/bookings/route.ts` | 68.42% | 54.71% | 50% | 72.22% | Not touched by this story's diff (pre-existing file); the new EC-1 route-oracle tests exercise its capacity-gate wiring (Check 2) and the 409/201 response mapping, which is the only part relevant to this story. |
| `components/CampgroundDetailClient.tsx` | 0%* | 0%* | 0%* | 0%* | *v8 instrumentation shows 0% because coverage requires module EXECUTION and this project has no jsdom/RTL harness for this large client component (`vitest environment: 'node'`) — confirmed pre-existing repo constraint, same as `__tests__/cam-396-booking-login-gate.test.ts`'s own header note for the SAME file. Coverage here is real, just not v8-measurable: 5 source-inspection Prove-It tests assert the exact `disabled` expression, the `isFullyBooked` early-return (position + bare-return), and the derivation formula — each proven to go red on a real revert (see Prove-It #3 above). Metric-honesty statement: "not measured by v8; measured by source-inspection Prove-It instead." |

No new production code ships from QA in this story (test-only diff from this role) — the ≥80% floor is reported above for honesty on the touched production files, not as a gate QA is scoring itself against.

## Run results

```
 Test Files  1 passed (1)
      Tests  16 passed (16)
   Duration  ~210ms
```

Regression set (cam-400 + cam-355 + cam-344 + cam-351 + cam-55 + cam-396 + cam-397): 7 files, 240/240 passed.

Full repo suite (`npx vitest run`): 165 test files, 6527 tests — **4 failing test files**, all pre-dating this QA pass:
- `__tests__/delivery-client.test.ts` — known pre-existing env-dependent failure (per dispatch, ignore).
- `__tests__/f5-account-misc.test.ts`, `__tests__/f6-palette-guard.test.ts` — known pre-existing git-diff-against-`staging` artifacts (per dispatch, ignore).
- `__tests__/cam-302-internal-holds.test.ts` — **a real, NEW-to-this-story finding**, see below (not pre-existing on `origin/dev`; confirmed byte-identical to `origin/dev` via `diff`, meaning the failure is caused entirely by this story's OWN production diff, not by anything QA added).

## Defect found (blocking) — CAM-302's remainingGuests guard test is stale

**Severity:** Important. **Failing test:** `__tests__/cam-302-internal-holds.test.ts` ("remainingGuests (whole-camp branch) is derived from maxGuestsPerDay - (bookedGuests + heldGuests)"). **Failing AC:** none directly (this is a sibling regression-guard test in the same seam this story's BR-3 changed, per `.claude/rules/architecture.md` §15b's reader/writer inventory requirement) — but it blocks this story's own Verify item "npm test is green."

**Reproduction:** on this branch, run `npx vitest run __tests__/cam-302-internal-holds.test.ts`. It asserts `availabilityRouteSrc` (the raw source text of `app/api/campsites/[id]/availability/route.ts`) still contains the literal pre-CAM-400 string `campSite.maxGuestsPerDay ? campSite.maxGuestsPerDay - (data.bookedGuests + data.heldGuests) : null`. This story's own commit (`519cb80`) correctly changed that literal to `campSite.maxGuestsPerDay !== null ? ...` (BR-3) — and correctly re-pinned the ONE sibling test that also asserted this exact string (`__tests__/cam-55-host-month-calendar.test.ts`, see its diff in this same PR) — but missed this SECOND sibling test pinning the identical string.

**Expected vs actual:** expected the assertion to pass against the current canonical formula; actual: `toContain` fails because the string literal changed.

**Not a functional defect** — the underlying behavior is correct (this is exactly the class of test-only re-pin `.claude/rules/qa.md`'s rationalization table describes: "a design-system refactor changes canonical classes... updating them to the new canonical class is correct, NOT weakening" — the same logic applies to this canonical-formula re-pin). Confirmed via `diff` against `origin/dev` that this test file is untouched on this branch (the failure is 100% attributable to the production line changing underneath it, not to any QA edit).

**Recommended fix** (one line, mirrors the already-landed `cam-55` re-pin in this same PR): in `__tests__/cam-302-internal-holds.test.ts`, update the `toContain(...)` string to `'campSite.maxGuestsPerDay !== null ? campSite.maxGuestsPerDay - (data.bookedGuests + data.heldGuests) : null'`.

**Scope note:** left unfixed here — outside this dispatch's stated file surface (`__tests__/cam-400-capacity-invariant.test.ts` + `test.md` only); per the Stop Rules, QA does not touch a file outside the dispatch's stated surface. Reported back for the orchestrator to route (a 1-line commit on the same branch, not a new sub-ticket-worthy functional defect).

## Links

`story.md` (AC/BR) · `.claude/rules/qa.md` · `.claude/rules/architecture.md` §15b (the seam-invariant rule this story is the first to be checked against) · `__tests__/cam-355-per-spot-capacity-enforcement.test.ts` (Group F mandatory-oracle convention, mirrored for EC-1) · `__tests__/cam-396-booking-login-gate.test.ts` (source-inspection Prove-It convention, mirrored for AC-3/EC-3/BR-4)

## Changelog
- v1 (2026-07-18) — created; 8-cell invariant matrix verified complete, EC-1 route-oracle + AC-3/EC-3/BR-4 component gaps closed, teeth proven 3x, 1 blocking defect found (stale sibling re-pin, not a functional bug)
