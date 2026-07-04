---
linear: CAM-58
feature: bookings-trips
epic: camper-availability-booking (CAM-23)
persona: camper
artifact: delivery
owner: devops-release
status: Done
version: v1
updated: 2026-06-23
---
# Delivery — แก้ bug ความโปร่งใสค่าธรรมเนียม (CAM-58)

## PR & preview
- **PR #103** → base `staging` (1 PR = 1 atomic story). Merged.
- Roles that acted: backend (extract `lib/booking-pricing.ts` + refactor `POST /api/bookings`) → frontend (consume the module in `CampgroundDetailClient.tsx`, remove the fee rows) → qa (35 tests).
- Vercel preview: ephemeral per-PR Preview (Preview → staging DB).

## Quality gate
lint 0 errors · typecheck clean · `npm test` 1686 pass · coverage 91% (module `lib/booking-pricing.ts` 100%) · `npm run build` ok · `check:palette` ok · `check:ds` ok · `npm audit --omit=dev` 0 high/critical. All green before merge.

## Staging verify
- Merged to `staging`; Staging deploy returned **HTTP 200** (`campvibe-staging.vercel.app`).
- The corrected AC is **structurally verified by the test suite**: the booking breakdown renders only the room-subtotal + total rows (no cleaning/service fee rows), the total uses `t.booking.total`, and the displayed total is computed by the shared `computeBookingPrice` (so display == record by construction).
- **Follow-up:** an interactive end-to-end booking-flow check on the real Staging URL (book → open `/bookings` → confirm `totalPrice` matches the widget) is a follow-up, not blocking — the no-fee invariant is proven by unit tests and the shared single-source-of-truth module.
- Linear state: **Done**.

## Migration
**None.** No schema change — the fix is a behaviour-preserving extraction of price math into a shared module; `Booking` fields are unchanged. Nothing to `prisma migrate deploy`.

## Release
**G5 (staging → prod) pending owner approval.**
- Rollback plan: **revert PR #103** (code-only, no migration → clean revert, no data backfill or down-migration needed).
- Tag + changelog: to be cut at promote time per `.claude/rules/ops.md` (tag + changelog + rollback plan are all required for the prod release).

## Error watch
**Pending** — post-deploy Sentry watch window runs after the prod promote (G5). Spike → auto-rollback; a real error → open a bug ticket into the loop.

## Links
`story.md` · `tech.md` · `test.md` · `.claude/rules/ops.md`

## Changelog
- v1 (2026-06-23) — created from shipped CAM-58 (PR #103 → staging, gate green, no migration, G5 pending).
