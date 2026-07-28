---
linear: CAM-619
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Host
artifact: story
owner: backend-engineer
status: in-progress
version: v3
updated: 2026-07-28
---
# Carry each sibling's guard across to the endpoint that lacks it (CAM-619)

## Story
As a **Host** (and as the platform protecting every Host/Camper who depends on the data a Host saves), I want the five sibling-endpoint pairs that validate the same value differently to enforce the SAME guard on both sides, so that a lax write path can no longer undo what its stricter sibling already enforces.
Why: a guard-symmetry sweep (2026-07-28) found five cases where the correct guard already exists on a sibling endpoint, written by us — nothing needed inventing, it needed carrying across. The sharpest: `CampSite.latitude/longitude` had no range check at all while `POST /api/location` enforces -90..90/-180..180 for the SAME host pin, and CAM-575's `campsite_coords_sync` DB trigger derives `Location.lat/lon` FROM `CampSite.latitude/longitude` — so the unguarded branch silently overwrote the guarded one. A backfill already had to repair 18 rows that geocoded outside Thailand.
Scope: `lib/validations/campsite.ts` · `lib/validations/location.ts` (shared bound extraction only) · `app/api/campsites/route.ts` (POST) · `app/api/campsites/[id]/route.ts` (PUT/DELETE) · `app/api/locations/search/route.ts` · `app/api/admin-areas/subdistricts/route.ts`. Does not touch `prisma/schema.prisma`, `components/**`, or `lib/ai/**`.
Depends on: CAM-575 (`campsite_coords_sync` trigger) · CAM-344 (the array-length-cap lesson this story carries across) · CAM-534 (the catalog rate-limit precedent this story's locations/admin-areas limits follow)

## AC
| # | Given | When | Then (dev-facing, plain language — no end-user Thai copy change on 4 of 5; coordinates/price reuse existing Thai strings verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A host submits a camp create/update with `latitude: 999` (or `Infinity`) | `POST /api/campsites` or `PUT /api/campsites/[id]` is called | `400` validation error; the value never reaches `prisma.campSite.create`/`update` | No `CampSite` row is created/updated; `campsite_coords_sync` trigger never fires with the bad value, so `Location.lat/lon` is never overwritten | EC-1 |
| AC-2 | A host submits `priceLow: 5000, priceHigh: 1000` (low > high), or a negative price / a price over 100,000, on create or update | `POST` or `PUT` is called | `400` with `ราคาต่ำสุดไม่สามารถมากกว่าราคาสูงสุดได้` (order) or `ราคาต้องอยู่ระหว่าง 0–100,000 บาท` (range) | No write happens; a PARTIAL `PUT` also evaluates the STORED value for whichever side the request omits (post-save projection) | EC-2 |
| AC-3 | A host submits a taxonomy array (e.g. `facilities`) longer than that MasterData group's real row count | `POST`/`PUT` is called | `400` validation error naming the offending field | The array never reaches `resolveOptionConnect`'s `code: { in: [...] } }` query | EC-3 |
| AC-4 | An operator has already made 30 `PUT`/10 `DELETE` requests to `/api/campsites/[id]` in the last hour | The operator makes another `PUT`/`DELETE` | `429` with `Retry-After` + a Thai rate-limited message | No Prisma write for that request; independent per-user counters (`campsite:update:<userId>` / `campsite:delete:<userId>`) | EC-4 |
| AC-5 | A client IP has made 100 requests to `GET /api/locations/search` or `GET /api/admin-areas/subdistricts` in the last 15 minutes | The IP makes another request | `429` with `Retry-After`; no DB query for that request | Independent per-IP counters (`locations:search:<ip>` / `admin-areas:subdistricts:<ip>`) | EC-5 |

## Rules
- BR-1 `CampSite.latitude`/`longitude` are validated with the SAME shared schema `POST /api/location` uses (`latitudeSchema`/`longitudeSchema`, extracted once into `lib/validations/location.ts` and imported by `lib/validations/campsite.ts`) — `.finite()` + `-90..90`/`-180..180`. No second copy of the bound. (proves AC-1)
- BR-2 `priceLow`/`priceHigh` are `.finite().min(0).max(100000)` (matches `extraFeeAmount` in the same file + the `pricePerNight` catalog row, `.claude/rules/ux.md` §2). The `priceLow<=priceHigh` ordering is enforced by a shared `isPriceOrderValid()` helper called from BOTH route handlers AFTER a successful `campSiteSchema(.partial()).safeParse()` — never a top-level zod `.refine()`/`.superRefine()` on `campSiteSchema` itself, because `.partial()` is called on that exact export by both the PUT route and the client-side pre-check in `components/CampgroundForm.tsx` (outside this story's file surface); a `.refine()` wrapper turns the schema into a `ZodEffects` with no `.partial()` method and would break both call sites at compile time. A persisted `priceLow > priceHigh` is a real defect (the card renders an inverted range) on either write path, so this is enforced identically on create AND update — not an asymmetry. (proves AC-2)
  - **v2/v3 history:** the order check was briefly removed from `PUT` after CI caught `e2e/regression/ac1-edit-round-trip.spec.ts` failing (400 instead of 200) — its fixture bumped the seeded camp's `priceLow` from 250 to 777 while `priceHigh` stayed at 600 (unchanged, since `CampgroundForm.tsx` submits the full current form state every save), producing a real, reproduced `400 ราคาต่ำสุดไม่สามารถมากกว่าราคาสูงสุดได้`. On review (owner override), the FIXTURE was the defect, not the guard: the spec's own intent ("an edit round-trips") holds for any in-band value, and a persisted inverted price band is exactly the defect this story exists to close. The guard was restored on PUT; the e2e fixture was corrected to `450` (still in-band, still distinct from the seed's `250` so the round-trip is real). **Recorded follow-up (tech.md, not built here):** `CampgroundForm.tsx` should run this same order check client-side, before submit, so a host editing only one price field never sees a 400 naming the field they didn't touch.
- BR-3 Every taxonomy array on the host write path is capped: the 11 MasterData-group arrays (`accessTypes`/`accommodationTypes`/`facilities`/`externalFacilities`/`equipment`/`activities`/`terrain`/`annotatedFeatures`/`camperStyle`/`stayConnected`/`markingMethod`/`driveway`) at that group's CURRENT live-DB row count (verified 2026-07-28); `images` at 50 (real max observed: 30, across 795 live camps); `tags` at 20 (real max observed: 4). (proves AC-3)
- BR-4 `PUT`/`DELETE /api/campsites/[id]` are rate-limited per authenticated user: PUT at 30/hour (`campsite:update:<userId>`), DELETE at 10/hour (`campsite:delete:<userId>`) — checked AFTER `requireCampSitePermission` resolves (that shared helper, outside this story's surface, is the only source of the session's userId here). PUT's limit is 3x its sibling POST's 10/hour because `CampgroundForm.tsx`'s publish-completeness gate (`isPublishTransition`) is DESIGNED to make a host re-save several times while completing a listing; DELETE mirrors POST's cadence (rare, deliberate, one-shot). Verified: every real caller of these two routes (`components/CampgroundForm.tsx`, `app/dashboard/campsites/page.tsx`) fires exactly ONE request per explicit user action, never a loop. (proves AC-4)
- BR-5 `GET /api/locations/search` and `GET /api/admin-areas/subdistricts` are rate-limited per IP at 100/15min (the general baseline `.claude/rules/security.md` states), matching the floor guard their two siblings (`POST /api/ai/chat`, `GET /api/ai/camp-detail/[id]`) already carry for the identical reason ("a public read-only route still needs a floor guard against scraping/abuse"). `components/LocationPicker.tsx` debounces at 300ms across at most 2-3 cascading comboboxes, so a real host session stays a small fraction of this floor. (proves AC-5)

## Edge cases
- EC-1 IF `latitude`/`longitude` is `NaN`, `±Infinity`, or outside `-90..90`/`-180..180` THEN the request is rejected `400` before any Prisma call (BR-1).
- EC-2 IF only ONE of `priceLow`/`priceHigh` is sent on a partial `PUT` and it would invert the ALREADY-STORED value on the other side THEN the request is rejected `400` (post-save projection, not just the two fields in this request) — on BOTH create and update (BR-2).
- EC-3 IF a taxonomy array is at exactly its cap THEN it is accepted (boundary); one over THEN it is rejected `400` (BR-3).
- EC-4 IF the 31st `PUT` (or 11th `DELETE`) in an hour arrives for one user THEN it is `429` and no Prisma write happens for that request; a DIFFERENT user's counter is unaffected (BR-4).
- EC-5 IF the 101st request in 15 min arrives for one IP on either locations endpoint THEN it is `429`; a DIFFERENT IP's counter is unaffected (BR-5).

## Data
- No schema/DB change, no migration. Uses the existing in-memory `lib/rate-limit.ts` `checkRateLimit` store (module-level, per-instance, already documented as best-effort on serverless) for BR-4/BR-5. Zod-only bound tightening for BR-1/BR-2/BR-3 — no new column, no new table.

## Seams & refs
- Reuse: `latitudeSchema`/`longitudeSchema` (`lib/validations/location.ts`, extracted this story) · `checkRateLimit` (`lib/rate-limit.ts`, the SAME shared limiter every other rate-limited route in this codebase uses — no parallel limiter) · `resolveOptionConnect` (`lib/api-utils.ts`, unchanged — the query this story's array caps protect).
- Refs: CAM-575 (`campsite_coords_sync` trigger, ADR/tech in that story) · CAM-344 (`.claude/rules/security.md` — cap a client-controlled array/loop before the query) · CAM-534 (the `/api/campsites` GET rate-limit precedent this story's locations/admin-areas limits mirror) · `app/api/ai/camp-detail/[id]/route.ts` (the "public read-only route still needs a floor guard" precedent for BR-5).

## Out of scope
- `lib/validations/spot.ts`'s OWN array fields (`images`, `nearFacilities`) — not one of the five audited asymmetries; `spotSchema.pricePerNight`/`extraFeeAmount` in that file are cited only as the ALREADY-correct sibling pattern this story carries across elsewhere. Left untouched. Follow-up if a future sweep finds the same gap there: a new ticket.
- Distributed/shared-store rate limiting (Redis/Upstash) — `lib/rate-limit.ts`'s own header defers this as a cost decision, unchanged by this story.
- `geocodeReverseQuerySchema`/`geocodeForwardQuerySchema` in `lib/validations/location.ts` — already bounded (`z.coerce.number()` for query strings, own chain); not touched beyond the shared-constant extraction that does not change their behavior.

## Self-verify
- AC-1..AC-5 → `__tests__/cam-619-*.test.ts` (rejected-input tests that fail first, plus a real-DB test proving the coordinate write never reaches `prisma.campSite.update`/`create` — closing the trigger-propagation hole, not just the zod change).
- Story-specific: boundary tests at each cap's exact value (accepted) and cap+1 (rejected); independent-counter tests per rate limit (mirrors `__tests__/cam-534-catalog-rate-limit.test.ts`'s pattern).
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-28) — created.
- v2 (2026-07-28) — CI caught `e2e/regression/ac1-edit-round-trip.spec.ts` regressing (a normal single-field host price edit 400'd). Initial fix: removed the `priceLow<=priceHigh` order check from PUT, kept on POST only.
- v3 (2026-07-28) — **v2 was overridden on review.** The 400 was correct: a persisted `priceLow > priceHigh` is exactly the defect this story exists to close (an inverted price card). The e2e fixture, not the guard, was wrong — its arbitrary `777` exceeded the seeded `priceHigh` of `600`, which the spec's own intent ("an edit round-trips") never required. Restored the order check on PUT (both create and update, matching the original design); corrected the e2e fixture to `450` (in-band). Recorded a follow-up (tech.md): `CampgroundForm.tsx` should run this same check client-side before submit, so a host editing one field never sees a 400 naming a field they didn't touch.
