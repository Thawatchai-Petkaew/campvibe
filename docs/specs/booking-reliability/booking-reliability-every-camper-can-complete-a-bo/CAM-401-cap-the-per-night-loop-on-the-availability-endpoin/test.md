---
linear: CAM-401
feature: booking-reliability
epic: booking-reliability-every-camper-can-complete-a-bo (CAM-395)
persona: camper
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-07-18
---
# Test — Cap the per-night loop on the availability endpoint (CAM-401)

## Test strategy note (read first)

This is a security-finding fix (event-loop DoS, CAM-344 class), not a UI story — every AC/EC row maps to a **unit or integration** test; there is no e2e/browser-visible layer to cover (the "Then" column is a system-level rejection, not a rendered Thai string). All 3 capped surfaces named in the dispatch are covered **independently**, each with its own real red-on-revert (Prove-It) proof executed by hand this session (not just asserted in prose — see below).

## The three capped surfaces (dispatch scope)

| # | Surface | Location | Guard mechanism |
|---|---|---|---|
| 1 | Primary availability loop | `lib/campsite-availability.ts` `getCampSiteDailyAvailability` | `if (dayCount > MAX_STATUS_RANGE_NIGHTS) throw AvailabilityRangeTooWideError` — checked BEFORE any Prisma call |
| 2 | Hold-span clamp (2 instances, same pattern) | `getCampSiteDailyAvailability`'s hold loop (L276-293) + `getAvailabilityStatusForCamps`'s sibling hold loop (L636-651) | `while (date < holdEnd && date <= endDate)` / `&& cur <= lastNight` — clamps an unbounded InternalHold span to the already-capped caller window |
| 3 | Holds-route pre-tx cap | `app/api/campsites/[id]/holds/route.ts` POST | `if (holdNights > MAX_STATUS_RANGE_NIGHTS) return apiError(...,400)` — rejects BEFORE `withHoldTransaction`/`$transaction` opens |

All three reuse the **single** `MAX_STATUS_RANGE_NIGHTS = 366` constant (CAM-344 precedent) — no twin constant introduced (BR-1, grep-asserted in the suite).

## AC→test matrix

| AC/EC/BR | risk | type | test file | status |
|---|---|---|---|---|
| AC-1 (normal ≤366 nights unchanged) | M | unit + integration | `__tests__/cam-401-availability-cap.test.ts` (Group A `[normal]`, Group E `[normal]`) | PASS |
| AC-2 (>366 nights rejected, 400, no loop, no leak) | H | unit + integration | Group A (`[boundary][ac-2]`, `[dos][ac-2]`), Group E (`[ac-2]`), Group D (367-night, 8000-year, leak) | PASS |
| EC-1 (exactly 366 boundary passes, ALL 3 surfaces) | H | unit + integration | Group A (`[boundary][ec-1]`), Group B/C (new 366-boundary tests), Group D (`[boundary]` 366) | PASS |
| EC-2 (inverted/non-finite unchanged, no regression) | M | unit | Group A (`[error/validation][ec-2]`, `[null/empty][ec-2]`) | PASS |
| BR-1 (guard before any loop; one shared constant) | H | unit (source-inspection) | Group A (`[br-1]`), Group D (`[br-1]`) | PASS |
| BR-2 (sweep: hold-clamp x2 + holds-route pre-tx) | H | unit + integration | Group B, Group C, Group D | PASS |
| BR-3 (widget stays within cap — no client change) | L | N/A (structural) | See note below | JUSTIFIED N/A |

**BR-3 note:** the camper-facing date-picker widget is out of this dispatch's file surface (no client change per the ticket). There is no reachable path in the current codebase where the widget itself requests >366 nights; every fixture across the whole regression set (`cam-344`, `cam-355`, `cam-400`, `cam-302`) already uses small ranges and stays green post-fix, which is the only observable proxy for "the widget's own calls stay within the cap" from this layer. Not independently testable without a Playwright e2e against the live calendar UI, which is out of scope for a backend-only DoS-cap fix.

## Prove-It (red-before-green) — each of the 3 surfaces reverted independently and confirmed red, then restored, this session

All three reverts were done directly against `lib/campsite-availability.ts` / `app/api/campsites/[id]/holds/route.ts` on this branch, one at a time, confirmed via `git diff --stat` empty after each restore (production code is byte-identical to the branch tip — only the test file changed in this QA pass).

1. **Surface 1 (primary loop cap)** — changed `if (dayCount > MAX_STATUS_RANGE_NIGHTS)` to `if (false && dayCount > MAX_STATUS_RANGE_NIGHTS)`. Ran the 367-day boundary test alone → **red**: `AssertionError` — the promise resolved (full ~367-entry availability object built) instead of rejecting with `AvailabilityRangeTooWideError`. Restored → 20/20 green.
2. **Surface 2a (hold clamp, `getCampSiteDailyAvailability`)** — changed `while (date < holdEnd && date <= endDate)` to `while (date < holdEnd)`. Ran the `hold-clamp` tests → **red**: `expected 1212 to be less than 20` (the ~30-year unclamped hold loop ran to completion instead of stopping at the window). Restored → confirmed green. Re-reverted alone to check the NEW 366-boundary test → **red**: `expected 1827 to be less than 800`. Restored.
3. **Surface 2b (sibling clamp, `getAvailabilityStatusForCamps`)** — same edit on `while (cur < holdEnd && cur <= lastNight)` → `while (cur < holdEnd)`. Ran independently (surface 2a left intact) → **red**: `expected 1213 to be less than 20` (only the Group C test failed, confirming the two clamps are independently guarded, not accidentally covering for each other). Re-reverted alone to check the new 366-boundary sibling test → **red**: `expected 1828 to be less than 800`. Restored.
4. **Surface 3 (holds-route pre-tx cap)** — changed `if (holdNights > MAX_STATUS_RANGE_NIGHTS)` to `if (false && holdNights > MAX_STATUS_RANGE_NIGHTS)`. Ran the write-path span-cap tests → **red**: the 367-night and 10-year tests both got `expected 500 to be 400` (the request reached `$transaction`, which — unconfigured for this path — threw inside the route's try/catch, surfacing as a 500 instead of the mapped 400; still a genuine failure, teeth confirmed). Re-reverted alone to check the new 8000-year abuse-shape test and the no-leak test → both **red** the same way (`500` instead of `400`). Restored.

After every revert, `git diff --stat` on the production files came back empty (exact restore) and the full `cam-401-availability-cap.test.ts` file returned to 26/26 green.

## Additional gaps closed during this QA pass (beyond the pre-existing 24 tests)

The build-phase suite (24 tests) already covered AC-1/AC-2/EC-1/EC-2/BR-1 and a wide-span hold-clamp smoke test for surfaces 2a/2b/3. Three real gaps found and closed:

1. **Surfaces 2a/2b had no explicit 366-night BOUNDARY test** (only a smoke-sized 3/4-day window) — added one per surface, asserting the clamp reaches the exact 366th (last) night, not cut short (comparison parity with EC-1's 366 boundary on the primary loop).
2. **Surface 3 (holds route) had no abuse-shape test matching the primary loop's exact attack shape** (2026-01-01→9999-12-31) nor an explicit no-internal-leak assertion on its 400 body — added both.
3. **Branch coverage gap**: the new ternary `hold.startDate < startDate ? startDate : hold.startDate` (both hold-clamp sites) had its "hold starts inside the window" branch (the ordinary, no-clamping-needed case) never exercised — v8 branch coverage showed `[2,0]` (only the true/clamped branch hit). Added one `[normal]` test per surface with a hold entirely inside the window; branch counts now `[2,1]`/`[3,1]` (both sides hit).

## Abuse-shape + no-leak checks (dispatch deltas)

- **8000-year span → 400 before any Prisma call**: Group A's `[dos][ac-2]` (2026-01-01→9999-12-31, asserts `prisma.booking.findMany` never called) and the new Group D `[dos][abuse-shape]` test (same shape against the holds route, asserts `$transaction`/`spot.findFirst`/`internalHold.findMany` all uncalled — zero queries of any kind).
- **400 path leaks no internals**: Group E's existing `[ac-2]` test (`body.stack` undefined, exact generic `error` string) and the new Group D `[security]` test (`body.details`/`body.stack` undefined, and `JSON.stringify(body)` does not match any `prisma|\.ts:\d|node_modules|at\s+\w+\s+\(` fragment).

## Coverage

Real measured run (`npx vitest run __tests__/cam-401-availability-cap.test.ts --coverage`), scoped to the exact lines this story's diff added (verified against `git diff origin/dev...HEAD`, cross-referenced with the v8 `coverage-final.json` statement/branch maps — whole-file % is not representative here since each touched file is a large pre-existing module with many untouched functions):

| File | New-code lines (diff) | Statement coverage | Branch coverage |
|---|---|---|---|
| `lib/campsite-availability.ts` | `AvailabilityRangeTooWideError` class (155-167), `dayCount`/throw (199-203), hold-clamp ternary+while (276-287) | 100% (11/11 statements) | 100% (both sides of the ternary + the `&&` binary-expr hit) |
| `lib/campsite-availability.ts` (sibling) | sibling hold-clamp ternary+while (639-646) | 100% (3/3 statements) | 100% (both sides hit) |
| `app/api/campsites/[id]/availability/route.ts` | catch-and-map to 400 (149-156) | 100% (3/3 statements) | n/a (single `if`, both branches exercised — normal path + AC-2 path) |
| `app/api/campsites/[id]/holds/route.ts` | `holdNights` computation + 400 guard (172-190) | 100% (3/3 statements) | 100% (both branches — normal-length + over-cap) |

Whole-file blanket % (for reference only, not the gating number): `lib/campsite-availability.ts` 39.69% stmts / `availability/route.ts` 71.42% / `holds/route.ts` 34% — all pre-existing uncovered code belongs to functions this story did not touch (`getRemainingCapacity`, `checkDateAvailabilityInTx`, GET `/holds`, etc.), already exercised by the sibling suites (`cam-302`, `cam-355`, `cam-400`) run together in the regression set below. **New-code coverage (the QA gate metric) = 100% on every line this story's diff added**, exceeding the ≥80% floor.

## Run results

```
Test Files  1 passed (1)
     Tests  26 passed (26)
  Duration  ~220ms
```

Regression set (cam-401 + cam-400 + cam-344 + cam-355 + cam-302): 5 files, 206/206 passed.

Full repo suite (`npx vitest run`): 167 test files, 6492 tests — **4 failing test files, 4 failing tests**, all confirmed pre-existing (bit-for-bit identical failure, verified by re-running the same 4 files with this story's test-file change `git stash`ed out):
- `__tests__/delivery-client.test.ts` — known pre-existing env-dependent failure (missing generated `@/prisma/delivery/generated/delivery-client` package in this sandbox), per dispatch — ignored.
- `__tests__/delivery-tickets-api.test.ts` — same missing-package root cause as above (not separately named in the dispatch but identical class/mechanism, confirmed pre-existing via the stash re-run).
- `__tests__/f5-account-misc.test.ts`, `__tests__/f6-palette-guard.test.ts` — known pre-existing `git diff staging` artifacts, per dispatch — ignored.

`npm run lint`: 0 errors, 247 pre-existing warnings (none in the touched test file — confirmed via `grep`). `npm run typecheck`: same 22 pre-existing errors (all `@/prisma/delivery/generated/delivery-client` missing-package + unrelated `tx: any` in `lib/delivery/tickets.ts`), confirmed identical via `git stash` re-run — zero new typecheck errors from this story's test-only diff.

## Defects found

None. All 3 capped surfaces behave per spec; no functional gap found in the build-phase diff.

## Links

`story.md` (AC/BR/EC) · `.claude/rules/qa.md` · `.claude/rules/architecture.md` §15b (the reader/writer sweep this story's BR-2 executes) · `docs/specs/.../CAM-400-.../test.md` (sibling story, same suite convention: mocked-prisma unit/integration split, Prove-It-by-hand documented in prose)

## Changelog
- v1 (2026-07-18) — created; 3 surfaces verified independently with real red-on-revert proofs, 3 real gaps closed (366-boundary on the hold-clamp x2, 8000-year abuse-shape + no-leak check on the holds route, branch-coverage gap on the clamp ternary), 0 defects found, new-code coverage 100%
