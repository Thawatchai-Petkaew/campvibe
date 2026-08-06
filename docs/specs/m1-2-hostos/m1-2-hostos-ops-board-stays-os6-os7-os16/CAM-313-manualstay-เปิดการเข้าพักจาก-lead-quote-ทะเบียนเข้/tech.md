---
linear: CAM-313
feature: m1-2-hostos
epic: m1-2-hostos-ops-board-stays-os6-os7-os16 (CAM-290)
persona: host
artifact: tech
owner: architect
status: Backlog
version: v1
updated: 2026-08-06
---
# Tech — Host records a stay that did not come through the site (CAM-313)

> Written by CAM-686 Discovery. The decision this implements is [ADR-017](../../../../adr/ADR-017-host-recorded-stay-and-booking-discriminator.md); its Open trade-off #2 (the discriminator) and #3 (naming) must be settled at G2 **before** any of this builds.

## 1. Data model (Prisma diff)

Additive except one nullability change. No new table.

```prisma
// NEW enum. Deliberately NOT a new value on BookingSource — see ADR-017 D2.
enum BookingOrigin {
  CAMPER_SELF_BOOKED // a camper created it through their own account (every row today)
  HOST_RECORDED      // a host entered it on a guest's behalf (walk-in / LINE / phone)
}

model Booking {
  // ...all existing fields unchanged, including `source BookingSource @default(WEB)`...

  userId String?  // CHANGED from `String`. Null ⟺ no CampVibe account behind this stay.
  user   User?    @relation(fields: [userId], references: [id]) // CHANGED from required

  guestName    String? // [PII] NEW — as written by the host; originates here
  guestContact String? // [PII] NEW — one free-text contact (phone / LINE id / FB handle)

  origin BookingOrigin @default(CAMPER_SELF_BOOKED) // [Public] NEW

  @@index([origin]) // NEW
}
```

Field-by-field against the before-add-field checklist (`.claude/rules/architecture.md` §15):

| Field | Splittable further? | Classification | Type / bound | UI-neutral name? | AI-readable tomorrow? |
|---|---|---|---|---|---|
| `guestName` | No — one name as written; a first/last split is meaningless for Thai walk-in registers and nothing queries the parts | PII | `String?`, 1–100 chars enforced at the boundary | Yes | Yes, with the schema comment |
| `guestContact` | No — Resolution Boundary: nothing filters/sorts by a contact's sub-parts in this or any named follow-up (CRM matching is CAM-322, deferred). Same reasoning ADR-012 §1 applied to `HostLead.guestContact` | PII | `String?`, 0–100 chars | Yes | Yes |
| `origin` | No — it is already the atom "who is the counterparty" | Public | closed enum, 2 values, default `CAMPER_SELF_BOOKED` | Yes | Yes |
| `userId` nullable | n/a | unchanged | `String?` | Yes | Yes — null has exactly one meaning, stated in the schema comment |

Crystallization (ADR-005), applied honestly — what a host-recorded stay writes vs leaves NULL:

| Written | Left NULL, and why |
|---|---|
| `totalPrice`, `snapshotTotalAmount`, `snapshotCurrency`, `snapshotNights`, `snapshotCampName`, `snapshotCampNameEn`, `snapshotSpotName`, `snapshotCheckInTime`, `snapshotCheckOutTime`, `snapshotTimezone` | `snapshotUnitAmount`, `snapshotSubtotalAmount`, `snapshotTaxRate`, `snapshotTaxAmount`, `snapshotVatInclusive`, `snapshotPricingUnit`, `snapshotQuantity` — a deal agreed over LINE has no computed breakdown. Writing one would assert a calculation that never happened. Backend must extend the existing `snapshotPricingUnit` schema comment (which today reads NULL as "booked before CAM-650") to name this second, permanent NULL case. |

## 2. Migration

```sql
-- up
CREATE TYPE "BookingOrigin" AS ENUM ('CAMPER_SELF_BOOKED','HOST_RECORDED');
ALTER TABLE "Booking" ADD COLUMN "origin" "BookingOrigin" NOT NULL DEFAULT 'CAMPER_SELF_BOOKED';
ALTER TABLE "Booking" ADD COLUMN "guestName" TEXT, ADD COLUMN "guestContact" TEXT;
ALTER TABLE "Booking" ALTER COLUMN "userId" DROP NOT NULL;
CREATE INDEX "Booking_origin_idx" ON "Booking"("origin");

-- down
DROP INDEX "Booking_origin_idx";
ALTER TABLE "Booking" DROP COLUMN "guestContact", DROP COLUMN "guestName", DROP COLUMN "origin";
DROP TYPE "BookingOrigin";
ALTER TABLE "Booking" ALTER COLUMN "userId" SET NOT NULL;   -- precondition below
```

- **No backfill.** The column default makes every existing row correct.
- **Up is safe at any volume.** `DROP NOT NULL` neither rewrites nor destroys a row.
- **Down has one executable precondition:** no rows with `userId IS NULL` may remain, or `SET NOT NULL` fails. Those rows are exclusively host-recorded stays, which this feature creates — so the rollback runbook is `DELETE FROM "Booking" WHERE "userId" IS NULL;` (or re-point them) first. Exercise this precondition during the up → down → up proof; do not assume it.
- Row counts on dev/staging/prod: **not measured** (CAM-686 was read-only by dispatch constraint). Independent bound: production is gated by `COMING_SOON=1` (`.claude/ENV-CONFIG.md:34`), so production carries no real camper booking traffic today.

## 3. API contract

### `POST /api/campsites/[id]/stays`

Sibling of `POST /api/campsites/[id]/holds` — same permission helper, same concurrency shape, same route family. (Alternative considered: extend `POST /api/bookings` with an `origin` field. Rejected — that route is the camper's own booking path; it authorises on the session being the booker, has a different permission model, and mixing a host-authorised write into it would put two authz rules in one handler.)

- **Auth:** authenticated, and `requireCampSitePermission(id, 'BOOKING_UPDATE')` — camp operator, platform admin, or an active team member with booking-update at THIS camp. Ownership is proven by the camp id in the path, never by anything in the body.
- **Input** (zod, `lib/validations/stays.ts`; reuses `MAX_BOOKING_NIGHTS` and `MAX_BOOKING_GUESTS` from `lib/validations/booking.ts` — one constant each, never a twin):

```jsonc
{
  "checkInDate":  "ISO date",          // ≥ today − 30 days
  "checkOutDate": "ISO date",          // > checkInDate; span ≤ 30 nights
  "guests":       "int 1..500",
  "spotId":       "uuid | omitted",    // must belong to this camp and not be soft-deleted
  "guestName":    "string 1..100",     // required
  "guestContact": "string 0..100",     // optional
  "totalAmount":  "number 0..999999.99, ≤2 decimals"   // the agreed amount; 0 = comped
}
```

- **Output `201`:** `{ stay: { id, checkInDate, checkOutDate, guests, spotId, guestName, guestContact, totalPrice, currency, status, origin } }` — atomic fields only; the client formats money with `Intl.NumberFormat`, no preformatted price string.
- **Errors** (shared repo shape via `apiError`, `{ error, ... }`):

| Code | When | Copy the user sees |
|---|---|---|
| `400` | zod failure — bad dates, span > 30 nights, guests out of range, amount out of range, name missing | `ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง` · date-specific: `วันที่ออกต้องอยู่หลังวันที่เข้าพัก` · backdate: `ย้อนหลังได้ไม่เกิน 30 วัน` |
| `401` | no session | (handled by `requireAuth`, existing copy) |
| `403` | session has no booking-update permission at this camp | `คุณไม่มีสิทธิ์จัดการการจองของลานนี้` |
| `404` | camp not found, **or** `spotId` unknown / deleted / belongs to another camp — one identical response for all, so it is never an existence oracle for another camp's pitches (mirrors `holds` EC-6 and `bookings` `invalid_spot`) | `ไม่พบจุดกางเต็นท์นี้` |
| `409` | any night would exceed remaining capacity, **or** Serializable retries exhausted | `ที่ว่างไม่พอสำหรับช่วงวันที่นี้` |
| `500` | anything else — generic message, detail logged server-side only | (existing generic copy) |

`429` deliberately omitted: this is an authenticated, permission-gated host write with no enumeration value and no public surface — same posture as `POST /api/campsites/[id]/holds`, which also carries no rate limit. Revisit if a host-facing abuse case appears.

### `GET /api/operator/bookings` — changed, not new

Add `guestName` and `guestContact` to the existing `select`/`include`, and add `origin`. Backward-compatible by addition (`.claude/rules/api.md` §12) — no existing field is removed or retyped. Without this the dashboard has nothing to fall back to for a null account.

### Transaction shape (copy `withHoldTransaction`, do not invent)

```
prisma.$transaction(async (tx) => {
    for (night = checkIn; night < checkOut; night++)
        if (!(await checkDateAvailabilityInTx(tx, campSiteId, night, guests)).available)
            return { type: 'conflict' }
    booking = await tx.booking.create({ ... status: 'CONFIRMED', origin: 'HOST_RECORDED', userId: null ... })
    await tx.auditLog.create({ action: 'stay.recorded', entityType: 'Booking', entityId: booking.id,
                               actorId, metadata: { campSiteId, spotId, startDate, endDate } })  // ids + dates ONLY, no PII
    return { type: 'ok', booking }
  }, { isolationLevel: Serializable })
// catch P2034 → 3 attempts, 50/100/150ms backoff → then { type: 'conflict' } (409), never 500
```

The `spotId`-belongs-to-this-camp check runs **before** the transaction opens (mirrors `holds/route.ts:196-204`); the span cap runs before it too (mirrors `holds/route.ts:185-190`), so no client-controlled loop count ever enters a Serializable transaction (CAM-344/CAM-401 class).

## 4. Boundary

Client (host form, a client component) → `POST /api/campsites/[id]/stays` → the route's own service function → Prisma. The form never reads capacity itself; it renders whatever the route returns. The five availability readers stay the single source of "how much room is left" — this story adds no capacity math anywhere.

## 5. Reader/writer sweep (`.claude/rules/architecture.md` §15b)

Grep terms actually used: `booking\.user`, `booking\.userId`, `user: { select`, `prisma\.booking\.(findMany|findUnique|findFirst)`, `\.user\.name`, `\.user\.email`.

| # | Reader / writer | Location | Tag | Reasoning |
|---|---|---|---|---|
| 1 | Operator dashboard recent-bookings list | `app/dashboard/page.tsx:282,284` | **NOW** | `booking.user.name?.[0]` and `booking.user.name \|\| booking.user.email` — throws on a null account. Replace with the shared resolver (BR-8). |
| 2 | Operator bookings page | `app/dashboard/bookings/page.tsx:118,235,381,384,385` | **NOW** | Same five reads: search filter, CSV/export field, avatar initial, name, email. All through the shared resolver. |
| 3 | Operator dashboard API | `app/api/operator/dashboard/route.ts:83` | **NOW** | `include: { user: { select: { name, email } } }` returns `user: null` (no throw here) but starves #1. Must also select `guestName`, `guestContact`, `origin`. |
| 4 | Operator bookings API | `app/api/operator/bookings/route.ts` (the `user:` block in the `include`) | **NOW** | Same as #3, starves #2. |
| 5 | Daily availability (host calendar + public availability route) | `lib/campsite-availability.ts:214` | NO-CHANGE | `status: { in: ['CONFIRMED','PENDING'] }`, no creator predicate — counts a host-recorded stay automatically. |
| 6 | Batched nightly occupancy (catalog badge + AI card) | `lib/campsite-availability.ts:514` | NO-CHANGE | Same status-only predicate. |
| 7 | Booking/hold write gate | `lib/campsite-availability.ts:996` | NO-CHANGE | Same. This is what makes AC-3 work with no new code. |
| 8 | Per-pitch read | `lib/campsite-availability.ts:818` | NO-CHANGE | `status: { not: 'CANCELLED' }`, no creator predicate. |
| 9 | Per-pitch write gate | `lib/campsite-availability.ts:921` | NO-CHANGE | Same. |
| 10 | Owner-scoped booking fetch | `lib/bookings.ts:19` | NO-CHANGE | `where: { id, userId }` — a null can never equal a real account id, so a host-recorded stay is invisible to the camper detail page. Correct. |
| 11 | Camper "my bookings" list | `app/api/bookings/route.ts:352` | NO-CHANGE | `where: { userId: session.user.id }`. Same reasoning. |
| 12 | Booking confirmation page | `app/bookings/[id]/confirmation/page.tsx:29` | NO-CHANGE | `where: { id, userId: session.user.id }`. Same. |
| 13 | Booking PATCH authz | `app/api/bookings/[id]/route.ts:61` | NO-CHANGE | `booking.userId === session.user.id` → `null === '<uuid>'` is false, so a host-recorded stay is never camper-owned. Host/team/admin paths still reach it, which is correct and is what CAM-64 will build on. |
| 14 | AI `getMyBookings` tool | `lib/ai/tools/my-bookings.ts:99` | NO-CHANGE | `where: { userId: ctx.userId }`. Same. |
| 15 | **Review verified-stay gate** | `app/api/reviews/route.ts:61` | NO-CHANGE — **security-relevant** | `where: { userId: authorId, … }`. A host-recorded stay grants no review right to anyone. This is AC-6 and needs an explicit regression test, not an assumption — it is the one place where "correct by construction" would be expensive to be wrong about. |
| 16 | Blocked-date overlap check | `app/api/campsites/[id]/blocked-dates/route.ts:113` | NO-CHANGE | Filters by camp + dates + status; a host-recorded stay correctly blocks a host from blanket-blocking nights that are sold. |
| 17 | `bookingSchema` (writer) | `lib/validations/booking.ts` | NO-CHANGE | The camper path keeps `userId: z.string().uuid()` required. The new stays schema is separate; the camper route must not gain an optional-user path. |

**Single seam invariant, enforced by ONE matrix test** (per §15b — per-layer tests cannot see cross-layer divergence): for the same camp, dates and guest count, a `HOST_RECORDED` `CONFIRMED` booking and a `CAMPER_SELF_BOOKED` `CONFIRMED` booking move readers #5, #6, #7, #8 and #9 by exactly the same amount, in both whole-camp and per-spot capacity modes, and at the `capacity = null` (unbounded) and `capacity = 0` (closed) edges. This is the CAM-355 → CAM-400 lesson written as a test.

**Second invariant test:** readers #10–#15 return byte-identical results before and after the migration for every existing camper booking. Nothing camper-facing may move.

## 6. ADRs

- [ADR-017](../../../../adr/ADR-017-host-recorded-stay-and-booking-discriminator.md) — reuse `Booking`; `origin` is the discriminator; `BookingSource` untouched; `HostLead` is not a prerequisite.
- [ADR-012](../../../../adr/ADR-012-hostos-data-model.md) §6 — superseded in part by the above.
- [ADR-005](../../../../adr/ADR-005-booking-snapshot.md) — what to freeze. [ADR-006](../../../../adr/ADR-006-booking-atomic-inventory-lock.md) — why Serializable + bounded retry.

Confirmation (what FAILS if a decision here is violated):

- *No forked capacity path:* the seam matrix test in §5 fails if any availability reader gains a creator-based predicate or if a host-recorded stay is counted differently from a camper booking.
- *`BookingSource` stays attribution-only:* the existing `__tests__/cam-642-booking-source.test.ts` fails if `z.enum(['WEB','CHAT'])` in `lib/validations/booking.ts:38` grows a value.
- *Concurrency:* a test that fires two overlapping create requests at the same instant and asserts exactly one `Booking` row and one `409` — sequential requests do not prove this and must not be substituted.
- *Review gate:* a test asserting a host-recorded stay grants no review right (AC-6).
- *Migration reversibility:* an up → down → up run on the local dev DB that first exercises the `DELETE … WHERE userId IS NULL` precondition.
- *No PII in the audit trail:* a test asserting the `stay.recorded` `AuditLog` metadata contains no `guestName`/`guestContact`.

## Links

`../../feature.md` (## Architecture overview) · `prisma/schema.prisma` · `story.md` · `../epic.md`

## Changelog

- v1 (2026-08-06) — created by CAM-686 Discovery alongside ADR-017
