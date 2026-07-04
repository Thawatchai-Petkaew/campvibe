---
linear: CAM-302
feature: data-trust
epic: availability-correctness-ว่างจริง-blockeddate-part (CAM-22)
persona: host
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-04
---
# Temporary spot holds with expiry, counted against real availability (CAM-302)

## Story
As a **Host**, I want to place a temporary hold on a date range with an automatic expiry, so that dates I am still negotiating over LINE, Facebook, or phone cannot be sold to another guest while the conversation is open.
Why: there is no in-system way to reserve inventory during a negotiation today, so the same dates can be double-sold mid-conversation.
Scope: the `InternalHold` data model (reduced M1 slice — no lead/quote/booking links yet), a host-only hold service (create · list · release per campsite), and folding holds into the ONE availability calculation (`lib/campsite-availability.ts`) so they count in the existing month calendar (CAM-55) and the booking write path (CAM-57), with lazy expiry (no scheduled job). The trigger for create/list/release is the host hold service (no hold-management form UI this story — see Out of scope).
Depends on: ADR-012 §4 InternalHold (Accepted) · reuses ADR-006 (serializable inventory lock) · integrates the CAM-267 / CAM-190 availability math

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | a date range with free capacity on a camp the host manages | the host places a temporary hold on that range (guests + dates) | on the availability month calendar those dates show fewer spots left, e.g. `เหลือ {n} ที่` with a lower {n} | one `InternalHold` row is created with status `ACTIVE`; when no expiry is given, expiresAt = creation time + 48 hours; its guests are summed into the availability math for every night in the range | EC-1, EC-2 |
| AC-2 | an `ACTIVE` hold whose expiry time has already passed | anyone next opens that camp's availability | those dates show the full spots left again, `เหลือ {n} ที่` back to the pre-hold {n}, with no leftover hold | the expired hold is dropped by the read-time filter (status `ACTIVE` and expiry strictly in the future); no scheduled job runs and the row is never rewritten | EC-7 |
| AC-3 | an `ACTIVE` hold | the host releases (cancels) that hold | those dates immediately show the full spots left again, `เหลือ {n} ที่` restored | the hold's status becomes `RELEASED` (the row is kept, not deleted) and it stops counting from that moment | EC-3, EC-4 |
| AC-4 | an `ACTIVE` hold that fills the remaining capacity for a date range | a guest tries to book those same dates | the booking flow rejects the dates as unavailable, reusing the flow's existing full-capacity treatment (`เต็มแล้ว`); CAM-302 does not restyle it | the guest booking is rejected by the same capacity check that already counts bookings, because holds now count in that check; no `Booking` row is created | EC-5 |
| AC-5 | a hold whose range would exceed remaining capacity (overlapping an `ACTIVE` hold or a `CONFIRMED`/`PENDING` booking) | the host tries to place the hold | the hold is not saved and the host is told `ช่วงวันที่นี้ถูกกันไว้แล้ว` | no `InternalHold` row is created; the conflict is caught inside the serializable transaction before insert | EC-1, EC-5 |
| AC-6 | a user who is not the camp owner and holds no `BOOKING_UPDATE` right on it | that user tries to create, list, or release a hold on the camp | the action is refused (the user never reaches it) | no hold is created, listed, or changed; the service answers `401` when signed out and `403` when signed in without the right | EC-4, EC-6 |

## Rules
- BR-1 Default expiry = creation time + 48 hours when the host gives none. A host-set expiry must be in the future and at most 14 days from creation; outside that range the create is rejected with `กำหนดหมดอายุต้องอยู่ระหว่างตอนนี้ถึง 14 วันข้างหน้า` and no row is written. (proves AC-1, EC-2)
- BR-2 Holds are counted ONLY through the existing availability functions in `lib/campsite-availability.ts` (`getCampSiteDailyAvailability`, `getRemainingCapacity`, `checkDateAvailabilityInTx`) — no parallel calculation. Everywhere a hold is counted, the read-time filter is status = `ACTIVE` AND expiresAt strictly after now, so an expired hold silently stops counting with no scheduled job and no row rewrite (lazy expiry, ADR-012 §4). `endDate` is the exclusive checkout day, identical to `Booking`/`BlockedDate` — do not reinterpret as inclusive. (proves AC-2, AC-4, EC-7)
- BR-3 Hold creation runs inside a serializable transaction with bounded retry (the ADR-006 pattern `withBookingTransaction` already uses), reading overlapping `CONFIRMED`/`PENDING` bookings AND overlapping `ACTIVE` non-expired holds for the same camp (and the same spot, for a spot-level hold) before writing. If any night would exceed remaining capacity the create is rejected with `ช่วงวันที่นี้ถูกกันไว้แล้ว` and no row is written. (proves AC-5, EC-1, EC-5)
- BR-4 Release sets status = `RELEASED`; the row is kept (append-only history, never deleted) and stops counting immediately (an explicit write, no lazy delay). Releasing a missing, cross-camp, or already-`RELEASED` hold answers `404` and changes nothing. (proves AC-3, EC-3)
- BR-5 status is `HoldStatus { ACTIVE, RELEASED, CONVERTED }` per ADR-012 §4. CAM-302 exercises only (none)→`ACTIVE` and `ACTIVE`→`RELEASED`; `CONVERTED` (a hold turning into a manual stay) is defined by the accepted ADR but is not reachable until the ManualStay story ships. (proves AC-1, AC-3)
- BR-6 Create, list, and release require `BOOKING_UPDATE` on the campsite (`requireCampSitePermission` — owner, platform admin, or team member with the right), exactly as CAM-56 blocked-dates. A spot-level hold's spotId must belong to the campsite (IDOR guard) or the request answers `404`. (proves AC-6, EC-4, EC-6)
- BR-7 Each create and each release writes one `AuditLog` row (actor, action, hold id, camp id, date range) with no PII in the payload. (proves AC-1, AC-3)

## Edge cases
- EC-1 IF a create's range would push any night over remaining capacity (an overlapping `ACTIVE` hold or a `CONFIRMED`/`PENDING` booking leaves no room) THEN reject with `ช่วงวันที่นี้ถูกกันไว้แล้ว` and create no row (BR-3)
- EC-2 IF the requested expiry is in the past or more than 14 days ahead THEN reject with `กำหนดหมดอายุต้องอยู่ระหว่างตอนนี้ถึง 14 วันข้างหน้า` and create no row (BR-1)
- EC-3 IF a release targets a hold that is not under this campsite, does not exist, or is already `RELEASED` THEN answer `404` and change nothing (BR-4)
- EC-4 IF the caller lacks `BOOKING_UPDATE` on the campsite THEN answer `401` when signed out or `403` when signed in without the right, and change nothing (BR-6)
- EC-5 IF two hold or booking writes race for the same last capacity THEN the serializable transaction lets exactly one win and rejects the other with `ช่วงวันที่นี้ถูกกันไว้แล้ว` — never a double reservation (BR-3)
- EC-6 IF a spot-level hold names a spotId that does not belong to this campsite THEN answer `404` and create no row (BR-6)
- EC-7 IF a hold's expiry time is exactly reached THEN from that instant it no longer counts (the read-time filter treats expiry as strictly-in-the-future) (BR-2)

## Data
- New model `InternalHold` (reduced M1 slice of ADR-012 §4), atomic fields: `id` · `campSiteId` (FK CampSite) · `spotId?` (FK Spot; null = whole-camp hold) · `startDate` (Date) · `endDate` (Date, exclusive checkout) · `guests` (Int, counted like `Booking.guests`) · `note?` (free text) · `status` (`HoldStatus` enum) · `expiresAt` (DateTime, compared lazily at read time) · `createdById` (FK User) · `createdAt` · `updatedAt`. Indexes: `(campSiteId, startDate, endDate)` · `spotId` · `status`. migration: reversible (additive only — new enum + new table + FKs; roll back by dropping the table + enum; no existing table is altered).
- Deferred columns, NOT in this migration: the `leadId` / `quoteId` / `bookingId` FKs from ADR-012 §4 — their target tables (`HostLead`, `Quote`, and the ManualStay `Booking` extension) do not exist yet. They land as additive nullable FK columns in the HostOS lead/quote story (CAM-311), never altering what CAM-302 ships.
- Touched (existing shape, no column change): a `heldGuests` number is added to the per-day object returned by `getCampSiteDailyAvailability` and to `getRemainingCapacity`'s result, kept separate from `bookedGuests` (ADR-012 §4).

## Seams & refs
- Reuse (no parallel logic): `lib/campsite-availability.ts` is the single availability source (CAM-190 / CAM-267). Fold holds into its three functions only — `getCampSiteDailyAvailability` (add a `heldGuests` leg + field), `getRemainingCapacity` (subtract `heldGuests` from the bottleneck night), `checkDateAvailabilityInTx` (extend to also read `ACTIVE` non-expired holds inside the tx). Do not fork.
- SEAM — booking write path RIDES THROUGH FOR FREE: `app/api/bookings/route.ts` calls `checkDateAvailabilityInTx(tx, …)` once per night and reads only `.available`. Extending that ONE function to count holds makes a guest booking over a hold auto-reject with NO change to the booking route — this is the KPI seam (AC-4).
- SEAM — calendar display does NOT ride through for free (CAM-342 trap): trace `InternalHold` → `getCampSiteDailyAvailability.heldGuests` → `GET /api/campsites/[id]/availability` → `AvailabilityCalendar` (CAM-55). The calendar component reads `remainingGuests` from the API and needs NO change. BUT `app/api/campsites/[id]/availability/route.ts` re-derives every response field by explicit enumeration (`remainingGuests: maxGuestsPerDay - data.bookedGuests`, `available: !isCapacityFull && !blockedByHost`) — it does NOT spread the daily-availability object, so a new `heldGuests` field will NOT surface on its own. The route MUST be updated to `remainingGuests = max - (bookedGuests + heldGuests)` and fold `heldGuests` into `available`. Only then does the CAM-55 calendar's `เหลือ {n} ที่` reflect holds. This route change is IN scope; the calendar component is NOT touched.
- Authz / API pattern: mirror CAM-56 blocked-dates — `requireCampSitePermission(id, 'BOOKING_UPDATE')`, `apiSuccess`/`apiError`, IDOR guard on spotId, hard-reject on conflict (`409`, no warn-but-allow). Refs: ADR-012 §4 (model + lazy expiry + double-hold prevention) · ADR-006 (serializable lock + bounded retry) · ADR-005 (exclusive-checkout date semantics).

## Out of scope
- Host hold-management form UI (a create / list / release section on the availability page) — this story is the API + math core only → follow-up story (host holds UI) to be carded. PO decision: the model + service + three math touchpoints + double-hold transaction already sit near the ~400-line atomic ceiling; adding the form + list + i18n would push the PR well past it, so the write UI is split out (see the report). CAM-302 stays user-verifiable on Staging through the existing CAM-55 calendar.
- Separate "on hold" chip/count in the calendar (held vs booked shown as two numbers) → with the UI follow-up.
- `leadId` / `quoteId` / `bookingId` linkage and the `CONVERTED` transition (a hold becoming a manual stay) → CAM-311 (HostOS lead/quote) plus the ManualStay story.
- Spot-level hold creation via UI (the model + service accept `spotId`; there is no UI spot picker this story).
- Notifying the host before a hold expires → not scoped.
- Public / guest-facing hold surfaces → out.

## Self-verify
- AC-1 → integration (create → row `ACTIVE` + default 48h expiry + `heldGuests` counted) + owner-verify the calendar's `เหลือ {n} ที่` drops on the real Staging URL
- AC-2 → unit/integration (an expired hold is excluded by the read-time predicate; the row is not mutated) + owner-verify the calendar restores
- AC-3 → integration (release → `RELEASED`, stops counting immediately) + owner-verify the calendar restores
- AC-4 → integration (a booking POST is rejected when a hold fills capacity — the `checkDateAvailabilityInTx` seam, no booking-route change)
- AC-5 → integration (overlap/over-capacity create rejected, no row) + concurrency test for EC-5 (two racing creates, exactly one wins)
- AC-6 → integration (`401` signed-out, `403` without `BOOKING_UPDATE`) + IDOR spotId → `404` (EC-6)
- Story-specific: migration up→down→up on Staging (additive, reversible); no `leadId`/`quoteId`/`bookingId` FK in this migration; only `ACTIVE` and `RELEASED` transitions reachable; the lazy predicate is present in ALL three availability functions AND in the availability route; audit row on every create and release.
- Gate = /quality-gate · Done = every AC verified on the real Staging URL (a hold created via the host service drops the calendar's remaining count, then it restores on release and on expiry)

## Changelog
- v1 (2026-07-04) — created. Ported and refined from the estate-phase Thai v2 ticket and aligned to ADR-012 §4: status `RELEASED` (not `CANCELLED`), lazy expiry (not an `EXPIRED`-status write / no cron), reduced model without the lead/quote/booking FKs, and the hold-management UI cut to a follow-up to keep the PR atomic.
