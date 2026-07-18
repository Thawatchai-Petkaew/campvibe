---
linear: CAM-418
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-19
---
# Booking tools — getMyBookings / getMyBookingDetail (CAM-418)

> Full design: `docs/adr/ADR-013-ai-chat-persistence-agency-foundation.md` §D5 (Tiered tool
> registry + 4 personal tools), build-order row S5a. (Corrected from the dispatch's "§D4" pointer —
> D4 is the agent-loop decision, CAM-415/416; the booking tools are D5.)
> Type: internal engine plumbing (wire contract byte-stable — `POST /api/ai/chat` request/response
> shape unchanged; no card generation, no new endpoint). Spec-lite class: no schema/migration,
> no new/changed API contract, single file-surface. G1: folded — ADR-013 D5 is the ratified spec.
> Depends on: CAM-417 (the tiered registry + `ToolContext`/`dispatchTool` plumbing this story
> is the first real `authed`-tier consumer of).

## Story
As the **platform** (server-authoritative tool layer; the camper never calls this directly — the
assistant does, in chat), I want two `authed`-tier AI tools — `getMyBookings` and
`getMyBookingDetail` — that let a logged-in camper ask the assistant about their own bookings
("การจองของฉัน", "จองล่าสุดสถานะอะไร"), so that the assistant can answer from real, owner-scoped
data instead of "I don't have access to your bookings."

Scope: two new tools in `lib/ai/tools/my-bookings.ts`, registered `tier: 'authed'` in
`lib/ai/tools/index.ts`. Both receive the caller's identity ONLY via `ToolContext.userId`
(server-bound from the session, per CAM-417) — `bookingId` IS a model arg on
`getMyBookingDetail` (zod-validated), but ownership is enforced by `getOwnedBooking`'s
`where: { id, userId }`, never by trusting the model. Results feed the assistant as plain text
(the assistant links to `/bookings/[id]` for the real page) — no card/rich-block rendering ships
in this story.
Depends on: CAM-417 (tiered registry + `ToolContext`/`dispatchTool` this story consumes).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A logged-in camper (`ctx.userId` set) has 1+ bookings | The assistant calls `getMyBookings` | — (model-authored prose; no fixed screen copy ships this story) | Returns only THAT user's bookings, newest-first, capped at 10 (BR-1) — never another user's | EC-1 |
| AC-2 | A logged-in camper asks about ONE booking they own | The assistant calls `getMyBookingDetail` with that booking's id | — | Returns the full owned-booking detail (dates, guests, price, camp + spot) via `getOwnedBooking` (BR-2) | EC-2 |
| AC-3 | A booking id that does not exist, or belongs to a different user | The assistant calls `getMyBookingDetail` with that id | — | Returns a handled `{ ok:false, code:'not_found' }` — identical for both cases, no existence leak (mirrors CAM-61 AC#7) | EC-3 |
| AC-4 | The full real registered tool set (guest + authed) | The CAM-417 security-invariant test runs | — | Neither `getMyBookings` nor `getMyBookingDetail`'s zod `parameters` or `jsonSchema` contains a `userId` (or any caller-identity) field | EC-4 |

## Rules
- BR-1: `getMyBookings` queries `where: { userId: ctx.userId }`, `orderBy: { createdAt: 'desc' }`, `take: MY_BOOKINGS_MAX_RESULTS` (10) — no model arg exists to request a larger count (proves AC-1).
- BR-2: `getMyBookingDetail` takes `bookingId` (zod `.uuid()`) as a model arg, but ownership is enforced entirely by `getOwnedBooking(id, ctx.userId)`'s `where: { id, userId }` (lib/bookings.ts, reused unchanged) — never by trusting the model-supplied id alone (proves AC-2/AC-3).
- BR-3: Neither tool's zod `parameters` shape nor its `jsonSchema` contains a `userId` (or any caller-identity) field — `ctx.userId` is the only channel (CAM-417 D5 invariant, extended to these two tools; proves AC-4).
- BR-4: Both tools are `tier: 'authed'` — `dispatchTool` refuses execution with `unauthorized_tool` when `ctx.userId` is absent (CAM-417 registry, reused not forked); each tool's own `execute()` additionally never issues an unscoped query — a missing `ctx.userId` returns an empty list / `not_found` rather than querying without a `userId` filter (defense-in-depth).
- BR-5: `Booking.totalPrice` (Decimal) is serialized to a plain `totalAmount: number` (via `serializeDecimals`) before the tool result is returned — never a raw `Prisma.Decimal` object reaches the model/JSON layer.

## Edge cases
- EC-1: IF the caller has zero bookings THEN `getMyBookings` returns `{ bookings: [] }` — not an error, not a crash (BR-1).
- EC-2: IF `bookingId` is not a valid UUID THEN the registry's zod parse rejects it (`invalid_args`) before `dispatchTool` ever calls `execute()` — no query runs (BR-2).
- EC-3: IF the requested `bookingId` exists but belongs to a different user (or does not exist at all) THEN `getMyBookingDetail` returns `{ ok:false, code:'not_found' }` for both cases identically — no existence leak (BR-2).
- EC-4: IF either tool's `execute()` were ever reached with `ctx.userId` absent (should never happen — `dispatchTool` refuses first, BR-4) THEN it returns an empty list / `not_found` rather than an unscoped query — defense-in-depth, never a cross-user read.

## Data
- No schema/migration. Reuses the existing `Booking` model unchanged.
  - `getMyBookings`: new scoped `select` — `id, status, checkInDate, checkOutDate, snapshotCampName, totalPrice` (mapped to `totalAmount:number` after Decimal serialization, BR-5). No new query PATH — same `where`/`orderBy` shape as `GET /api/bookings` (app/api/bookings/route.ts), tighter cap.
  - `getMyBookingDetail`: reuses `getOwnedBooking`'s existing select unchanged (id, dates, guests, totalPrice, currency, status, createdAt, campSite{nameTh, nameEn, checkInTime, checkOutTime, phone, lineId, images, location{province}}, spot{name, zone}).

## Seams & refs
- Reuse: `lib/bookings.ts` `getOwnedBooking` (never forked) · the CAM-417 tiered registry (`tier:'authed'`, `ToolContext`, `dispatchTool`'s tier guard — this story is its first real `authed` consumer) · `lib/serialize.ts` `serializeDecimals` · the CAM-61 "same 404 for not-found and not-owned, no existence leak" convention.
- Refs: ADR-013 §D5 (S5a row) · CAM-417 (registry plumbing) · CAM-61 (not_found/no-existence-leak precedent this story mirrors for `getMyBookingDetail`).
- Not touched: `app/api/ai/chat/route.ts` (still no `auth()` read — CAM-420 wires a real `ctx.userId`; until then these tools are registered but never actually offered to a live request) · `getMyProfile`/`getMyWishlist` (CAM-419, concurrent, different files) · no write path added.

## Out of scope
- `getMyProfile` (phone-masked) / `getMyWishlist` → CAM-419 (S5b, concurrent — different files, no overlap).
- Reading `auth()` in `app/api/ai/chat/route.ts` to populate a real `ctx.userId` on live requests → CAM-420.
- Card/rich-block rendering of booking results in the chat UI → not scheduled this wave; plain text only.

## Self-verify
- AC-1..4 → unit (`__tests__/cam-418-my-bookings-tools.test.ts`): `getMyBookings` scoped + capped query shape, empty-list (EC-1); `getMyBookingDetail` owned→detail (AC-2), non-owned/absent id→`not_found` (AC-3/EC-3), invalid-uuid rejected at the zod boundary (EC-2); a two-user fixture proving zero cross-read; the whole-registry no-`userId`-in-schema invariant re-asserted for these two tools specifically (AC-4/BR-3).
- Story-specific: no ownership bug (never query without `ctx.userId`, BR-4/EC-4) · Decimal→number serialization asserted (BR-5) · full suite re-run as the last act, zero new failures.
- Gate = `/quality-gate` · Done = merged into `dev`, AC verified on localhost (dev DB) before merge.

## Changelog
- v1 (2026-07-19) — created.
