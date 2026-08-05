---
linear: CAM-313
feature: m1-2-hostos
epic: m1-2-hostos-ops-board-stays-os6-os7-os16 (CAM-290)
persona: host
artifact: story
owner: architect
status: Backlog
version: v2
updated: 2026-08-06
---
# Host records a stay that did not come through the site (OS7) (CAM-313)

## Story

As a **Host**, I want to record a stay that a guest arranged with me over LINE, by phone, or by walking in, so that the nights that guest occupies stop showing as free on my calendar and to campers browsing the site.
Why: today the only ways to express "these nights are sold" are `BlockedDate` (no guest, no money, no head count) and `InternalHold` (temporary, expires) — neither records that someone is actually staying, so the public availability the camper sees overstates the camp. This is a live correctness gap, not a convenience feature.
Scope: create one host-recorded stay at a camp the host has permission for, from a form on the existing host bookings page; the stay consumes capacity through the same shared availability function every other booking uses; the existing host bookings list and host month calendar show it with no new screen. Guest identity is a name plus one free-text contact stored on the stay itself.
Depends on: ADR-017 (Open trade-off #2 — the discriminator column — must be chosen at G2 before build) · `lib/campsite-availability.ts` `checkDateAvailabilityInTx` · `app/api/campsites/[id]/holds/route.ts` `withHoldTransaction` (concurrency template)

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Host has permission at camp C; nights 10–12 Aug have room for 4 more guests | Host submits the record-a-stay form with 10–12 Aug, 4 guests, name `สมชาย`, contact `0812345678`, amount `2500` | The new stay appears at the top of the host's booking list showing `สมชาย` and `10 ส.ค. 2569 - 12 ส.ค. 2569`, and a confirmation `บันทึกการเข้าพักแล้ว` | One `Booking` row: host-recorded, status confirmed, no user account, guest name + contact stored, agreed total `2500` frozen on the row, `AuditLog` row written in the same transaction | EC-1, EC-2, EC-3, EC-4 |
| AC-2 | The AC-1 stay exists on 10–12 Aug at camp C, whose capacity is 10 guests/day and which had 6 guests booked | A camper opens camp C's page and picks 10–12 Aug | `เต็มแล้ว` (0 left; before AC-1 it read `เหลือ {n} ที่` with n = 4) | The host-recorded stay is summed into the same per-night guest count as camper bookings; no availability code changed | EC-5 |
| AC-3 | Nights 10–12 Aug have room for exactly 4 more guests | Two record-a-stay requests for 4 guests each on 10–12 Aug are sent at the same instant | One host sees `บันทึกการเข้าพักแล้ว`; the other sees `ที่ว่างไม่พอสำหรับช่วงวันที่นี้` | Exactly one `Booking` row is created; the losing request writes no row and no `AuditLog` row | EC-5 |
| AC-4 | Camp C has both a camper booking (guest account name `Somchai W.`) and the AC-1 host-recorded stay | Host opens the host bookings list | The camper booking still shows `Somchai W.`; the host-recorded stay shows `สมชาย` | Both rows render from one shared guest-name resolver; the camper row's displayed value is byte-identical to before this story | EC-6 |
| AC-5 | A user is signed in who is neither the camp's operator nor a team member with booking-update permission at camp C | That user submits the record-a-stay form for camp C | `คุณไม่มีสิทธิ์จัดการการจองของลานนี้` | No `Booking` row and no `AuditLog` row is created | EC-7 |
| AC-6 | The AC-1 host-recorded stay exists at camp C and its check-in date has passed | The guest named on that stay tries to leave a review of camp C | `คุณต้องเคยเข้าพักที่ลานนี้ก่อนจึงจะรีวิวได้` | A host-recorded stay grants no review right to anyone, because the review gate matches on the guest's own account and this stay has none | — (this row IS the negative case; its positive twin is the existing camper-booking review path, unchanged) |

## Rules

- BR-1 Capacity is checked night by night through `checkDateAvailabilityInTx` only — the same function the camper booking write path and the hold write path already call. No second capacity query, no `origin`/`source` predicate added to any availability read. A night that would exceed remaining capacity rejects the whole create; no partial row (proves AC-2, AC-3)
- BR-2 The create runs inside one `Serializable` transaction with bounded retry on a Postgres serialization failure — 3 attempts, 50 ms / 100 ms / 150 ms backoff, identical to `withHoldTransaction`. Retries exhausted = a genuine conflict → `409` + `ที่ว่างไม่พอสำหรับช่วงวันที่นี้`; never a `500` (proves AC-3)
- BR-3 A host-recorded stay is created at status `confirmed`, with no linked user account and the host-recorded discriminator set. It is never created at `pending` — there is no online payment to wait for (proves AC-1, AC-2)
- BR-4 Bounds, all rejected with `400` before the transaction opens: check-out must be after check-in · span ≤ 30 nights (reuses `MAX_BOOKING_NIGHTS`, one constant, not a twin) · guests 1–500 (reuses `MAX_BOOKING_GUESTS`) · check-in no earlier than 30 days before today (a host catching up on the register; further back is a typo) · agreed amount 0–999,999.99 with at most 2 decimal places (0 is legal — a comped stay) · guest name 1–100 characters, required · contact 0–100 characters, optional · a named pitch must belong to this camp and not be soft-deleted (proves AC-1)
- BR-5 The agreed amount the host types IS the frozen legal amount: it is written to both the live total and the frozen total, together with the currency, the night count, the camp name, the pitch name, and the camp's check-in/check-out times and timezone. The unit-price, subtotal, tax-rate, tax-amount, VAT-inclusive, pricing-unit and quantity fields stay empty — a deal agreed over LINE has no computed breakdown, and writing one would assert a calculation that never happened (proves AC-1)
- BR-6 Permission is the same rule holds and blocked dates already use: camp operator, platform admin, or an active team member with booking-update permission at that camp. Anyone else gets `403` + `คุณไม่มีสิทธิ์จัดการการจองของลานนี้` (proves AC-5)
- BR-7 One `AuditLog` row per successful create, written inside the same transaction as the stay (atomic with it), carrying ids and the date range only — never the guest's name or contact (proves AC-1)
- BR-8 Guest display name resolves through ONE shared function used by every list and detail that shows a booking's guest: a booking with a linked account keeps exactly today's behaviour (account name, falling back to account email); a booking with no linked account shows its stored guest name, falling back to `ผู้เข้าพัก` (proves AC-4)

## Edge cases

- EC-1 IF check-out is on or before check-in THEN reject with `400` + `วันที่ออกต้องอยู่หลังวันที่เข้าพัก` and write nothing (BR-4)
- EC-2 IF the stay spans more than 30 nights, or guests is below 1 or above 500, or the amount is negative or above 999,999.99 THEN reject with `400` + `ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง` and write nothing (BR-4)
- EC-3 IF check-in is more than 30 days before today THEN reject with `400` + `ย้อนหลังได้ไม่เกิน 30 วัน` and write nothing (BR-4)
- EC-4 IF a pitch is named that belongs to another camp, or has been deleted, or does not exist THEN reject with `404` + `ไม่พบจุดกางเต็นท์นี้` — one identical response for all three, so the reply can never be used to discover another camp's pitches (BR-4)
- EC-5 IF two record-a-stay requests for overlapping nights are committed concurrently and only one fits THEN exactly one succeeds and the other receives `409` + `ที่ว่างไม่พอสำหรับช่วงวันที่นี้`; verified by firing both requests at the same instant, not one after the other (BR-1, BR-2)
- EC-6 IF a booking has a linked account whose display name is empty THEN it shows the account email, exactly as it does today — this story must not change what any existing camper booking renders (BR-8)
- EC-7 IF the request carries no session THEN reject with `401`; IF the session has no booking-update permission at that camp THEN reject with `403` + `คุณไม่มีสิทธิ์จัดการการจองของลานนี้`. Neither writes a row (BR-6)
- EC-8 IF the guest named on a host-recorded stay later creates their own account THEN that stay still grants them no review right and does not appear in their own bookings list — the stay has no account link, and linking one is out of scope (BR-3)

## Data

- **`Booking` — three new columns plus one nullability change. No new table.**
  - `userId` **String → String?** (nullable). Null means exactly one thing: no CampVibe account exists behind this stay. Classification: unchanged.
  - `guestName` **String?** `[PII]` — the guest's name as the host wrote it. Originates here (nothing upstream to copy from), like a paper register entry; when `HostLead` ships it does not move, it gains a trace (`leadId`).
  - `guestContact` **String?** `[PII]` — one free-text contact: phone, LINE id, or Facebook handle. Deliberately NOT split into type + value — no story filters or sorts by a contact's sub-parts (Resolution Boundary, same reasoning as ADR-012 §1). Validating a phone differently from a LINE id is form validation, not a schema split.
  - `origin` **enum `BookingOrigin` @default(CAMPER_SELF_BOOKED)**, values `CAMPER_SELF_BOOKED` | `HOST_RECORDED`, `[Public]` — who the counterparty is and who entered the row. Indexed: "show me the stays I entered" is a first-class host query. **Name and shape are ADR-017 Open trade-off #2/#3 and must be settled at G2 before this builds.**
  - Explicitly NOT touched: `source` (`BookingSource {WEB, CHAT}`) stays what it is — which UI surface created the request — and keeps its documented "attribution only, never an authz/pricing/capacity input" contract.
- **`BookingStatus` unchanged.** No `NO_SHOW`, no state machine here — a host-recorded stay is created at `confirmed` and this story performs no transition. Both are named as their own story (see Out of scope).
- **Migration: reversible.** Up = create the new enum type, add `origin` with a default (every existing row is correct by the default, no backfill logic), add the two nullable text columns, drop the NOT NULL on `userId`, add the index. Down = drop the index, drop the three columns, drop the new enum type, restore NOT NULL on `userId`. Dropping NOT NULL never rewrites or destroys a row, so the up direction is safe at any existing booking volume; the down direction requires that no host-recorded rows remain (they are the only rows with a null account), which is a stated, executable precondition because this feature creates them. Prove up → down → up against the local dev DB before the promote.

## Seams & refs

Reuse: `lib/campsite-availability.ts` `checkDateAvailabilityInTx` (the only capacity gate) · `app/api/campsites/[id]/holds/route.ts` `withHoldTransaction` (the Serializable + bounded-retry shape to copy) · `lib/auth-utils.ts` `requireCampSitePermission(campSiteId, 'BOOKING_UPDATE')` (the permission rule holds and blocked dates already use) · `lib/validations/booking.ts` `MAX_BOOKING_NIGHTS` / `MAX_BOOKING_GUESTS` (one constant each, never a twin). Refs: ADR-017 (this story's decision), ADR-012 §6 (superseded in part), ADR-005 (what to freeze), ADR-006 (why Serializable).

Reader/writer sweep — grep terms used: `booking.user`, `booking.userId`, `user: { select`, `prisma.booking.findMany|findUnique|findFirst`. Full table with reasoning per row: `./tech.md` §5. Summary:

- **NOW (breaks without a fix, must ship in this PR):** `app/dashboard/page.tsx:282,284` · `app/dashboard/bookings/page.tsx:118,235,381,384,385` — read `booking.user.name` / `booking.user.email` with no null guard. `app/api/operator/dashboard/route.ts:83` and `app/api/operator/bookings/route.ts` — must also select the two new guest columns, or the pages above have nothing to fall back to.
- **NO-CHANGE (correct by construction, and must be pinned by a test):** the five availability readers (`lib/campsite-availability.ts:214, 514, 818, 921, 996`) filter on `status` alone and never on who created the booking — this is what makes a host-recorded stay count with zero code change. Every account-scoped read (`lib/bookings.ts:19`, `app/api/bookings/route.ts:352`, `app/bookings/[id]/confirmation/page.tsx:29`, `app/api/bookings/[id]/route.ts:61`, `lib/ai/tools/my-bookings.ts:99`) matches on a real account id, which a null can never equal.
- **Seam invariant (one test, walking the matrix):** a host-recorded `confirmed` booking and a camper `confirmed` booking with the same camp, dates and guest count move all five availability readers by exactly the same amount. Per-reader tests cannot see cross-layer divergence — this is the CAM-355/CAM-400 lesson.
- **Security-relevant NO-CHANGE:** `app/api/reviews/route.ts:61` gates reviews on `userId: authorId`, so a host-recorded stay grants no review right to anyone. That must stay true — it is AC-6 and needs its own regression test, not an assumption.

## Out of scope

- Check-in / check-out / no-show with guard rules, the booking state machine, and `AuditLog` on status change → CAM-64 (re-scoped; it also closes the shipped hole at `app/api/bookings/[id]/route.ts:89-92` where `CANCELLED → PENDING` is currently allowed)
- Linking a stay to a lead, a quote, or a deposit → CAM-306 / CAM-309 / CAM-312 (all add nullable FKs additively; nothing here forecloses them)
- Filtering the stay list by `วันนี้` / `พรุ่งนี้` / a date range → follow-up story in this epic (dropped from v1's AC-4 to keep this PR under ~400 lines)
- Editing a host-recorded stay after creation. Cancel and re-enter is the slice-1 answer — moving dates re-opens the capacity race and needs its own transaction design → follow-up story
- Linking a host-recorded stay to a camper account that appears later → not designed; a guest profile is ADR-012 §7, still deferred
- The camp-map view of daily stay status → CAM-316 (OS6)

## Self-verify

- AC-1, AC-5 → integration (route, happy + 403) · AC-2 → integration across all five availability readers, one matrix test (the seam invariant above) · AC-3 → integration, both requests fired at the same instant, never sequentially · AC-4, EC-6 → unit on the shared guest-name resolver, including the "camper row renders byte-identically to before" case · AC-6 → integration regression on the review gate · EC-1..EC-4, EC-7, EC-8 → unit + integration
- Story-specific: migration proven up → down → up on the local dev DB (down requires deleting host-recorded rows first — exercise that precondition, do not assume it) · permission checked for operator, platform admin, team member with and without booking-update · `AuditLog` row carries no guest name or contact
- If the diff exceeds ~400 lines, split the form UI out as its own story rather than growing this one
- Gate = /quality-gate · Done = every AC verified on localhost against the dev DB before merge, re-verified on the real Staging URL at G4

## Changelog

- v2 (2026-08-06) — re-scoped by CAM-686 Discovery + ADR-017. Dropped the dependency on `HostLead`/`Quote`/`DepositRecord` (none exist; ADR-012 §6's "every manual stay carries a leadId" invariant is superseded), so this ships as the FIRST HostOS slice instead of the fourth. v1's AC-1 and AC-5 (lead-gated `เปิดการเข้าพัก` button) move to CAM-306's follow-up; v1's AC-4 (day filter) moves to its own story. v1's AC-2 (capacity) and AC-3 (concurrency) survive as AC-2/AC-3 here. Added the guest-identity columns, the discriminator, the nullable-account ripple, the permission rule, and the review-gate regression. Filled in real bounds, Thai copy, edge cases and the reader sweep — v1 had none.
- v1 (2026-07-04) — created
