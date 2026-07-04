---
linear: CAM-71
feature: notifications-messaging
epic: foundation-notifications-infra (CAM-31)
persona: platform
artifact: test
owner: qa-engineer
status: Done
version: v1
updated: 2026-06-23
---
# Test — Email infra (Resend) + templates (CAM-71)

> CAM-71 shipped infra only, so tests target the **unit** of the facade + template builders — not the on-event AC (those send-on-booking/KYC ACs are verified when wiring lands in CAM-62/74). The story AC about "user receives email" is covered here at the unit level (the right template content + the facade sends/skips/fails correctly); the end-to-end "received within 1 min on Staging" check belongs to the wiring stories.

## AC→test matrix
| Story AC | Covered by (unit) | type | test file | status |
|---|---|---|---|---|
| AC-1 camper booking-confirmation content | `bookingConfirmationEmail` content/Thai-copy/amount/guests/ref | unit | `__tests__/email-templates.test.ts` | ✅ |
| AC-2 host new-booking + camper confirm content | `hostNewBookingEmail` + `bookingConfirmationEmail` | unit | `__tests__/email-templates.test.ts` | ✅ |
| AC-3 cancellation content | `bookingCancelledEmail` content/dates | unit | `__tests__/email-templates.test.ts` | ✅ |
| AC-4 KYC approved content | `kycResultEmail({approved:true})` | unit | `__tests__/email-templates.test.ts` | ✅ |
| AC-5 KYC rejected + reason content | `kycResultEmail({approved:false, reason})` + no-reason boundary | unit | `__tests__/email-templates.test.ts` | ✅ |
| AC-6 key absent → no-op, flow continues | facade guard: skips fetch, returns `{ok:true, skipped:true}` | unit | `__tests__/email-client.test.ts` | ✅ |
| AC-7 Resend/network error → no throw, flow continues | facade error paths: non-2xx + fetch reject → `{ok:false}`, no throw | unit | `__tests__/email-client.test.ts` | ✅ |
| (delivery) send-on-event end-to-end | deferred → CAM-62 / CAM-74 | e2e | (future) | ⬜ deferred |

## Test inventory — 42 tests total

### `__tests__/email-client.test.ts` (12)
- **Guard (key absent):** returns `{ok:true, skipped:true}` without calling `fetch`; does **not** log the API key when skipped.
- **Success path (2xx):** POSTs to `https://api.resend.com/emails` with `Authorization: Bearer <key>` + `Content-Type: application/json`, body carries `to`/`subject`/`html`/`from`; returns `{ok:true, id}`; honors `EMAIL_FROM`; adds `reply_to` when `replyTo` given; **never logs the API key**.
- **Error paths (no-throw):** 422, 429, 500 each → `{ok:false}` without throwing; `fetch` rejection (network) → `{ok:false}` without throwing; **never leaks the key in error logs** on network failure.

### `__tests__/email-templates.test.ts` (30)
- **Content/Thai copy** per builder — subject + html contain camp name, booking ref, Thai headline copy (e.g. `การจองของคุณได้รับการยืนยันแล้ว`, `คุณมีการจองใหม่`, `การจองของคุณถูกยกเลิกแล้ว`), guest count, guest name.
- **Amount formatting** — booking confirmation html matches a formatted amount (`/2[,.]?500/`), proving `Intl.NumberFormat` is used (no raw/pre-formatted string).
- **Date formatting** — cancellation html contains `2569` (2026 in Buddhist Era th-TH locale).
- **Document structure / a11y** — html contains `<!DOCTYPE html>`, `lang="th"`, `charset`.
- **Purity** — every builder returns identical output for identical input; accepts both `Date` and ISO string inputs.
- **kycResultEmail boundaries** — approved (congrats copy, no `เหตุผล` section); rejected with reason (rejection copy + reason rendered); rejected **without** reason (renders without crashing, no `เหตุผล` section).

## Key-leak assertions (security)
The facade's secret never reaches a log line. Tests stub a fake key (`re_test_abc123`), capture all `console.warn`/`console.info`/`console.error` calls across the skip path, success path, and both error paths, and assert `JSON.stringify(call)` does **not** contain the key — closing the `.claude/rules/security.md` "no secret in log" requirement at the unit boundary.

## Guard-behavior verification
The two AC that matter most for not breaking downstream flows (AC-6/AC-7) are proven directly: no key → fetch is never called and `{ok:true, skipped:true}` returned; any Resend non-2xx or network throw → `{ok:false}` with no exception escaping. This guarantees a future booking/KYC transaction cannot fail because of email.

## Coverage
`lib/email/client.ts` + `lib/email/templates.ts` fully exercised (every branch: guard / 2xx / non-2xx / network-throw; both kyc branches incl. no-reason boundary) — ≥80% on new code met. Full suite: **1772 tests green**.

## Gate
lint 0 errors · typecheck pass · `npm test` 1772 green · `npm run build` pass · `npm audit --omit=dev` 0 high/critical. No UI in this story → design gate N/A.

## Links
`story.md` (AC) · `tech.md` (facade contract + templates) · `__tests__/email-client.test.ts` · `__tests__/email-templates.test.ts` · `.claude/rules/qa.md`

## Changelog
- v1 (2026-06-23) — created; mapped 42 tests (12 client + 30 templates) to AC, recorded key-leak + guard assertions and the gate result.
