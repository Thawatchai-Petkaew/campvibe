---
artifact: epic
feature: notifications-messaging
epic: foundation-notifications-infra (CAM-31)
status: Done
version: v3
updated: 2026-08-06
---
# Foundation: notifications infra (CAM-31)

## Why
Give CampVibe a reliable, server-side way to email camper and host about the events they care about — booking confirmed, cancelled, a new reservation, a KYC decision — so people are not left guessing and hosts stop polling the dashboard. This is F-2.1 on the product plan and it unblocks H-6 (Communicate) and C-5.6 (booking confirmation).
**KPI:** booking-confirmation email open rate ≥ 40% within 7 days of launch; "ไม่รู้ว่าจองสำเร็จหรือเปล่า" complaints driven to 0 on Staging.

## Scope
- **In:** the email service foundation — a guarded, no-throw `sendEmail` facade over the Resend REST API (no SDK, no new dependency) plus 4 typed Thai HTML templates (booking confirmation, booking cancelled, host new booking, KYC result). No route, no migration; the `Notification` model already exists and is left untouched.
- **Out:**
  - Actually sending on a real booking event (POST + status change) → **CAM-62**.
  - Actually sending on a real KYC decision → not yet ticketed. (This bullet previously said "→ CAM-74"; that was a doc-cascade error — see the CAM-74 row below and the Changelog.)
  - LINE notification channel (F-2.2) → **CAM-72**.
  - Persistent in-app notification center / read-unread on the `Notification` model (F-2.3) → **CAM-73**.
  - Marketing/promotional email, unsubscribe/preference center, email log/audit in DB → Phase 2.

## Stories
| CAM | Story | Role | Status |
|---|---|---|---|
| CAM-71 | Email infra (Resend) + 4 templates | backend | **Done** (PR #106 → staging; G5 pending) |
| CAM-62 | Wire email into booking flow | backend | Pending |
| CAM-74 | Host gets an email alert for new leads and accepted quotes (booking created/cancelled → host email; shipped as CAM-685) | backend | **Done** |
| CAM-73 | Notification model — persistent center (F-2.3) | backend | Pending |

## Links
`../feature.md` · product-plan §F-2 (`docs/project/product-plan.md`) · Master-Plan (`docs/project/master-plan.md`) · ADRs (`docs/adr/*`)

## Changelog
- v3 (2026-08-06) — CAM-74 correction: the Story/Stories rows previously read "Wire email into KYC result flow", which was a doc-cascade error, not the ticket DB's actual scope. Corrected to the ticket DB's real title; CAM-74 shipped as CAM-685 (`lib/notifications/host-email.ts`). KYC-result email wiring (`kycResultEmail`, `lib/email/templates.ts:182`, zero callers) is separate, still-unticketed work — do not conflate the two.
- v2 (2026-06-23) — scoped from shipped CAM-71; recorded in/out split (infra in, wiring CAM-62/74 + LINE CAM-72 + persistent center CAM-73 out) and the stories rollup.
- v1 (2026-06-22) — epic scoped.
