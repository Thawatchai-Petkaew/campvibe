---
linear: CAM-449
feature: ai-assistant
epic: chat-experience-overhaul
persona: Camper
artifact: story
owner: backend-engineer
status: Done
version: v1
updated: 2026-07-20
---
<!--
Process note: this story.md was written AFTER PR #523 shipped (backend fix
round, 2026-07-20) — QA's independent review (test.md, same folder) flagged
that no story.md landed with the original PR. Content below is reconstructed
from the shipped code's own doc comments + the QA dispatch's field list,
which were the only written source of the requirement at the time. Filed as a
process gap for `/retro`, not re-litigated here.
-->

## Story
As a **Camper**, I want the in-chat AI assistant's camp-detail card to show decision-relevant information — real total price and fees, capacity, cancellation policy, verified badge, description, check-in/out times, access directions, and live per-weekend remaining availability — so that I can decide whether to book without leaving the chat or opening the camp's full page.

Why: CAM-450's in-chat detail drawer needs this data; the CAM-427/CAM-446 tool only returned amenities/reviews/open-weekend-dates, not enough to decide.

Scope: extend the existing guest-tier `getCampDetail` read-only AI tool (`lib/ai/tools/get-camp-detail.ts`) + its existing `GET /api/ai/camp-detail/[id]` HTTP wrapper (CAM-446) with additional guest-safe fields, ALL sourced from the current `CampSite`/`Location` schema. No new endpoint, no new schema, no migration. `lib/api-client.ts`'s runtime narrowing is extended to match.
Depends on: CAM-427 (the tool) · CAM-446 (the HTTP route) · CAM-450 (the drawer UI that consumes these fields, not part of this story).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A published, active camp with a description/price/policy set | The assistant loads its detail card | — (no user-facing copy in this story; CAM-450 renders it) | `getCampDetail` response includes `description`, `price{low,high,currency,extraFeeAmount,extraFeeLabel,feeInfo,isFree}`, `cancellationPolicy`, `isVerified`, `checkInTime`, `checkOutTime`, `minimumAge`, `location{province,region}`, `directions` — Decimal fields serialized to plain numbers | EC-1 |
| AC-2 | A camp with `useSpotView: false` (whole-camp capacity) | The card loads | — | `capacity.maxGuestsPerDay/maxTentsPerDay` = the stored `CampSite` columns, unchanged | EC-2 |
| AC-3 | A camp with `useSpotView: true` (per-spot capacity; raw columns are `null`) | The card loads | — | `capacity.maxGuestsPerDay/maxTentsPerDay` = the EFFECTIVE, spot-derived capacity (same source `weekendAvailability` already uses) — never the raw `null` columns | EC-2 |
| AC-4 | A camp with capacity set (whole-camp or per-spot) | The card loads | — | `weekendAvailability[]` returns one entry per upcoming Saturday: `remaining` = live guest count for that night (`null` when uncapped, `0` or `blockedByHost:true` when full) | EC-3 |
| AC-5 | Any published camp | The card loads | — | `availableWeekendDates` (the CAM-427 legacy field) is still returned, unchanged, alongside `weekendAvailability` (back-compat for the current drawer + its tests) | — (no negative twin; this AC is a non-regression guarantee, not a new behavior) |
| AC-6 | Any published camp | The card loads | — | The response never contains an operator/contact/phone/lineId/facebookUrl/facebookMessageUrl/tiktokUrl/KYC/payout field, at any nesting level | EC-4 |
| AC-7 | A campSiteId that is not a valid UUID, or does not resolve to a published/active/non-deleted camp | The client calls `getCampDetail` | — | Unchanged from CAM-427/CAM-446: `{ok:false, code:'not_found'}` / `400 invalid_id` | AC-1 |

## Rules
- BR-1 `capacity` is always the EFFECTIVE capacity (`lib/campsite-availability.ts#getEffectiveCapacity`) — WHOLE-CAMP reads the stored `maxGuestsPerDay`/`maxTentsPerDay` columns; PER-SPOT (`useSpotView:true`) sums non-deleted spots. Never read the raw columns directly for this field (proves AC-2/AC-3).
- BR-2 `weekendAvailability[].remaining` is a GUEST count (not tents), computed via `getRemainingCapacityForCamps` for one night per upcoming Saturday (bounded to `WEEKEND_LOOKAHEAD_COUNT=8`, a fixed constant, never client-controlled) (proves AC-4).
- BR-3 `cancellationPolicy` is `null` only when the host has not set one — never inferred/guessed from price or any other field (ADR-003) (proves AC-1).
- BR-4 Decimal fields (`priceLow`, `priceHigh`, `extraFeeAmount`) are serialized to plain JS numbers on the wire, `null` when unset — never a Prisma `Decimal` object reaches the response (proves AC-1).
- BR-5 No operator/contact/KYC/payout field is ever selected by the Prisma query backing this tool, at any nesting level (proves AC-6).

## Edge cases
- EC-1 IF a Decimal price/fee field is unset (`null` in the DB) THEN the corresponding wire field is `null`, never a crash or a stringified Decimal (BR-4).
- EC-2 IF a camp is `useSpotView:true` with zero live (non-deleted) spots THEN effective capacity derives `0` (a real, closed cap) — never falls back to the stale raw column (BR-1, mirrors CAM-355 BR-6).
- EC-3 IF a Saturday night has no capacity cap set (`capacity === null`) AND is not host-blocked THEN `weekendAvailability[].remaining` is `null` (not `0`, not omitted) (BR-2).
- EC-4 IF the wire body is off-contract (missing a required new field, or a wrong-typed one, e.g. `weekendAvailability[].remaining` as a string) THEN `lib/api-client.ts`'s runtime narrowing rejects it and `aiChatAPI.getCampDetail` resolves `{ok:false, code:'not_found'}` — never a blind cast (code.md CAM-305) (BR-1..5 collectively).

## Data
- Entities/fields touched (read-only, all pre-existing): `CampSite.description/priceLow/priceHigh/priceCurrency/extraFeeAmount/extraFeeLabel/feeInfo/isFree/maxGuestsPerDay/maxTentsPerDay/useSpotView/cancellationPolicy/isVerified/checkInTime/checkOutTime/minimumAge/directions/latitude/longitude`, `Location.province/region`. New derived-only field: `lib/geo/distance.ts#distanceFromBangkokKm` (pure haversine, no new column). Migration: none (no schema change).

## Seams & refs
- Reuse: `lib/campsite-availability.ts#getEffectiveCapacity` (capacity, BR-1) · `lib/campsite-availability.ts#getRemainingCapacityForCamps` (weekendAvailability, BR-2) · `lib/cancellation-policy.ts#isCancellationPolicyValue` (BR-3, reused by the api-client narrowing) — no parallel capacity/availability logic introduced. Refs: ADR-009 (no-forked-data-path) · ADR-003 (closed enum → Prisma enum) · CAM-355/CAM-400 (the forked-capacity-path bug class this story's own fix round corrected).

## Out of scope
- Removing the legacy `availableWeekendDates` field once CAM-450 fully migrates to `weekendAvailability` → follow-up cleanup ticket (not yet filed).
- Rendering any of these fields in the UI → CAM-450 (the in-chat drawer).

## Self-verify
- AC-1, AC-5, AC-6, AC-7 → unit (`__tests__/cam-449-camp-detail-fields.test.ts`, `__tests__/cam-427-get-camp-detail.test.ts`, `__tests__/cam-446-*.test.ts`)
- AC-2, AC-3 → unit, Prove-It (`__tests__/cam-449-camp-detail-fields.test.ts` — the `useSpotView:true` capacity case; confirmed red against the raw-column bug, green after the `getEffectiveCapacity` fix)
- AC-4 → unit, 5 scenarios (open / uncapped / full / host-blocked / camp-absent-from-batch)
- Story-specific: no migration (N/A) · no ownership check needed (guest-tier, read-only, no mutation) · PDPA forbidden-word scan extended for the wider select
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-20) — created retroactively after PR #523's fix round (QA-flagged process gap); documents the shipped behavior including the capacity/spot-view fix.
