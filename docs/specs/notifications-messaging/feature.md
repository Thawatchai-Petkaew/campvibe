---
artifact: feature
feature: notifications-messaging (Notifications & Messaging)
personas: [platform, host, camper]
status: active
version: v3
updated: 2026-08-06
---
# Notifications & Messaging

## Overview
The channel CampVibe uses to keep camper, host, and the platform in sync about events they care about — a confirmed booking, a cancellation, a new reservation on a host's site, a KYC decision. It serves all three personas: the **camper** (booking lifecycle updates), the **host** (new-booking + KYC outcomes), and the **platform** (operational/transactional reach without a human in the loop). This is the F-2 line on the product plan and it unlocks H-6 (Communicate) and C-5.6 (booking confirmation via email/LINE).

↑ Master-Plan: `docs/project/master-plan.md` · product-plan item: **F-2 Notifications** (`docs/project/product-plan.md` §F-2 — F-2.1 email infra, F-2.2 LINE, F-2.3 persistent center).

## Architecture overview
- **Entities:**
  - `Notification` (`prisma/schema.prisma`) — already in the schema (`id`, `userId`→`User`, `type: NotificationType`, `title`, `body?`, `link?`, `isRead`, `readAt?`, soft-delete, `version`); **exists but unwired** — no code reads or writes it yet. It is reserved for the persistent in-app center (F-2.3) and is intentionally untouched by the email infra below.
  - No new model and no migration introduced by the foundation work — email is a stateless service layer.
- **Email service layer** (`lib/email/`):
  - `lib/email/client.ts` — a thin `server-only` facade over the Resend REST API (`POST https://api.resend.com/emails`, `Bearer ${RESEND_API_KEY}`) using plain `fetch`. `sendEmail({to, subject, html, replyTo?}) → {ok, id?, skipped?}`. Guarded + no-throw by design (mirrors the `lib/notify.ts` Telegram pattern).
  - `lib/email/templates.ts` — 4 typed pure builders returning `{subject, html}`: `bookingConfirmationEmail`, `bookingCancelledEmail`, `hostNewBookingEmail`, `kycResultEmail`. Thai copy, inline-styled `lang="th"`, amounts via `Intl.NumberFormat('th-TH')`, dates via `Intl.DateTimeFormat('th-TH')`.
- **API surface:** none exposed — there is no `app/api/*` route for email. It is an internal facade called server-side by future trigger points (booking/KYC flows), not over HTTP.
- **ADRs:** — · schema: `prisma/schema.prisma`

## Design overview
Transactional HTML emails only (no marketing). Each template is server-rendered, inline-styled for email-client compatibility, semantic (`<!DOCTYPE html>`, `lang="th"`, charset, viewport), and uses the CampVibe brand green header. All user-facing copy is Thai with no em-dash separator and no technical jargon; the booking reference is shown human-readable (never a raw UUID). Money and dates are formatted via `Intl` (Atomic Data pattern — amount + currency kept separate, not pre-formatted into the call). Tokens/typography follow `DESIGN.md`.

## Epics & Stories
| Epic | Story | CAM | Role | Status |
|---|---|---|---|---|
| foundation-notifications-infra (CAM-31) | Email infra (Resend) + templates | CAM-71 | backend | **Done** (PR #106 → staging; G5 pending) |
| foundation-notifications-infra (CAM-31) | Wire email into booking flow (POST + status change) | CAM-62 | backend | Pending |
| foundation-notifications-infra (CAM-31) | Host gets an email alert for new leads and accepted quotes (booking created/cancelled — shipped as CAM-685, see note) | CAM-74 | backend | **Done** |
| foundation-notifications-infra (CAM-31) | Notification model — persistent read/unread center (F-2.3) | CAM-73 | backend | Pending |
| (future) LINE messaging (F-2.2) | LINE Messaging API (notify→login→booking) | CAM-72 | backend | Pending |

## Key decisions
- **Fetch, not the Resend SDK** — a `fetch` POST to the documented REST endpoint is sufficient; adding the SDK earns no value and adds a dependency + audit surface (Lean + `.claude/rules/security.md` — no unjustified dep). NO new npm dependency was introduced.
- **Guarded no-op** — when `RESEND_API_KEY` is missing/empty the facade skips the network call and returns `{ok:true, skipped:true}` with a structured `email_skipped` warn log, so dev/CI/preview stay green and the future booking/KYC flows never fail because email is unconfigured.
- **No-throw by design** — any non-2xx response or network error returns `{ok:false}` and never throws, so a downstream caller's transaction is never broken by an email failure (fire-and-forget).
- **Infra before wiring** — CAM-71 ships the facade + templates only; sending on real events is split into CAM-62 (camper booking confirmation/cancellation) and CAM-74 (host booking alert — shipped as CAM-685). Actually sending on a real KYC decision is separate, still-unticketed work (see the CAM-74 correction note below). Until CAM-62 lands and DevOps sets the env keys, camper email is a safe no-op.
- **Env split** — `RESEND_API_KEY` + `EMAIL_FROM` are set per environment (separate keys for Vercel Staging and Production); secrets are server-only, never in the client bundle, never logged.
- **CAM-74 correction (2026-08-06)** — this row previously read "Wire email into KYC result flow"; that was a doc-cascade error, not the ticket DB's actual scope. The ticket DB's real CAM-74 is "Host gets an email alert for new leads and accepted quotes" (booking created + booking cancelled → host email), shipped as **CAM-685** (`lib/notifications/host-email.ts`, gated behind `EMAIL_HOST_NOTIFICATIONS` + `RESEND_API_KEY`). **KYC-result email wiring is a separate, still-unbuilt piece of work** — `kycResultEmail` (`lib/email/templates.ts:182`) exists with zero callers; that work got lost when CAM-74's meaning was overwritten and has no ticket yet.

## Changelog
- v3 (2026-08-06) — CAM-74 correction: fixed the Epics & Stories row to match the ticket DB (was mis-described as "Wire email into KYC result flow"); recorded that KYC-email wiring is separate, still-unbuilt work.
- v2 (2026-06-23) — filled from shipped CAM-71 (email infra + templates); recorded the fetch-not-SDK / guarded-no-op / infra-before-wiring decisions and the CAM-62/74/73/72 rollup.
- v1 (2026-06-22) — feature created.
