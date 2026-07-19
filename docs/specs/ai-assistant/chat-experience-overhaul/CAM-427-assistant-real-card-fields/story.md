## Story
As a **Camper**, I want the assistant's camp cards and floating detail card to be backed by REAL database fields (price, rating, first-tag, live remaining capacity, amenities, verified reviews, upcoming weekend dates) instead of the mock values a prototype UI would otherwise show, so that the assistant never tells me something about a camp that isn't actually true.
Why: the sibling design spec (CAM-426 Expression Layer, ai-camping-assistant epic) flagged 8 real-data gaps (G1-G8) between what the prototype mocks and what the schema actually has; this story closes the backend side of G3/G7/G8 (live availability, null-rating, null-province) plus adds the missing "first tag" field and a dedicated detail read — it deliberately leaves G1/G2 (altitude/distance/weather) OUT because those fields do not exist anywhere in `prisma/schema.prisma`.
Scope: backend read-models + AI tool contracts only (`lib/read-models/ai-camp-card.ts`, `lib/ai/tools/search-campsites.ts`, `lib/ai/tools/get-camp-detail.ts` [new], `lib/campsite-availability.ts`, `lib/api-client.ts` wire type). Does NOT touch `components/ai-chat/*` (the floating detail card UI itself ships in the Expression Layer story) — this story only ships the data those components will consume.
Depends on: CAM-270 (tool layer), CAM-272 (card wire contract), CAM-344/CAM-355 (batched availability) — ADR-009 (no-forked-data-path)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A published camp has a price, a Terrain-group tag, and reviews | Camper asks the assistant to find camps | Assistant card shows the real nightly price, the camp's real terrain descriptor (e.g. `แม่น้ำ ลำธาร คลองเล็ก`), and the real rating badge — never a placeholder value | `searchCampsites` returns `priceLow`, `avgRating`, `reviewCount`, and one `options` entry per card from the DB | EC-1 |
| AC-2 | Camper gave a stay date range in the same search | Assistant calls `searchCampsites` with `startDate`+`endDate` | Card shows the real remaining spot count for those dates (e.g. `เหลือ 6 ที่`) or `เต็ม` when full | Each card carries a live `remaining` number computed from Booking/BlockedDate/InternalHold for that exact range, batched (not per-card) | EC-2 |
| AC-3 | Camper gave no date range | Assistant calls `searchCampsites` with no dates | Card shows no live-availability text at all (never a fabricated number) | Every card's `remaining` is `null`; no availability query runs | — (cheapest path, nothing to fail) |
| AC-4 | Camper asks for a specific camp's detail | Assistant calls the new `getCampDetail` tool | Detail view has the camp's real amenities list, real verified reviews, and real upcoming Saturday availability — never mock rows | `getCampDetail` returns `amenities[]` (from `options`), `reviews[]` (verified, capped, newest-first), `reviewSummary`, `availableWeekendDates[]` | EC-3 |
| AC-5 | A camp has zero reviews | Camper views that camp's card or detail | Assistant never shows a misleading `0.0` star row; the rating area is simply omitted/blank | `hasReviews`/`reviewSummary.hasReviews` is `false` when `reviewCount` is 0 (derived, never guessed) | EC-4 |
| AC-6 | A camp's `Location.province` is null in the DB | Camper searches and that camp matches | The camp still appears in the assistant's results (with no province line), never silently missing | `toAiCampCard` coerces the null to `''`; the card is kept, not dropped by the wire-shape guard | EC-5 |
| AC-7 | A camp has no altitude/distance/weather columns (they don't exist in the schema) | Camper asks the assistant anything that would need them | Assistant never states a fabricated altitude, distance, or weather value | These fields are not present anywhere in the wire contract (G1/G2 — explicitly out of scope, no schema to back them) | — (nothing to compute; the omission itself is the correct behavior) |

## Rules
- BR-1 `aiCampCardSelect` (`lib/read-models/ai-camp-card.ts`) extends `campCardSelect` by spreading it — never mutates or forks the shared object; every other `campCardSelect` consumer (`getDefaultCatalog`, the public catalog grid) is byte-unchanged.
- BR-2 "First tag" = the camp's single MasterData row in the `Terrain` group (`options: {where:{group:'Terrain'}, take:1, orderBy:{code:'asc'}}`) — deterministic, bounded to 1 row, never an unbounded taxonomy dump.
- BR-3 `getRemainingCapacityForCamps(campIds, start, end)` is the ONLY way a page of cards gets live availability — exactly 5 batched Prisma calls for the WHOLE page (never one `getRemainingCapacity` call per card). Shares its query/accumulation core with `getAvailabilityStatusForCamps` (`computeBatchedNightlyOccupancy`) so the two can never disagree on what a night looked like.
- BR-4 `remaining` semantics: `null` = capacity unbounded or no date range requested (never rendered as a number); `0` or `blockedByHost` = full; a positive integer = the real remaining count.
- BR-5 `getCampDetail`'s `availableWeekendDates` = the next 8 upcoming Saturday check-in nights (🟡 default, no exact count/definition pinned by the design spec — confirm with product if a different count/weekend definition is needed) that are neither host-blocked nor numerically full, computed from ONE `getCampSiteDailyAvailability` call + ONE `getEffectiveCapacity` call (never one call per Saturday).
- BR-6 `getCampDetail`'s `reviews[]` is scoped `verified:true, deletedAt:null`, capped at 10, newest first; `reviewSummary.count` reflects the FULL non-deleted `reviewCount` aggregate (can exceed `reviews.length`).
- BR-7 `hasReviews` (card + detail) = `reviewCount > 0`, derived via the existing `buildReviewSummary` (`lib/review-summary.ts`) — never re-implemented inline.
- BR-8 A null `Location.province` is coerced to `''` inside `toAiCampCard` (the same convention `app/wishlist/page.tsx` already uses) — the wire type `AiChatCardResponse.location.province` stays a required `string` (no breaking change to existing `AiChatCampCard`/`CampgroundCardData` consumers).
- BR-9 `options`/`hasReviews`/`remaining` are additive, optional fields on `AiChatCardResponse` (api.md rule 12) — an older/unaware body simply lacks the keys; `isAiChatCardResponse` accepts absence and validates shape when present.

## Edge cases
- EC-1 IF a camp has no Terrain-group MasterData row THEN `options` is an empty array (BR-2) — no tag shown, never fabricated.
- EC-2 IF `startDate`/`endDate` is unparseable, inverted, only one is given, or the range exceeds `MAX_STATUS_RANGE_NIGHTS` THEN every card's `remaining` stays `null` and the search itself still succeeds (fail-open, BR-4).
- EC-3 IF `getCampDetail`'s `campSiteId` does not match a published/active/non-deleted camp THEN `{ok:false, code:'not_found'}` — no partial data leaked.
- EC-4 IF `reviewCount` is 0 with a stale non-null `avgRating` column THEN `hasReviews` is still `false` (count is canonical, BR-7).
- EC-5 IF `location` itself is missing on a row (defensive) THEN `toAiCampCard` still returns `province: ''`, never throws.

## Data
No schema change. Reads only: `CampSite.priceLow/avgRating/reviewCount`, `Location.province` (nullable, already existed), `MasterData` via the `options` relation (`Terrain` group for the card; full relation for the detail read), `Review` (`verified`, `deletedAt`), `Booking`/`BlockedDate`/`InternalHold` (existing availability predicates). Migration: none.

## Seams & refs
- Reuse: `lib/read-models/camp-card.ts` `campCardSelect` (extended, not forked) · `lib/campsite-availability.ts` `computeBatchedNightlyOccupancy`/`getCampSiteDailyAvailability`/`getEffectiveCapacity` (shared core, no parallel query) · `lib/review-summary.ts` `buildReviewSummary`/`toReviewListItem` (canonical hasReviews/DTO, not re-derived) · Refs: ADR-009 (no-forked-data-path), CAM-344/CAM-355 (batched availability), CAM-272 (card wire contract), CAM-426 design.md (G1-G8 real-data-gap enumeration, sibling story).
- Reader/writer sweep (architecture.md 15b, since `getAvailabilityStatusForCamps`'s internals moved): every existing reader of that function (`components/CatalogResults.tsx`, `app/api/campsites/route.ts`) — NO-CHANGE (function signature/behavior byte-identical, proven by the full pre-existing cam-344/cam-355/cam-267/cam-302/cam-303/cam-400/cam-401 suites passing unmodified). New reader `getRemainingCapacityForCamps` — NOW, this story, only consumed by `searchCampsites`.

## Out of scope
- Rendering the floating detail card UI, amenities badges, review list UI, weekend-date picker chips → CAM-426 Expression Layer (frontend) follow-up.
- Altitude/distance/weather (G1/G2) → no schema exists; would need a new ADR + migration, a separate future ticket if ever prioritized.
- `getCampDetail` being invoked automatically by the model on every card tap (that's an Expression Layer / prompt-design concern, not this story's).

## Self-verify
- AC-1..AC-3 → unit (`__tests__/cam-427-ai-camp-card.test.ts`, `__tests__/cam-427-search-campsites-availability.test.ts`, `__tests__/cam-427-remaining-capacity-batched.test.ts`)
- AC-4..AC-5 → unit (`__tests__/cam-427-get-camp-detail.test.ts`)
- AC-6 → unit (`__tests__/cam-427-ai-camp-card.test.ts`, `__tests__/cam-427-api-client-card-fields.test.ts`)
- AC-7 → source-inspection (no altitude/distance/weather field anywhere in the new types)
- Story-specific: batched-not-per-card query-count assertions (BR-3/BR-5) · shared `campCardSelect` unchanged (grep-diff) · full pre-existing availability suite (255 tests) green unmodified
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-19) — created
