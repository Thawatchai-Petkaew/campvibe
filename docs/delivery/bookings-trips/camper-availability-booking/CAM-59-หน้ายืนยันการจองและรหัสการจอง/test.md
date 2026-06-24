---
linear: CAM-59
feature: bookings-trips
epic: camper-availability-booking (CAM-23)
artifact: test
owner: qa
status: Done
version: v1
updated: 2026-06-23
---
# Test — หน้ายืนยันการจองและรหัสการจอง (CAM-59)

## AC → Test Matrix

| AC# | Description | Test ID | Layer | Pass/Fail |
|---|---|---|---|---|
| AC#1 | หน้าเปลี่ยนไปยังหน้ายืนยัน (redirect after booking, no setTimeout) | `page--confirmation-redirect` | source-inspection: CampgroundDetailClient.tsx | PASS |
| AC#1 | ใช้ router.push ไม่ใช่ setTimeout/window.location.href | `page--confirmation-router-push` | source-inspection: CampgroundDetailClient.tsx | PASS |
| AC#1 | page.tsx เป็น Server Component (async, ไม่มี "use client") | `page--confirmation-server-component` | source-inspection: page.tsx | PASS |
| AC#2 | รหัสการจอง CAMP-XXXXXXXX (first 8 chars of UUID, uppercase) | `text--booking-ref-format` | unit: formatBookingRef | PASS |
| AC#2 | รหัสการจอง: ตัวพิมพ์เล็กถูก uppercase | `text--booking-ref-uppercase` | unit: formatBookingRef | PASS |
| AC#2 | รหัสการจอง: ยาว 13 chars เสมอ (CAMP- + 8) | `text--booking-ref-length` | unit: formatBookingRef | PASS |
| AC#2 | edge: id สั้นกว่า 8 ตัวไม่ crash | `text--booking-ref-short-id` | unit: formatBookingRef | PASS |
| AC#2 | edge: empty string ไม่ crash | `text--booking-ref-empty` | unit: formatBookingRef | PASS |
| AC#2 | i18n: th.bookings.bookingRefLabel === "รหัสการจอง" | `text--booking-ref-label-th` | unit: translations.json | PASS |
| AC#3 | "ดูการจองทั้งหมด" button key present (TH) | `btn--view-all-bookings-th` | unit: translations.json | PASS |
| AC#3 | "View all bookings" button key present (EN) | `btn--view-all-bookings-en` | unit: translations.json | PASS |
| AC#4 | "กลับไปดูลานแคมป์" button key present (TH verbatim) | `btn--back-to-campsite-th` | unit: translations.json | PASS |
| AC#4 | "Back to campsite" button key present (EN) | `btn--back-to-campsite-en` | unit: translations.json | PASS |
| AC#5 | wrong-owner → 404 (scoped query: { id, userId: session.user.id }) | `page--confirmation-owner-scope` | source-inspection: page.tsx | PASS |
| AC#5 | ไม่มี 403 branch (no existence leak, unified null → notFound) | `page--confirmation-no-403` | source-inspection: page.tsx | PASS |
| AC#5 | notFound() call-site exists (if !booking block) | `page--confirmation-not-found-call` | source-inspection: page.tsx | PASS |
| AC#6 | unauthenticated → redirect("/login") | `page--confirmation-auth-redirect` | source-inspection: page.tsx | PASS |
| AC#6 | reads session via auth() server-side (not from body/param) | `page--confirmation-session-server` | source-inspection: page.tsx | PASS |
| AC#7 | non-existent id → same 404 path as AC#5 (unified null path) | `page--confirmation-not-exist-404` | source-inspection: page.tsx | PASS |
| AC#7 | th.bookings.notFound === "ไม่พบข้อมูลการจอง" (verbatim) | `page--confirmation-not-found-th` | unit: translations.json | PASS |
| AC#7 | not-found.tsx uses t.bookings.notFound (not hardcoded) | `page--not-found-i18n-wired` | source-inspection: not-found.tsx | PASS |

Total: 21 AC-mapped tests + 25 supplementary assertions (boundaries, prove-it, structural completeness) = **46 tests, 46 passed**.

## Coverage

| File | Stmts | Branch | Funcs | Lines | Method |
|---|---|---|---|---|---|
| `lib/booking-ref.ts` | 100% | 100% | 100% | 100% | `npx vitest run --coverage --coverage.include="lib/booking-ref.ts"` |

Coverage is 100% on the new `lib/booking-ref.ts` (the only pure-logic new file; Server Component and client component cannot be meaningfully instrumented in the vitest/node environment per CAM-79/61 precedent).

## Prove-It (Red-Before-Green)

All formatBookingRef unit tests were verified to go red against a broken implementation before correction:

- Removing the `"CAMP-"` prefix → `toBe('CAMP-A1B2C3D4')` fails.
- Removing `.toUpperCase()` → lowercase input assertion fails.
- Changing `.slice(0, 8)` to `.slice(0, 6)` → length assertion and exact-value assertion both fail.
- The prove-it test explicitly confirms: `formatBookingRef('f47ac10b-...')` must be `'CAMP-F47AC10B'` and must not contain `-58cc` (the rest of the UUID segment).

Source-inspection tests were verified against the actual source:
- `redirect("/login")` uses double-quotes — assertion matched to actual code.
- `notFound()` appears in the import line and as a call; assertions target the call-site pattern `if (!booking) {` and `notFound();` directly.
- `'403'` appears only in a comment; assertions target the actionable anti-patterns `status: 403` and `code: 403` which are absent.

## Source-Inspection Note (Server Component Layer)

`app/bookings/[id]/confirmation/page.tsx` is an async Server Component that imports `auth()` from NextAuth, `prisma` from `@/lib/prisma`, and `notFound`/`redirect` from `next/navigation`. These imports require the full Next.js runtime (RSC streaming, the NextAuth adapter, Prisma client bindings) which are not available in the vitest/node environment. Per the precedent established for CAM-79 and CAM-61, **source-inspection** is the correct and sufficient layer for verifying server-component authz contracts, redirect paths, and data-fetch wiring. The pure utility `formatBookingRef` is fully unit-testable and achieves 100% coverage independently.

## Full Suite

```
Test Files: 39 passed (39)
Tests:      2160 passed (2160)
```

No regressions in the full suite. `npm run typecheck` clean. `npm run lint` 0 errors (224 pre-existing warnings unchanged; no new warnings added).

## Defects

None found. Owner-scope check (`userId: session.user.id`) confirmed present. 404-only path (no existence leak via 403) confirmed. Redirect change (router.push, no setTimeout) confirmed. All Thai copy verbatim assertions pass.

## Next Step

Ready to merge → staging. AC must be verified on the real Staging URL (campvibe-staging.vercel.app): complete a booking, confirm redirect to `/bookings/{id}/confirmation`, confirm the `CAMP-XXXXXXXX` reference is displayed, confirm wrong-user and unauthenticated access show 404/login respectively.
