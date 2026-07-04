---
linear: CAM-71
feature: notifications-messaging
epic: foundation-notifications-infra (CAM-31)
persona: platform
artifact: tech
owner: architect
status: Done
version: v1
updated: 2026-06-23
---
# Tech — Email infra (Resend) + templates (CAM-71)

> Scope note: CAM-71 shipped the **infrastructure only** — the `sendEmail` facade and the 4 templates. Wiring these into the real booking flow (`POST /api/bookings`, status change) is deferred to **CAM-62**, and into the KYC decision flow to **CAM-74**. The story.md AC was written against the original "send-on-event" spec; this tech delta records what actually shipped (facade + templates, no triggers, no SDK, no migration).

## Data model
- **No new model. No migration.** Email is a stateless service layer in `lib/email/`; it persists nothing in this story. The `Notification` model already exists in `prisma/schema.prisma` and is **left untouched** (reserved for the persistent in-app center, F-2.3 / CAM-73).

## Facade contract — `lib/email/client.ts`
`import "server-only"` (compile-time guard against any client-bundle import).

```ts
interface SendEmailParams { to: string; subject: string; html: string; replyTo?: string }
interface SendEmailResult { ok: boolean; id?: string; skipped?: boolean }
async function sendEmail(params: SendEmailParams): Promise<SendEmailResult>
```

- **Transport:** plain `fetch` → `POST https://api.resend.com/emails`, headers `Content-Type: application/json` + `Authorization: Bearer ${RESEND_API_KEY}`. Body = `{ from, to, subject, html, reply_to? }` (`reply_to` added only when `replyTo` is passed). **No Resend SDK** — see decision below.
- **`from`** = `process.env.EMAIL_FROM` ?? `"CampVibe <noreply@campvibe.app>"`.
- **Guard (key absent/empty):** no `fetch` is made; returns `{ ok: true, skipped: true }` and emits a structured warn log `{ level:"warn", event:"email_skipped", reason:"RESEND_API_KEY not configured", subject }`. Keeps dev/CI/preview green and never blocks a future caller.
- **Error handling (no-throw by design):**
  - network/DNS exception → logs `{ level:"error", event:"email_send_error", reason:"fetch_exception", subject, error:<message> }`, returns `{ ok: false }`.
  - non-2xx Resend response → logs `{ level:"error", event:"email_send_error", reason:"resend_api_error", status, subject }`, returns `{ ok: false }`.
  - 2xx → parses `id` (parse failure is non-fatal — the email was already accepted), logs `{ level:"info", event:"email_sent", id, subject }`, returns `{ ok: true, id }`.
- **No secret/PII leak:** the API key is never placed in any log line (asserted by tests); logs carry only `subject` + safe fields, never the recipient address, the HTML body, or the key.

## Templates — `lib/email/templates.ts`
4 typed **pure** builders, each `(params) => { subject, html }` (`EmailTemplate`). Shared inline `styles` + a `layout(title, content)` wrapper producing semantic `<!DOCTYPE html>` `lang="th"` HTML (charset + viewport, brand-green header, Thai footer). Money via `Intl.NumberFormat('th-TH', { style:'currency', currency })`; dates via `Intl.DateTimeFormat('th-TH', { year, month, day })` (accepts `Date | string`). Atomic-data pattern: amount + currency passed separately, not a pre-formatted string.

| Builder | Audience | Params | Subject (Thai) |
|---|---|---|---|
| `bookingConfirmationEmail` | camper | `campName, checkIn, checkOut, guests, totalAmount, currency, bookingRef` | `ยืนยันการจอง {campName} — รหัส {bookingRef}` |
| `bookingCancelledEmail` | camper | `campName, checkIn, checkOut` | `ยกเลิกการจอง {campName}` |
| `hostNewBookingEmail` | host | `campName, checkIn, checkOut, guests, guestName` | `มีการจองใหม่สำหรับ {campName}` |
| `kycResultEmail` | host | `approved, reason?` | approved: `บัญชีของคุณได้รับการยืนยันแล้ว — CampVibe` / rejected: `ผลการตรวจสอบบัญชี — CampVibe` |

`kycResultEmail` branches on `approved`; the rejection reason section renders only when `reason` is present.

## API contract
None. CAM-71 exposes **no `app/api/*` route** — `sendEmail` is an internal server-side facade. Authz, rate-limit, and error-code concerns attach at the callers (CAM-62 / CAM-74), not here.

## Env vars
| Var | Required | Default | Notes |
|---|---|---|---|
| `RESEND_API_KEY` | yes (for real send) | — | server-only; absent → facade no-ops. Set per env (Staging/Prod use **separate** keys). Never in the client bundle (`NEXT_PUBLIC_*` excluded). |
| `EMAIL_FROM` | no | `CampVibe <noreply@campvibe.app>` | sender identity per env. |

## Key decisions
- **`fetch`, not the Resend SDK** — the documented REST endpoint is enough; the SDK adds a dependency + audit/maintenance surface for no functional gain (Lean; `.claude/rules/security.md` "no unjustified dep"). **No new npm dependency** was added.
- **`server-only` + guarded no-op + no-throw** — guarantees the key cannot leak into the client bundle, keeps non-prod envs green when unconfigured, and ensures an email failure can never break a caller's transaction (fire-and-forget). Mirrors the existing `lib/notify.ts` Telegram pattern.
- **No migration** — stateless service; the `Notification` model stays untouched for F-2.3.

## ADRs
— (no hard-to-reverse decision; revisit if the SDK or a persisted email-log is later justified)

## Links
`../../feature.md` (## Architecture overview) · `prisma/schema.prisma` (`Notification` model, unwired) · `lib/email/client.ts` · `lib/email/templates.ts` · `story.md`

## Changelog
- v1 (2026-06-23) — created from shipped code; documents facade contract + 4 templates + env + no-SDK/no-migration decisions and the infra-vs-wiring split (CAM-62/74).
