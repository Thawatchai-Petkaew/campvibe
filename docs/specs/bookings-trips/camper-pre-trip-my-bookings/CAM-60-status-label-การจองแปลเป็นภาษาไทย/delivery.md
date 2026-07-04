---
linear: CAM-60
feature: bookings-trips
epic: camper-pre-trip-my-bookings (CAM-24)
persona: camper
artifact: delivery
owner: devops-release
status: Done
version: v1
updated: 2026-06-23
---

# Delivery — Status label การจองแปลเป็นภาษาไทย (CAM-60)

## PR & preview

PR: feat/cam-60-thai-status-labels → staging (see step 5 for PR number)
Staging URL: https://campvibe-staging.vercel.app/bookings

## Gate results

| Check | Result |
| --- | --- |
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | clean |
| `npm test` | 2114 pass / 0 fail — `__tests__/booking-status.test.ts` 100% coverage on `lib/booking-status.ts` |
| `npm run build` | success |
| `npm run check:palette` | PASS |
| `npm run check:ds` | PASS |
| `npm audit --omit=dev` | unchanged (display-only, no new deps) |
| Security self-check | clean — display-only, no authz/secret/DB change |

## Staging verify

Open `https://campvibe-staging.vercel.app/bookings` after merge to staging auto-deploy:

| # | AC | Expected | Result |
| --- | --- | --- | --- |
| 1 | PENDING badge (TH) | "รอยืนยัน" yellow | verify on real URL post-deploy |
| 2 | CONFIRMED badge (TH) | "ยืนยันแล้ว" green | verify on real URL post-deploy |
| 3 | CANCELLED badge (TH) | "ยกเลิกแล้ว" gray | verify on real URL post-deploy |
| 4 | COMPLETED badge (TH) | "เข้าพักแล้ว" blue | verify on real URL post-deploy |
| 5 | PENDING badge (EN) | "Pending" | verify on real URL post-deploy |
| 6 | CONFIRMED badge (EN) | "Confirmed" | verify on real URL post-deploy |
| 7 | CANCELLED badge (EN) | "Cancelled" | verify on real URL post-deploy |
| 8 | COMPLETED badge (EN) | "Completed" | verify on real URL post-deploy |
| 9 | Unknown status edge case | raw string, no crash | verify on real URL post-deploy |

## Design tokens added

Two new CSS design tokens added to `app/globals.css` and consumed by `components/ui/badge.tsx`:

- `--warning` / `--warning-foreground` — yellow, used for PENDING badge
- `--info` / `--info-foreground` — blue, used for COMPLETED badge

New badge variants added: `warning` and `info` (alongside existing `default`, `secondary`, `destructive`, `outline`).
CANCELLED uses existing `secondary` (muted/gray). CONFIRMED uses existing `default` (green success).

## Migration

None — display-only change. No Prisma schema change. No database migration required.
`Booking.status` field remains unchanged as a `String` in the DB.

## Release

Not yet (pending G4 sign-off + G5 promote).
Tag, changelog entry, and rollback plan will be authored at promote time.

**Rollback plan (staging, if needed):**

```bash
# Revert the squash-merge commit on staging
git revert <merge-sha> --no-edit
git push origin staging
```

This is a code-only change (no migration), so revert is instant and safe with no data risk.

## Error watch

Pending — staging auto-deploy in progress after merge.
Sentry watch window starts after staging deploy completes. No prod watch until G5.

## Links

`story.md` · `design.md` · `tech.md` · `test.md` · `.claude/rules/ops.md`

## Changelog

- v1 (2026-06-23) — delivery artifact created; G3 merge to staging in progress
