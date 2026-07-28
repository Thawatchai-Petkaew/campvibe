---
linear: CAM-642
feature: ai-assistant
epic: in-chat-guided-booking (CAM-630)
persona: platform
artifact: story
owner: backend
status: In Progress
version: v1
updated: 2026-07-29
---
# Every booking records where it came from (CAM-642)

<!-- Not spec-lite: this story carries the epic's one schema change (Booking.source + a
default flip on Booking.status). Full spec-first per Gate policy v2; spec authored on the
story's own branch, code lands in the same single PR into dev. -->

## Story
As the **platform**, I want every `Booking` to record which route created it (the existing web booking flow, or the in-chat guided booking flow epic CAM-630 is about to add), so that the platform can tell them apart later without having to guess or backfill.
Why: attribution cannot be backfilled after the fact — a booking that already happened carries no trace of which UI produced it unless it is captured at write time. Epic CAM-630 is about to add a second route into booking (in-chat), so this is the last moment `source` can be captured for free. This is also the only schema change in the epic, so it ships alone, ahead of the chat-side callers.
Scope: `prisma/schema.prisma` (new `BookingSource` enum + `Booking.source` column) + the `POST /api/bookings` boundary (`lib/validations/booking.ts`, `app/api/bookings/route.ts`) accepting an optional `source`, defaulting to `WEB`. Also flips `Booking.status`'s column default from `CONFIRMED` to `PENDING` (a latent bug that is harmless today only because the single existing writer always overrides it explicitly — see Rules BR-3). No UI, no chat-side caller yet — those are follow-up tickets under epic CAM-630 (CAM-635 forwards `source: 'CHAT'` from the camp detail page).
Depends on: epic CAM-630 (in-chat guided booking); ADR-016 (`docs/adr/ADR-016-...`, campers book directly and the assistant completes bookings in chat)

## AC
<!-- Pure backend/data contract, no UI surface yet — "Then" is dev-facing (persisted value / response shape), matching the CAM-634 precedent for this class of ticket. -->
| # | Given | When | Then (dev-facing, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | An authenticated camper submits `POST /api/bookings` with no `source` field in the body | The booking is created | The response body's `source` is `"WEB"` | `Booking.source = 'WEB'` is persisted | EC-1 |
| AC-2 | An authenticated camper submits `POST /api/bookings` with `source: "CHAT"` in the body | The booking is created | The response body's `source` is `"CHAT"` | `Booking.source = 'CHAT'` is persisted | EC-2 |
| AC-3 | An authenticated camper submits `POST /api/bookings` with a `source` value outside the closed set (`WEB`/`CHAT`) | The request is validated | Request is rejected, HTTP 400 `Validation Error` | No `Booking` row is created | AC-1 (happy twin) |
| AC-4 | An authenticated camper submits `POST /api/bookings` with a `userId` field in the body that does not match their own session | The booking is created | The persisted booking belongs to the SESSION user, not the body's `userId` | `Booking.userId` = `session.user.id`, never the body value | EC-3 |
| AC-5 | A new `Booking` row is created via the existing web flow (unaffected by this change) | The row is inserted | `status` still lands as `PENDING` (the route sets it explicitly; unaffected by the column-default flip in BR-3) | `Booking.status = 'PENDING'` | — (no behavior change; proven by the pre-existing CAM-57 success-path test, unchanged) |

## Rules
- BR-1 `source` is a closed enum (`BookingSource`: `WEB` | `CHAT`); the zod boundary rejects any other value with `400` (proves AC-3). It is never read for pricing, capacity, or authorization anywhere in `app/api/bookings/route.ts` — it is a label only (STRIDE/insecure-design note: a forged `source` cannot buy the requester anything).
- BR-2 `source` is optional on the request; when absent it defaults to `WEB`, matching the DB column's own default so existing/older callers are unaffected (api.md #12 — additive-by-addition contract change, proves AC-1).
- BR-3 `Booking.status`'s column default changes from `CONFIRMED` to `PENDING`. This is inert today: the only two writers of `Booking.status` (`app/api/bookings/route.ts:165` and `prisma/seed-bookings.ts:135`) both set `status` explicitly on every insert, so no row's behavior changes at merge time (grep-verified — see Seams & refs). The flip exists so a FUTURE writer (the in-chat booking flow, not yet built) cannot silently mint an unpaid, un-accepted booking that already reads as `CONFIRMED`.
- BR-4 `userId` on the booking is always the session's id (`requireAuth()` server-side), never a client-supplied value in the body — pre-existing behavior (`{ ...body, userId }` spread order in `app/api/bookings/route.ts`), pinned by a new test in this story rather than changed (proves AC-4).
- BR-5 The migration is additive only (new column with a default + a column-default change) — no backfill needed, no existing row loses data, reversible up→down→up.

## Edge cases
- EC-1 IF the request body omits `source` entirely THEN the persisted value is `WEB` (not `null`, not rejected) (BR-2).
- EC-2 IF the request body sets `source: "CHAT"` alongside every other currently-valid field combination (with/without `spotId`, boundary night counts, etc.) THEN `source` persists independently of those fields — it never gates or interacts with any existing validation rule (BR-1).
- EC-3 IF the request body's `userId` differs from the authenticated session's user id THEN the booking is still created (for the SESSION user) — never a 403, since `userId` in the body is simply ignored, not rejected (BR-4).

## Data
- `Booking.source` — new column, `BookingSource` enum (`WEB` | `CHAT`), `NOT NULL DEFAULT 'WEB'`. Classification: Public (attribution label, not PII/Financial).
- `Booking.status` — no shape change; only the column DEFAULT changes (`CONFIRMED` → `PENDING`). `BookingStatus` enum itself is unchanged.
- Migration: `prisma/migrations/20260728183438_cam642_booking_source/` — reversible. `migration.sql` (up): `CREATE TYPE "BookingSource"`, `ALTER TABLE "Booking" ADD COLUMN "source" ... DEFAULT 'WEB'`, `ALTER COLUMN "status" SET DEFAULT 'PENDING'`. `down.sql`: restores `status` default to `CONFIRMED`, drops `source`, drops the `BookingSource` type. Proven up→down→up against the local dev DB (see Self-verify).
- No backfill required — both changes are additive/default-only; every pre-existing row already has an explicit `status` and now reads `source = 'WEB'` (correct: they all came from the web flow).

## Seams & refs
- Reuse: `app/api/bookings/route.ts` (the one production writer of `Booking` — pricing/capacity/authz logic untouched, only the `source` field added to the existing `tx.booking.create` call) · `lib/validations/booking.ts` (`bookingSchema`, the one zod boundary for booking creation — no parallel validation).
- Reader/writer inventory (architecture.md §15b, since this changes a column's derivation/default): grepped `booking\.create|bookings\.createMany|booking\.createMany` across the repo. Two writers found: `app/api/bookings/route.ts:155` (sets `status: 'PENDING'` explicitly — NO-CHANGE, unaffected by the default flip) and `prisma/seed-bookings.ts:126` (sets `status: randomStatus` explicitly from a closed set — NO-CHANGE). No other writer exists; the default-flip's blast radius is therefore zero at merge time, by design (BR-3).
- Refs: epic CAM-630 (in-chat guided booking) · ADR-016 (campers book directly; the assistant completes bookings in chat) · CAM-635 (sibling story, forwards `from=chat` into this POST body — NOT touched by this story, out of scope below).

## Out of scope
- Wiring the camp detail page / in-chat flow to actually send `source: "CHAT"` → CAM-635 (sibling story under epic CAM-630).
- Any UI surface for booking source (e.g. an operator-facing "booked via chat" badge) → not yet filed; follow-up under epic CAM-630 if the product decides to surface it.
- Auditing/analytics on booking source distribution → not yet filed.

## Self-verify
- AC-1, AC-2 → integration test (`__tests__/cam-642-booking-source.test.ts`): `POST /api/bookings` with no `source` in the body persists `source: 'WEB'`; with `source: 'CHAT'` persists `source: 'CHAT'` (asserted on the `tx.booking.create` call's `data` argument).
- AC-3 → unit test on `bookingSchema` (out-of-enum value rejected) + integration test asserting the route returns `400 Validation Error` and never reaches `prisma.$transaction`.
- AC-4 → integration test: a body with a `userId` that does not match the session's id still persists the SESSION's `userId` (pins the `{ ...body, userId }` spread order — a regression here would be a real authz bug, not just a contract nit).
- AC-5 → pre-existing `__tests__/cam-57-atomic-lock.test.ts` success-path test (unchanged, still green) proves the web flow's explicit `status: 'PENDING'` write is unaffected by the column-default flip.
- Story-specific: migration proven up→down→up against the local dev DB (`campvibe`) — `npx prisma migrate dev` (up) → `psql -f down.sql` (down, confirmed `source` column dropped + `status` default reverted to `CONFIRMED`) → `psql -f migration.sql` (up again, confirmed both restored) → `npx prisma migrate status` clean. Grep-verified exactly 2 writers of `Booking.status`/`Booking` rows exist repo-wide (see Seams & refs) — the default flip changes 0 existing behaviors.
- Gate = `/quality-gate`. Done = merged to `dev` with AC verified on localhost against the dev DB (no UI/chat caller exists yet — pure API-contract story, verified via its own integration test suite + the migration proof above); G4 re-verifies on the real Staging URL once the batched promote runs `prisma migrate deploy`.

## Changelog
- v1 (2026-07-29) — created; implemented in the same PR (schema change + boundary + tests).
