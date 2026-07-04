---
linear: CAM-61
feature: bookings-trips
epic: camper-pre-trip-my-bookings (CAM-24)
persona: camper
artifact: delivery
owner: devops-release
status: In Progress
version: v1
updated: 2026-06-23
---
# Delivery — หน้ารายละเอียดการจอง /bookings/[id] (CAM-61)

## PR & preview

PR: pending (branch `feat/cam-61-booking-detail` → `staging`)
Vercel Preview: auto-generated on PR open (ephemeral)

## Gate numbers (G3 pre-merge)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | 0 errors |
| `npm test` | 2221 pass / 0 fail |
| `npm run build` | success |
| `check:palette` + `check:ds` | PASS |
| `npm audit --omit=dev` | 0 high / 0 critical (2 moderate, unfixable — PostCSS via `next`) |
| Security review | PASS — 0 Critical, 0 High (see review.md) |

## Security hardening note

Security review (review.md) found one Important finding: `userId: true` was included in the `getOwnedBooking` Prisma `select` and returned via `GET /api/bookings/[id]` response — unnecessary surface even though the endpoint is owner-gated (the authenticated user's own `userId` is not cross-user PII but the client does not need it). The orchestrator fixed this by removing `userId: true` from the `select` in `lib/bookings.ts` and the fix was re-verified green (typecheck + test + lint). This finding is now resolved; no merge block.

## Staging verify

Pending auto-deploy after merge to `staging` branch. Verification steps (to be confirmed post-deploy):

- Open `campvibe-staging.vercel.app/bookings/{id}` with a valid booking owned by the logged-in Camper
  - Expected: full booking detail displays — camp name, check-in/check-out dates in Thai พ.ศ. format ("5 ม.ค. 2568"), number of nights, guests, spot name (if any), total price, Thai status label, cancel button for PENDING/CONFIRMED
- Open `campvibe-staging.vercel.app/bookings/{another-users-id}` with a booking not owned by the session user
  - Expected: page shows "ไม่พบข้อมูลการจอง หรือคุณไม่มีสิทธิ์เข้าถึง" (404)
- Cancel flow: click "ยกเลิกการจอง" → confirm dialog "คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการจองนี้?" → confirm → status changes to "ยกเลิกแล้ว", cancel button disappears

AC coverage: AC-1 through AC-11 (see story.md). No migration required — read-only new GET endpoint + SSR page on existing schema.

## Migration

None. No schema changes in this story. Existing `Booking`, `CampSite`, and `CampSpot` tables are read-only.

## Release

Not yet released. This story will be promoted to prod in a future release train after G4 Staging sign-off.

- git tag: pending (prod release)
- changelog entry: pending
- rollback plan: revert the squash-merge commit on `staging` (`git revert <merge-sha>`) — code-only, no data migration to undo. Affected routes: `GET /api/bookings/[id]` (new), `app/bookings/[id]/page.tsx` (new), `lib/bookings.ts` (new helper). The pre-existing `PATCH /api/bookings/[id]` is unchanged.

## Error watch

Pending (post-prod deploy). Watch window: 30 minutes post-deploy. Threshold: error rate >= 2x pre-deploy baseline or > 10% of `/bookings/[id]` requests erroring = rollback + notify. Sentry not measured pre-deploy.

## Links

`story.md` · `design.md` · `tech.md` · `test.md` · `review.md` · `.claude/rules/ops.md`

## Changelog

- v1 (2026-06-23) — created at G3 merge
