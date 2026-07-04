---
linear: CAM-71
feature: notifications-messaging
epic: foundation-notifications-infra (CAM-31)
persona: platform
artifact: delivery
owner: devops-release
status: Done
version: v1
updated: 2026-06-23
---
# Delivery — Email infra (Resend) + templates (CAM-71)

## PR & preview
- **PR #106** → merged into `staging`.
- Gate green before merge: lint 0 errors · typecheck · `npm test` (1772 green, +42 from this story) · `npm run build` · `npm audit --omit=dev` 0 high/critical. No UI → design gate N/A. Roles: backend.
- Linear: state **Done**.

## Staging verify
- Code present on `staging` (campvibe-staging.vercel.app). CAM-71 is **infra only** — there is no route or trigger to exercise yet, so the end-to-end "email received within 1 minute" check is **deferred to the wiring stories (CAM-62 / CAM-74)** where the facade is actually called on a booking/KYC event.
- Verified at the unit level on the merged code: facade sends/skips/fails correctly and templates render the correct Thai content (see `test.md`, 42 tests). Until `RESEND_API_KEY` is set, the facade is a safe no-op on Staging by design (logs `email_skipped`).

## Migration
**None.** No schema change in this story; the existing `Notification` model is untouched. Nothing to `prisma migrate deploy`.

## DevOps action (required before CAM-62/74 go live)
Set both env vars in **Vercel — Staging and Production** (separate keys per env; server-only, never `NEXT_PUBLIC_*`):
- `RESEND_API_KEY` — the Resend API key (Resend free tier, no cost confirmed by owner). **Different key for Staging vs Production.**
- `EMAIL_FROM` — sender identity (default `CampVibe <noreply@campvibe.app>` if unset).

Until both are set, email is a guarded no-op (returns `{ok:true, skipped:true}`, logs `email_skipped`) and nothing breaks. The keys must be in place **before** CAM-62 / CAM-74 enable real sending; verify against the verified sender domain in Resend.

## Release
- **G5 pending.** This infra story is Done on `staging` but not yet promoted to prod; it ships in a release train (likely together with the CAM-62/74 wiring once those are Done).
- **Tag + changelog:** to be cut at promotion (`/promote-release --to prod`).
- **Rollback plan:** revert PR #106 (or revert the release commit). Clean and low-risk — no migration to reverse, no route exposed, and the facade is dormant (no-op) until a caller wires it in and the env keys are set.

## Error watch
Pending (no prod deploy yet). At G5, watch Sentry for the standard window after promote. Note: a `RESEND_API_KEY` misconfig surfaces as `email_skipped` (warn) rather than a user-facing error; a real Resend/network failure surfaces as `email_send_error` (error) and `{ok:false}` without breaking the caller.

## Links
`story.md` · `tech.md` · `test.md` · `.claude/rules/ops.md` · `docs/SETUP-ENVS.md` (env var matrix)

## Changelog
- v1 (2026-06-23) — created; PR #106 → staging (Done), no migration, recorded the DevOps env action (RESEND_API_KEY + EMAIL_FROM, separate keys, Staging+Prod) and G5-pending release/rollback.
