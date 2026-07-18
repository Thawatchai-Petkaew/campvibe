---
artifact: story
owner: product-owner
version: 1
status: In Progress
---

# CAM-401 — Cap the per-night loop on the availability endpoint (client-controlled range can spin uncapped)

## Story

As the **Platform**, I want every per-night loop driven by client-supplied dates to have a hard range cap, so that a single unauthenticated request can never spin the event loop (CAM-344 class). Scope: `lib/campsite-availability.ts` (`getCampSiteDailyAvailability`, the uncapped `while` at ~L187) + its route `app/api/campsites/[id]/availability/route.ts` + a §15b sweep for any sibling per-night loop over client ranges. Depends on: — . Why: Security finding during CAM-400 review — the loop is reachable unauthenticated on public camps; `MAX_STATUS_RANGE_NIGHTS=366` already guards the catalog path (CAM-344 precedent) but not this one.

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | ช่วงวันที่ปกติ (≤366 คืน) | เรียกดูปฏิทินว่าง | ปฏิทินแสดงตามปกติ | ผลลัพธ์เดิมทุกกรณีปกติ | EC-1 |
| AC-2 | ช่วงวันที่กว้างผิดปกติ (>366 คืน) | เรียก endpoint ตรง | คำขอถูกปฏิเสธ (ข้อผิดพลาดการตรวจสอบ) | 400 ก่อนเข้า loop ไม่มีการวน; ไม่มี stack/รายละเอียดหลุด | EC-2 |

## Rules

- BR-1: the cap is checked BEFORE any loop runs (CAM-344 lesson: try/catch bounds errors, not CPU). Reuse `MAX_STATUS_RANGE_NIGHTS = 366` — one constant, not a twin.
- BR-2: §15b sweep — inventory EVERY per-night/per-day loop whose iteration count derives from client input across `lib/campsite-availability.ts` + `app/api/campsites/**`; cap or mark NO-CHANGE with reasoning in the spec (search terms: `while (currentDate`, `addDays`, `differenceInCalendarDays`).
- BR-3: the widget's own calls stay within the cap (verify the client never requests >366 nights; no client change expected).

## Edge cases

- EC-1: IF the range is exactly 366 nights THEN it processes normally (boundary inclusive per the existing constant's semantics — match CAM-344's comparison exactly).
- EC-2: IF startDate > endDate or unparsable THEN the existing validation path rejects as today (no regression).

## Data

None.

## Seams & refs

`MAX_STATUS_RANGE_NIGHTS` + the CAM-344 guard shape (`lib/campsite-availability.ts:390,458-462`) — mirror its computation + comparison; security.md CAM-344 rationalization row.

## Out of scope

Rate limiting (separate layer, already present on writes); caching.

## Self-verify

Tests: >cap → 400 + loop never entered (spy/structure), =cap boundary OK, normal ranges unchanged; existing availability suites green; lint/typecheck.

## BR-2 sweep (§15b) — every per-night/per-day loop over client-derived ranges

Grep-inventoried across `lib/campsite-availability.ts` + `app/api/campsites/**`
(search terms: `while (`, `setDate`, `setUTCDate`, `addDays`, `differenceInCalendarDays`).

| Loop | Location | Client-input driven? | Existing bound? | Action |
|---|---|---|---|---|
| Init `while (currentDate <= endDate)` | `campsite-availability.ts` `getCampSiteDailyAvailability` | YES — directly the caller's startDate/endDate, unauthenticated route | none | **CAPPED** (primary fix) — reuse `MAX_STATUS_RANGE_NIGHTS`, throw `AvailabilityRangeTooWideError` before any Prisma call |
| Booking `while (date < checkOut)` | `campsite-availability.ts` `getCampSiteDailyAvailability` | Indirectly — bounded by `booking.checkInDate/checkOutDate` (DB), not the request range | Booking capped at 30 nights at create (`lib/validations/booking.ts`, `nights <= 30`) | NO-CHANGE — already safe, max 30 iterations/booking |
| BlockedDate `while (cur <= blockEnd && cur <= endDate)` | `campsite-availability.ts` `getCampSiteDailyAvailability` | Partially — upper bound is client `endDate`, lower bound is `block.startDate` (DB) | BlockedDate capped at 90 days at create (`lib/validations/blocked-dates.ts`, `BLOCKED_DATE_MAX_RANGE_DAYS=90`) + already clamps `&& cur <= endDate` | NO-CHANGE — bounded to ≤ requested span + 90 days, safe once the primary cap lands |
| Hold `while (date < holdEnd)` | `campsite-availability.ts` `getCampSiteDailyAvailability` | Indirectly — bounded by `hold.startDate/endDate` (DB), **no** upstream span cap at write time | none | **CAPPED** — clamp traversal to `date <= endDate` (mirrors the BlockedDate loop's own pattern); pure bound-tightening, output unchanged |
| `getAvailabilityStatusForCamps` init/booking/blockedDate loops | `campsite-availability.ts` L545/564/578 | same shapes | function-level `MAX_STATUS_RANGE_NIGHTS` pre-check (L462, CAM-344) already gates all Prisma calls + loops for this function; booking/blockedDate write-time caps as above | NO-CHANGE — already safe |
| `getAvailabilityStatusForCamps` hold `while (cur < holdEnd)` | `campsite-availability.ts` L592 | same gap as the sibling hold loop above — the function-level range guard doesn't bound a hold's OWN span | none | **CAPPED** — clamp to `&& cur <= lastNight` (mirrors the blockedDate loop directly above it) |
| `checkDateAvailabilityInTx`'s single-date probe `while (d < checkOutDate)` | `campsite-availability.ts` `checkDateAvailabilityInTx` | No — takes ONE `date`, not a range; bounded by ONE booking's own checkIn/checkOut | Booking's 30-night cap | NO-CHANGE |
| `withHoldTransaction`'s per-night loop `while (night < endDate)` | `app/api/campsites/[id]/holds/route.ts` | **YES** — directly `data.startDate`/`data.endDate` from the POST body, no upstream span cap; each iteration runs a real DB query INSIDE a serializable transaction (most severe finding — could hold a transaction open indefinitely) | none | **CAPPED** — reject 400 before the transaction opens, reusing `MAX_STATUS_RANGE_NIGHTS` (same constant, no new business-rule value) |

Guard location decision (per BR-1): checked **inside** `getCampSiteDailyAvailability` itself
(protects every caller — the availability route AND `getRemainingCapacity` /
the remaining-capacity route transitively — no separate route-level
duplicate check needed), mirroring the CAM-344 principle of one shared
choke point.
