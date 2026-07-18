---
linear: CAM-396
feature: booking-reliability
epic: booking-reliability-every-camper-can-complete-a-bo (CAM-395)
persona: camper
artifact: test
owner: qa-engineer
status: In Progress
version: v2
updated: 2026-07-18
---
# Test — Guest booking dead-end: pressing book shows a raw fail toast instead of the login modal (CAM-396)

## Test strategy note (read first)

`components/CampgroundDetailClient.tsx` is a large stateful client component (hooks: `useRouter`, multiple `useState`, closures over campground/session props) with **no jsdom/RTL render harness** in this repo's Vitest config (`environment: 'node'`). This is the established, repo-wide pattern for this exact component (see `__tests__/cam-394-stream-reviews.test.ts`, `__tests__/cam-368-photo-modal-a11y.test.ts`, `__tests__/wishlist-detail-toggle.test.ts`) — not a shortcut invented for this story. Two layers are used:

1. **i18n** — the Thai copy AC-3 promises is asserted verbatim against `locales/translations.json` (the source of truth the component reads from).
2. **Source-inspection Prove-It** — `handleReserve`'s function body is extracted from the shipped `.tsx` source via `indexOf` markers and asserted on structurally (branch order, exact string presence/absence). Each assertion is a **Prove-It**: demonstrated failing against the pre-fix source, passing against the fix (see § Prove-It below).

**What this does NOT cover** (browser-only, requires Playwright e2e or a manual owner check on the real dev/Staging URL): the `LoginModal` actually rendering on-screen for a guest tap, the sonner toast actually appearing with the right copy and no red native-error styling, and the real `POST /api/bookings` network call literally never leaving the browser. These are marked `owner-verify` in the matrix below.

## AC→test matrix

| AC/EC | risk (H/M/L) | type | test (it-block name) | file | pass/fail |
|---|---|---|---|---|---|
| AC-1 / EC-1 — guest tap opens login modal, no request sent | H | unit (source-inspection) | `[unit] handleReserve gates on isLoggedIn before the /api/bookings fetch` | `__tests__/cam-396-booking-login-gate.test.ts` | PASS |
| AC-1 / EC-1 (cont.) | H | unit | `[unit] the guest branch opens the existing LoginModal (setLoginOpen) and returns` | same | PASS |
| AC-1 / EC-1 — boundary: fires even before dates are chosen | H | unit | `[unit] EC-1 (no dates chosen yet): the login gate precedes the date-selection guard` | same | PASS |
| AC-1 — null/empty: `isLoggedIn` prop omitted defaults to guest (fail-safe/default-deny) | M | unit | `[unit] null/empty: isLoggedIn defaults to false (fail-safe/default-deny) when the prop is omitted` | same | PASS |
| AC-1 / BR-1 — no new UI, reuses the existing `LoginModal` instance | M | unit | `[unit] no new UI/component introduced — reuses the wishlist gate's LoginModal instance` | same | PASS |
| AC-1 — visible result (modal renders, no red error) | H | **owner-verify** (browser-only DOM render — see note above) | manual: guest taps "จอง" on localhost → `LoginModal` opens, no toast fires | — | pending owner check on dev |
| AC-3 / EC-3 / BR-2 — failure toast is Thai `จองไม่สำเร็จ`, never raw `data.error` | H | unit | `[unit] the non-ok branch does NOT pass data.error into the toast` | same | PASS |
| AC-3 / EC-3 / BR-2 (cont.) | H | unit | `[unit] the non-ok branch always shows t.newCampground.failedToReserve` | same | PASS |
| AC-3 — i18n: Thai copy verbatim | H | unit | `AC-3: th.newCampground.failedToReserve is "จองไม่สำเร็จ"` | same | PASS |
| AC-3 — visible result (toast renders on-screen) | M | **owner-verify** (browser-only) | manual: logged-in booking conflict on dev → toast shows `จองไม่สำเร็จ` | — | pending owner check on dev |
| EC-3 — catch/network-error branch untouched | M | unit | `[unit] the catch (network error) branch is untouched — still errorOccurred` | same | PASS |
| EC-3 — catch i18n copy verbatim | M | unit | `EC-3 (catch path): th.newCampground.errorOccurred is "เกิดข้อผิดพลาด"` | same | PASS |
| AC-2 / EC-2 — logged-in flow unchanged (fetch + redirect) | M | unit (regression guard) | `[unit] the date-selection guard and reserve fetch still run for a logged-in user` | same | PASS |
| AC-2 / EC-2 (cont.) | M | unit | `[unit] a successful booking still redirects to the confirmation page (no toast delay)` | same | PASS |
| BR-3 — server 401 remains the authoritative guard (client gate is UX only) | H | unit (source-inspection of `app/api/bookings/route.ts`) | `[unit] POST /api/bookings still requires an authenticated session server-side` | same | PASS |

13/13 automated tests pass. 2 rows are `owner-verify` (DOM rendering, browser-only) — both are the *visible* half of an AC whose *data/system* half (no fetch fires / no raw string in the toast call) is already proven server-side/structurally above; this is the standard split for this component per repo precedent, not a gap.

### Coverage-matrix bucket justification (per `.claude/rules/qa.md` §7)

| Bucket | AC-1 | AC-2 | AC-3 |
|---|---|---|---|
| normal | ✅ gate fires, no fetch | ✅ fetch+redirect unchanged | ✅ Thai copy shown |
| null/empty | ✅ `isLoggedIn` prop omitted → defaults `false` | ⚪ N/A — no null-input surface changed by this diff | ⚪ N/A — no null-input surface |
| boundary | ✅ gate precedes date-guard (guest w/ no dates yet) | ⚪ N/A — unchanged path | ⚪ N/A — status code doesn't branch (see below) |
| error/validation | ⚪ N/A — AC-1 is itself the "no request" branch, has no separate invalid-input case | ⚪ N/A — AC-2 is the happy path; its negative twin is AC-3, covered there | ✅ non-ok branch (covers 401/409/500 uniformly — the source has one generic `else`, not per-status branches, so one assertion is structurally complete) |
| concurrent/ordering | ⚪ N/A — double-submit / `isReserving` disable is pre-existing, unchanged by this ticket's scope (`components/CampgroundDetailClient.tsx` `handleReserve` gate + toast copy only) | ⚪ same reason | ⚪ same reason |

## Prove-It (red-before-green evidence — actually re-run, not asserted from the commit message)

Reverted `components/CampgroundDetailClient.tsx` to its pre-fix state (`git show <fix-commit>^:components/CampgroundDetailClient.tsx`) and re-ran the suite:

```
Test Files  1 failed (1)
     Tests  5 failed | 8 passed (13)
```

The 5 that go RED against the pre-fix source (exactly the ones this fix and this story's new tests are meant to guard):
- `[unit] handleReserve gates on isLoggedIn before the /api/bookings fetch` (no gate at all → index -1)
- `[unit] the guest branch opens the existing LoginModal (setLoginOpen) and returns`
- `[unit] EC-1 (no dates chosen yet): the login gate precedes the date-selection guard` (new test added by QA — see below)
- `[unit] the non-ok branch does NOT pass data.error into the toast` (pre-fix: `toast.error(data.error || t.newCampground.failedToReserve)`)
- `[unit] the non-ok branch always shows t.newCampground.failedToReserve`

Restored `HEAD` (the fix) → re-ran → 13/13 green again. `git status` confirmed a clean tree before and after (no stray diff left in the component).

## QA-added tests (gap found + closed; no production code touched)

Two tests were added to `__tests__/cam-396-booking-login-gate.test.ts` (implementation was NOT touched):

1. **`EC-1 (no dates chosen yet): the login gate precedes the date-selection guard`** — the shipped test only proved the login gate runs before the *fetch call*, not before the *date-selection guard*. EC-1 is phrased unconditionally ("IF a guest presses book...", no precondition on dates), so a guest who hasn't picked dates yet must also see the login modal, not the "เลือกวันที่" toast. Proven red on pre-fix source, green on the fix.
2. **`null/empty: isLoggedIn defaults to false (fail-safe/default-deny) when the prop is omitted`** — `isLoggedIn = false` is the component's default parameter (line 74); this is the fail-safe/default-deny case (`.claude/rules/security.md` — default-deny) for a caller that forgets to pass the prop. This existed before the fix too (not a Prove-It regression test for this specific bug) but was previously unasserted and is a real invariant this story's gate now depends on — a silent flip to `isLoggedIn = true` as the default would defeat the whole gate with zero other test signal.

No defect was found in the shipped fix itself — both additions close AC/EC coverage gaps in the test suite, not bugs in production code.

## Coverage (metric honesty)

```
npx vitest run __tests__/cam-396-booking-login-gate.test.ts --coverage --coverage.include="components/CampgroundDetailClient.tsx"

Statements   : 0% ( 0/238 )
Branches     : 0% ( 0/306 )
Functions    : 0% ( 0/67 )
Lines        : 0% ( 0/217 )
```

This is a real, measured number, reported honestly — **not** "not measured." It reads as 0% because every assertion in this file reads the component's source as a **string** (`fs.readFileSync`) rather than importing/executing/rendering it, so V8's instrumentation never sees the file's bytecode execute. This is a structural property of the source-inspection layer (see strategy note above), identical to the precedent in `cam-394-stream-reviews.test.ts`'s Part B and `cam-368`'s handler-extraction tests — it is not a sign of undertested behavior. The behavioral floor for this diff is the **AC→test matrix above (13/13 rows PASS)** plus the **Prove-It red/green demonstration**, not the v8 %.

The story's diff to `components/CampgroundDetailClient.tsx` itself is 14 lines (+9/-2 net per `git show --stat`), entirely inside `handleReserve`; every changed line is exercised by at least one of the 13 assertions above (traced manually against the diff hunk — the `if (!isLoggedIn)` block, the `setLoginOpen(true)`/`return`, and the `toast.error(t.newCampground.failedToReserve)` line all have a direct 1:1 assertion).

## Full-suite run

```
npx vitest run
 Test Files  3 failed | 159 passed (162)
      Tests  3 failed | 6476 passed (6479)
```

The 3 failures are exactly the pre-existing, environment-dependent ones named in the dispatch (worktree `git diff staging` artifacts / a missing `DELIVERY_DATABASE_URL` in this local env) — reproduced, not new:
- `__tests__/delivery-client.test.ts` — `throws a clear, safe error when DELIVERY_DATABASE_URL is not set`
- `__tests__/f5-account-misc.test.ts` — `git diff staging --name-only does not include app/status/page.tsx`
- `__tests__/f6-palette-guard.test.ts` — `git diff staging --name-only does not include app/status/page.tsx`

No new failures introduced by this story's test file or its 2 added cases. (6476 vs the dispatch's implied prior count — the 2 net-new QA tests account for the delta.)

## Quality gate summary (self-verify)

- `npm run lint`: 0 errors, 247 pre-existing warnings (none new, none in the touched test file).
- `npm run typecheck`: clean (`tsc --noEmit`, 0 errors).
- `npx vitest run __tests__/cam-396-booking-login-gate.test.ts`: 13/13 pass.
- `npx vitest run` (full suite): 6476/6479 pass, 3 known env-dependent failures (see above), no new failures.
- `npm run build`: not run — QA scope is test authorship/verification only per this dispatch; no production code was changed by QA (the fix already landed in commit `c496598` before this dispatch).
- `npm audit`: out of scope for QA — routes to `security`.

## Server-side / API contract note

BR-3 ("server 401 stays the authoritative guard") is verified by source-inspection of `app/api/bookings/route.ts` (`requireAuth()` + `if (authError) return authError;`, confirmed present). The full 5-error-code contract for `POST /api/bookings` (400/401/403/404/409) is **out of this story's scope** (`story.md` Scope line: `components/CampgroundDetailClient.tsx` only, no API change) and is already covered elsewhere — `__tests__/cam-209-rate1-abuse-hardening.test.ts`, `__tests__/cam-190-avail1-blockeddate.test.ts`, `__tests__/cam-57-atomic-lock.test.ts`, `__tests__/cam-355-per-spot-capacity-enforcement.test.ts` all exercise this endpoint's error paths. This story does not modify the route, so those tests are unaffected (confirmed: `app/api/bookings/route.ts` is not in the story's diff).

## Defects found

None. The shipped fix (commit `c496598`) matches every AC/BR/EC; the only additions QA made were 2 test cases closing coverage gaps in the test suite itself (see § QA-added tests above), not production bugs.

## Owner-verify (localhost, dev DB) — before Done

The 2 `owner-verify` rows in the AC→test matrix need a manual walk on localhost per `.claude/rules/ops.md` §3 (AC verified before merge into `dev`):

1. As a guest (no session), open a campground detail page, select dates, tap "จอง" → `LoginModal` opens, no red/native error toast appears, no `POST /api/bookings` request fires (check the Network tab).
2. As a logged-in user, trigger a booking conflict (e.g. re-book already-taken dates) → toast shows exactly `จองไม่สำเร็จ`, no English string.

AC-2 (logged-in happy path unchanged) is lower risk to hand-verify since the fix does not touch that branch at all (proven by the unit tests) — owner spot-check only.

## Links

`story.md` (AC/BR/EC) · `.claude/rules/qa.md` · `__tests__/cam-396-booking-login-gate.test.ts` · `components/CampgroundDetailClient.tsx` (`handleReserve`) · `app/api/bookings/route.ts` (unchanged, BR-3) · precedent: `__tests__/cam-394-stream-reviews.test.ts`, `__tests__/cam-368-photo-modal-a11y.test.ts`

## Changelog
- v1 (2026-07-18) — created
- v2 (2026-07-18) — QA verification pass: added 2 test cases (EC-1 date-guard ordering, isLoggedIn default-false), ran Prove-It red/green, full-suite + coverage run, authored AC→test matrix
