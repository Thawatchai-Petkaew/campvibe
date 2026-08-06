# CAM-646 — A booking's status change leaves a trail that says who changed it and from what

version 2 · 2026-08-06

## Story

As an **admin**, I want every change to a booking's status recorded with who made it and what it changed from, so that a dispute about a cancellation can be settled from the record instead of from memory.

Why: `Booking.status` is overwritten in place. The previous status and the identity of whoever changed it are gone the instant the write lands, and nothing else in the schema holds them. The `AuditLog` table has been deployed since June and holds 0 rows against 2,619 bookings.

Scope: `app/api/bookings/[id]/route.ts` and its tests. Booking CREATE is deliberately out of scope — see `## Out of scope`. Depends on: —

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camper has a booking that is waiting for confirmation | They cancel it | ข้อความยืนยันว่ายกเลิกแล้ว เหมือนเดิมทุกอย่าง | One trail entry records the change, who made it, what it changed from and to, and which camp — written in the same transaction as the status change | AC-4, EC-1 |
| AC-2 | A host cancels a booking on their own camp, including one they booked themselves | They cancel it | ข้อความยืนยันว่ายกเลิกแล้ว เหมือนเดิมทุกอย่าง | The entry records the actor as the host, not the camper, even when the same person is both | EC-2 |
| AC-3 | Someone who is neither the camper nor a host of that camp | They try to change the status | ข้อความว่าไม่มีสิทธิ์ทำรายการนี้ | Nothing changes and no trail entry is written | — |
| AC-4 | Two people act on the same booking at the same moment | The second change lands after the first | ข้อความว่าสถานะการจองนี้ถูกเปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่ | The second change is refused; exactly one entry exists, and its recorded starting status is the true one | EC-3 |
| AC-5 | A booking that is already cancelled | Someone sends the same status again | ข้อความว่าสถานะการจองนี้ถูกเปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่ | Refused. No write, no trail entry | EC-4 |

## Rules

- BR-1 The status change is a compare-and-swap: the update matches on the booking id AND the status that was read for this request. A match count of 0 means someone else moved it → refuse with a conflict.
- BR-2 A no-op transition (the requested status equals the current one) is refused the same way. It writes nothing.
- BR-3 The trail entry is written INSIDE the same transaction as the status change. If either fails, neither lands. This is the deliberate inverse of the notification rule, where a failed notification still returns success — name that intent in the test.
- BR-4 Actor precedence is admin, then host, then camper. A host who booked their own camp satisfies both checks; cancelling is a host action (the rule CAM-682 established).
- BR-5 The entry's detail carries exactly: the status it changed from, the status it changed to, the camp id, and the actor's role. No money value, no guest name, no contact detail.
- BR-6 The network address and browser identifier fields stay empty. The trail is append-only with no erasure path; filling them would create personal data that cannot be removed.
- BR-7 The endpoint gets a rate limit, as defence rather than as the only control against write amplification.

## Edge cases

- EC-1 IF the trail write fails THEN the status change fails too and the caller sees the generic error. A trail that can be lost is not a trail.
- EC-2 IF the actor is a platform admin who is also the camper THEN the entry records admin.
- EC-3 IF the compare-and-swap matches nothing THEN return a conflict, not a not-found — the booking exists, its state moved.
- EC-4 IF the requested status is not one the endpoint accepts THEN the existing validation refuses it first, unchanged, and nothing is written.

## Data

No schema change and no migration. `AuditLog` is already deployed (migration `20260621113624`). Fields used: `action`, `entityType`, `entityId`, `actorId`, `metadata`. Fields deliberately left null: `ipAddress`, `userAgent`.

## Seams & refs

`app/api/bookings/[id]/route.ts:44` (the read), `:61-78` (the actor flags), `:90-93` (the bare update this replaces), `:100-118` (the CAM-682 hook, unchanged) · the compare-and-swap idiom already shipped at `app/api/holds/[holdId]/route.ts:38` and `app/api/zones/[zoneId]/route.ts:49` · full analysis and the corrected blast radius in `tech.md`.

## Out of scope

- **Booking create.** Nothing is destroyed there — the Booking row already carries the actor, the time, the channel and the frozen price snapshot, and no application code hard-deletes it. An audit row would be near-duplicate metadata, while costing ~10 test-fixture rewrites and adding a new way for a camper's booking to fail inside the Serializable retry window. Carded separately with this trade recorded.
- The booking state machine (which transitions are legal) and `NO_SHOW` — that is CAM-64. This story owns the endpoint's WRITE SHAPE; CAM-64's acceptance criteria describe the pre-change endpoint and must be re-authored.
- Any reader or UI for the trail. It has none today and gains none here.

## Self-verify

- Localhost, dev DB, before merge, because there is no UI: cancel a booking, then read it back with `auditLog.findMany({ where: { entityType: 'Booking' }, orderBy: { createdAt: 'desc' } })`. Confirm one row with the right action, actor, entity id, and detail — and that the network/browser fields are empty. Baseline for the diff: 0 rows against 2,619 bookings.
- Prove the refusal path by hand: read a booking, change its status directly in the DB, then send the PATCH with the now-stale status and confirm a conflict with no row written.
- Run the FULL suite as the last act after the final edit, and grep `__tests__/` for every source string the diff changes.
- `npm run lint` · `npm run typecheck` · `npm test`.
