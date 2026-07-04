---
linear: CAM-60
feature: bookings-trips
epic: camper-pre-trip-my-bookings (CAM-24)
persona: camper
artifact: test
owner: qa
status: Backlog
version: v1
updated: 2026-06-23
---
# Test Artifact — CAM-60 Status label การจองแปลเป็นภาษาไทย

## AC → Test Matrix

| AC# | Test-id | Layer | Description | Pass/Fail |
|-----|---------|-------|-------------|-----------|
| AC-1 | `unit--booking-status-pending-warning` | unit | PENDING → labelKey 'statusPending', variant 'warning' | PASS |
| AC-2 | `unit--booking-status-confirmed-success` | unit | CONFIRMED → labelKey 'statusConfirmed', variant 'success' | PASS |
| AC-3 | `unit--booking-status-cancelled-muted` | unit | CANCELLED → labelKey 'statusCancelled', variant 'muted' | PASS |
| AC-3 | `unit--booking-status-cancelled-not-destructive` | unit | CANCELLED variant is NOT 'destructive' (regression guard) | PASS |
| AC-4 | `unit--booking-status-completed-info` | unit | COMPLETED → labelKey 'statusCompleted', variant 'info' | PASS |
| AC-5 | `copy--th-status-pending` | unit (i18n) | th.bookings.statusPending === 'รอยืนยัน' verbatim | PASS |
| AC-6 | `copy--th-status-confirmed` | unit (i18n) | th.bookings.statusConfirmed === 'ยืนยันแล้ว' verbatim | PASS |
| AC-7 | `copy--th-status-cancelled` | unit (i18n) | th.bookings.statusCancelled === 'ยกเลิกแล้ว' verbatim | PASS |
| AC-8 | `copy--th-status-completed` | unit (i18n) | th.bookings.statusCompleted === 'เข้าพักแล้ว' verbatim | PASS |
| AC-5 | `copy--en-status-pending` | unit (i18n) | en.bookings.statusPending === 'Pending' | PASS |
| AC-6 | `copy--en-status-confirmed` | unit (i18n) | en.bookings.statusConfirmed === 'Confirmed' | PASS |
| AC-7 | `copy--en-status-cancelled` | unit (i18n) | en.bookings.statusCancelled === 'Cancelled' | PASS |
| AC-8 | `copy--en-status-completed` | unit (i18n) | en.bookings.statusCompleted === 'Completed' | PASS |
| AC-9 | `unit--booking-status-unknown-fallback` | unit | 'NO_SHOW' → { labelKey: null, variant: 'muted' } | PASS |
| AC-9 | `unit--booking-status-empty-string-fallback` | unit | '' → { labelKey: null, variant: 'muted' } | PASS |
| AC-9 | `unit--booking-status-garbage-fallback` | unit | 'REFUNDED' → fallback, no throw | PASS |
| AC-9 | `unit--booking-status-no-throw` | unit | unknown status does NOT throw | PASS |
| wiring | `source--page-imports-util` | source-inspection | page.tsx imports getBookingStatusMeta from @/lib/booking-status | PASS |
| wiring | `source--page-calls-util` | source-inspection | page.tsx calls getBookingStatusMeta(booking.status) | PASS |
| wiring | `source--page-no-statusVariant` | source-inspection | page.tsx does NOT define old statusVariant function | PASS |
| wiring | `source--page-no-hardcoded-map` | source-inspection | page.tsx does NOT inline PENDING/CONFIRMED raw variant map | PASS |
| wiring | `source--page-badge-variant` | source-inspection | Badge receives variant={variant} from util result | PASS |
| wiring | `source--page-ac9-fallback` | source-inspection | unknown labelKey falls back to raw booking.status | PASS |

**Total tests in `__tests__/booking-status.test.ts`: 35 passed, 0 failed**

## Coverage Report (lib/booking-status.ts)

Run: `npx vitest run __tests__/booking-status.test.ts --coverage --coverage.include="lib/booking-status.ts"`

| Metric | % | Lines covered |
|--------|---|---------------|
| Statements | 100% | 5/5 |
| Branches | 100% | 2/2 |
| Functions | 100% | 1/1 |
| Lines | 100% | 4/4 |

Coverage on new code: **100%** (target: >=80%).

## Coverage Matrix per AC (per .claude/rules/qa.md)

| Bucket | Covered? | Notes |
|--------|----------|-------|
| normal (happy path) | Yes | All 4 known statuses tested |
| null/empty | Yes | '', 'NO_SHOW', 'REFUNDED' all return fallback |
| boundary (min/max/off-by-one) | Yes | lowercase 'pending' case-sensitive boundary |
| error/validation | Yes | No throw on unknown input |
| concurrent/ordering | N/A | Pure function, no concurrency concern |

## Prove-It (Red before Green)

Every key test was verified to fail when the logic is broken:
- Removing `STATUS_MAP.PENDING` → `labelKey 'statusPending'` assertion fails
- Setting `CANCELLED → 'destructive'` → both the `muted` test AND the `not.toBe('destructive')` regression test fail
- Removing `getBookingStatusMeta` import from `page.tsx` → source-inspection test fails
- Changing Thai string → verbatim copy assertion fails character-for-character

## Regression Suite Realignment (2026-06-23)

Two pre-existing test files contained stale source-inspection assertions against the old pre-CAM-60 API (`statusVariant` function + `CANCELLED→'destructive'`). These were updated as test maintenance (QA domain) to assert the new `getBookingStatusMeta` behavior. No test was deleted or weakened — only the coupled implementation details were corrected.

### `__tests__/ds4-badge-auth.test.ts` — 6 tests updated in `badge--status-bookings`

Original intent (preserved): bookings page maps statuses to semantic Badge variants, not raw spans.
- `function statusVariant` assertion → `getBookingStatusMeta` + `booking-status` import
- `CANCELLED → 'destructive'` → assert absence of `return 'destructive'` and `function statusVariant`
- `<Badge variant={statusVariant(...)}` → `variant={variant}` (from util destructure)
- `AC-i18n-1` → `{booking.status}` in JSX updated to `t.bookings[labelKey` (i18n via labelKey from util)
- Over-image `ring-2 ring-card` test preserved unchanged

### `__tests__/f5-account-misc.test.ts` — 7 tests updated in `AC-token-2` + `AC-dark-1`

Original intent (preserved): status badges use semantic tokens, not raw palette classes.
- `AC-token-2`: `function statusVariant` / `return 'destructive'` / `variant={statusVariant(...)}` → asserts util usage + absence of old patterns. Raw-palette guards (no `bg-green-N` etc.) unchanged.
- `AC-dark-1`: CONFIRMED/CANCELLED/PENDING tests updated to assert `getBookingStatusMeta` call and `variant={variant}`; CANCELLED now correctly asserts `not 'destructive'`.

## Checks

- [x] `npm run typecheck` passes (0 errors)
- [x] `npm run lint` passes (0 errors; 224 pre-existing warnings, no new warnings added)
- [x] `__tests__/booking-status.test.ts` — 35 tests, all PASS
- [x] `__tests__/ds4-badge-auth.test.ts` — 72 tests, all PASS (6 tests realigned to CAM-60 API)
- [x] `__tests__/f5-account-misc.test.ts` — 246 tests, all PASS (7 tests realigned to CAM-60 API)
- [x] `npm test` (full suite) — 38 test files, 2114 tests, 0 failures
- [x] Coverage on `lib/booking-status.ts` — 100% (statements/branches/functions/lines)
- [x] Every AC mapped 1:1 to a test asserting both the visible result (Thai/EN copy verbatim) and the system result (labelKey + variant)
- [x] Thai copy asserted verbatim character-for-character
- [x] Prove-It: each test verified to fail with broken logic before passing

## Status

status: ready — all 2114 tests pass (38 files, 0 failures), coverage 100% on `lib/booking-status.ts`. No open defects.

next: ready to merge → staging; verify AC on campvibe-staging.vercel.app/bookings (th + en, all 4 statuses) after merge to mark story Done.
