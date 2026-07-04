---
linear: CAM-61
feature: bookings-trips
epic: camper-pre-trip-my-bookings (CAM-24)
persona: camper
artifact: test
owner: qa-engineer
status: Backlog
version: v1
updated: 2026-06-23
---
# Test — หน้ารายละเอียดการจอง /bookings/[id] (CAM-61)

## AC→test matrix

| AC# | test-id | layer | description | pass/fail |
|-----|---------|-------|-------------|-----------|
| AC#1 | `btn--booking-cancel` / CONFIRMED 200 | unit + integration | CONFIRMED → 200 full shape + isCancellable=true + statusLabel "statusConfirmed" | pass |
| AC#2 | `btn--booking-cancel` / PENDING 200 | unit + integration | PENDING → 200 + isCancellable=true + statusLabel "statusPending" | pass |
| AC#3 | `btn--booking-cancel` / CANCELLED hidden | unit | CANCELLED → isCancellable=false; cancel button not rendered | pass |
| AC#4 | `btn--booking-cancel` / COMPLETED hidden | unit | COMPLETED → isCancellable=false; cancel button not rendered | pass |
| AC#5 | `btn--booking-cancel` / cancel success | unit/source | handleCancel PATCHes {status:'CANCELLED'}; on res.ok → setBooking + toast.success(bookingCancelledSuccess) | pass |
| AC#6 | `btn--booking-cancel` / cancel error | unit/source | on !res.ok or throw → toast.error(errorOccurred); no setBooking call | pass |
| AC#7 | `badge--booking-status` / wrong-owner 404 | integration + source | wrong-owner → same 404 "Booking not found" as missing; no 403 (no existence leak) | pass |
| AC#8 | `page--booking-detail` / unauth 401 | integration | no session → GET returns 401 | pass |
| AC#9 | `section--booking-loading` / skeleton exists | source | loading.tsx file exists with Skeleton component (AC#9) | pass |
| AC#10 | `page--booking-notfound` / 404 not found | integration + source | booking not found → 404 "Booking not found"; not-found.tsx has backToBookings CTA | pass |
| AC#11 | `section--booking-dates` / th-TH date | unit + source | toLocaleDateString('th-TH',...) produces 2568 (พ.ศ.); en-US produces 2025 | pass |

## Security assertions (Rules / AC#7)

| Check | layer | pass/fail |
|-------|-------|-----------|
| `getOwnedBooking` uses `where: { id, userId }` at DB layer — not post-fetch JS | source | pass |
| `prisma.booking.findFirst` used (not findUnique + filter) | source | pass |
| GET handler maps null → 404 for both missing and wrong-owner (no 403 split) | source + integration | pass |
| GET handler passes `session.user.id` to `getOwnedBooking` (not a body/param value) | integration | pass |
| `lib/bookings.ts` contains no 403 response | source | pass |

## i18n verbatim assertions

| Key | Thai value asserted | pass/fail |
|-----|---------------------|-----------|
| `th.bookings.detail.backToBookings` | กลับไปยังการจองของฉัน | pass |
| `th.bookings.detail.forbidden` | ไม่พบข้อมูลการจอง หรือคุณไม่มีสิทธิ์เข้าถึง | pass |
| `th.bookings.bookingCancelledSuccess` | ยกเลิกการจองสำเร็จ | pass |
| `th.bookings.errorOccurred` | เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง | pass |
| `th.bookings.statusConfirmed` | ยืนยันแล้ว | pass |
| `th.bookings.statusPending` | รอยืนยัน | pass |
| `th.bookings.statusCancelled` | ยกเลิกแล้ว | pass |
| `th.bookings.statusCompleted` | เข้าพักแล้ว | pass |

## Coverage

| File | % Stmts | % Branch | % Funcs | % Lines | Notes |
|------|---------|----------|---------|---------|-------|
| `lib/booking-status.ts` | 100% | 100% | 100% | 100% | Measured via `npx vitest run --coverage --coverage.include='lib/booking-status.ts'` |
| `lib/bookings.ts` | 0% (mocked) | 0% (mocked) | 0% (mocked) | 0% (mocked) | Pure Prisma query; mocked at the boundary per repo convention. Owner-scope proven via source-inspection (where clause) and integration tests that assert what arguments reach the mock. No real-DB integration test environment available in this project. |
| GET route handler (`app/api/bookings/[id]/route.ts`) | measured via integration | — | — | — | 401, 404 (missing), 404 (wrong-owner), 200, 500 paths all covered via mocked handler tests. |

New pure-logic code (`lib/booking-status.ts`): **100% statements/branches/functions/lines** (measured).

Source-inspection note: `lib/bookings.ts` and the Next.js Server Component pages (`page.tsx`, `not-found.tsx`, `loading.tsx`) are server-only files that cannot be unit-tested without a real Postgres DB or a full Next.js render environment. These are covered by source-inspection tests (asserting exact code constructs such as the `where: { id, userId }` clause, `notFound()` call, and `redirect("/login")`), following the same pattern used in the rest of this repo for Server Component code.

## Test run summary

- Suite: `__tests__/cam-61-booking-detail.test.ts`
- Tests: 61 pass, 0 fail (run: `npx vitest run __tests__/cam-61-booking-detail.test.ts`)
- Full suite after adding CAM-61: 2221 pass, 0 fail, 40 test files
- `npm run typecheck`: pass (0 errors)
- `npm run lint`: 0 errors, 224 pre-existing warnings (0 new warnings added)

## Links

`story.md` (AC/Rules) · `tech.md` (endpoint contract) · `.claude/rules/qa.md` · `__tests__/cam-61-booking-detail.test.ts`

## Changelog
- v1 (2026-06-23) — created; 61 tests covering all 11 ACs + security/i18n/testid assertions
