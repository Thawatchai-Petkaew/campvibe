---
linear: CAM-59
feature: bookings-trips
epic: camper-availability-booking (CAM-23)
persona: camper
artifact: delivery
owner: devops-release
status: Done
version: v1
updated: 2026-06-23
---
# Delivery — หน้ายืนยันการจองและรหัสการจอง (CAM-59)

## PR & preview

PR: pending (G3 — merge to staging) · Branch: `feat/cam-59-booking-confirmation` · Vercel Preview: auto-generated on PR open

## Staging verify

Staging URL: https://campvibe-staging.vercel.app

AC to verify on the real Staging URL:

| AC | Scenario | Expected | Status |
|---|---|---|---|
| AC#1 | Book a campsite while logged in → press "จอง" | Redirect to `/bookings/{id}/confirmation`; page shows "การจองสำเร็จแล้ว" + checkmark | Pending on deploy |
| AC#2 | Load confirmation page | Shows camp name, check-in, check-out, guests, total, "รหัสการจอง: CAMP-XXXXXXXX" | Pending on deploy |
| AC#3 | Press "ดูการจองทั้งหมด" | Navigates to `/bookings` | Pending on deploy |
| AC#4 | Press "กลับไปดูลานแคมป์" | Navigates back to camp detail page | Pending on deploy |
| AC#5 | Logged-in user B opens user A's booking URL | Shows "ไม่พบข้อมูลการจอง" (HTTP 404) | Pending on deploy |
| AC#6 | Unauthenticated user opens confirmation URL | Redirected to `/login` | Pending on deploy |
| AC#7 | Any user opens `/bookings/nonexistent-id/confirmation` | Shows "ไม่พบข้อมูลการจอง" (HTTP 404) | Pending on deploy |

Staging verification method: book a campsite on https://campvibe-staging.vercel.app → confirm redirect to `/bookings/{id}/confirmation` showing "การจองสำเร็จแล้ว" + "รหัสการจอง: CAMP-XXXXXXXX" + status badge; visiting another user's booking id → "ไม่พบข้อมูลการจอง" (404).

## Migration

None. No schema changes. Existing `Booking` model fields used as-is (`id`, `checkInDate`, `checkOutDate`, `guests`, `totalPrice`, `userId`, `campSiteId` + relation `campSite`). No `prisma migrate deploy` required on staging or prod.

## Release

Not yet promoted to prod (awaiting G4 sign-off).

Rollback plan (if needed after promotion):
- Revert the squash-merge commit on `staging` (`git revert <merge-sha>` or `git revert -m 1 <merge-sha>`) and push.
- Code-only change: no migration to roll back, no DB state affected.
- After revert, post-booking redirect returns to prior behavior (`/bookings` list).

git tag: pending (G5) · changelog entry: pending (G5)

## Error watch

Pending — Sentry error watch to be conducted after staging auto-deploy settles. Thresholds: error rate >= 2x pre-deploy baseline or > 10% of requests erroring = rollback + notify.

## Gate results (G3)

| Gate | Result |
|---|---|
| `npm run lint` | 0 errors |
| `npm run typecheck` | clean |
| `npm test` (CAM-59 suite) | 2160 pass / 0 fail; 100% coverage on `lib/booking-ref.ts` |
| `npm run build` | success |
| `check:palette` + `check:ds` | PASS |
| `npm audit --omit=dev` | 0 high / 0 critical |
| Security review | PASS — owner-scoped fetch, no IDOR, no PII to client, unified 404 for wrong-owner + non-existent |

## Links

`story.md` · `design.md` · `tech.md` · `test.md` · `review.md` · `.claude/rules/ops.md`

## Changelog

- v1 (2026-06-23) — created; G3 merge to staging
