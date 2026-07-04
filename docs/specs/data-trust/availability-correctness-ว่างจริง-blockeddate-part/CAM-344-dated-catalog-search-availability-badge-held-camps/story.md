---
linear: CAM-344
feature: data-trust
epic: availability-correctness-ว่างจริง-blockeddate-part (CAM-22)
persona: camper
artifact: story
class: full
owner: product-owner
status: In Progress
version: v2
updated: 2026-07-04
---
# Dated catalog search shows availability badge on held camps (fully vs partially unavailable) (CAM-344)

## Story
As a **Camper**, I want a dated catalog search to keep showing camps that are unavailable for my chosen dates, each clearly marked as fully or partially unavailable, so that I can see every camp that matches my other criteria (location, price, activities) and decide whether to adjust my dates, instead of the camp silently vanishing from the results with no explanation.
Why: this reverses an earlier "hide unavailable camps" decision (owner, 2026-07-04, FINAL) — hiding made camps disappear with no signal and destroyed the "partly available, shift your dates" case. The pivot from hide→badge also fixes a data-correctness bug by construction: today's dated filter (`buildCampSiteWhere` step 7) excludes camps only by overlapping Booking + whole-camp BlockedDate and is blind to `InternalHold` (CAM-302) — removing that filter and computing the badge from the single availability source counts holds like every other consumer.
Scope: the dated catalog search RESULTS LIST only (the homepage/catalog grid — first SSR page and infinite-scroll cursor pages). The badge is driven purely by the presence of a per-camp availability status that only the dated search path computes.
Depends on: CAM-302 (InternalHold, shipped) · CAM-303 (single-source availability math + block-always-wins BR-1) · reuses `lib/campsite-availability.ts` · ADR-009 (no forked data path) · ADR-012 §4.

## AC
<!-- Then = user-visible (screen text = verbatim Thai) · System effect = data outcome, plain language · Neg/edge = failure twin (EC-n/AC-n); — needs a reason. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camp matches the non-date filters but every night in the selected date range is full or host-blocked | The camper opens the catalog with a check-in and check-out date selected | The camp still appears in the results, marked `ไม่ว่างในช่วงที่เลือก` | The search returns the camp (no longer filtered out) and marks it fully unavailable for the range | EC-3 |
| AC-2 | A camp has room on some nights of the selected range but is at capacity on at least one night | The camper opens the catalog with dates selected | The camp appears marked `ว่างบางวันในช่วงที่เลือก` | The search marks the camp partially unavailable for the range | EC-2 |
| AC-3 | A camp has room for the party on every night of the selected range | The camper opens the catalog with dates selected | The camp appears with no availability marking (the card looks the same as an undated result) | The search marks the camp fully available; no availability badge is attached | EC-9 |
| AC-4 | The camper has not selected any dates | The camper opens the catalog | No card shows any availability marking (behaviour is exactly as it is today) | No availability status is computed for any camp | EC-5 |
| AC-5 | A camp's remaining room for the selected nights is entirely taken by an active negotiation hold, with no confirmed or pending booking | The camper opens the catalog with dates selected | The camp appears marked `ไม่ว่างในช่วงที่เลือก` (or `ว่างบางวันในช่วงที่เลือก` if only some nights are held) | The active hold is counted against capacity through the single availability source; previously the search ignored holds and showed the camp as bookable | EC-4 |
| AC-6 | A fully-unavailable camp is shown in dated results with its badge | The camper taps that camp card | The camp detail page opens, where its calendar shows exactly which nights are unavailable | Navigation is unchanged; the whole card stays a link and the badge does not block the tap | — (existing card-link behaviour; failure twin is a generic navigation regression, not availability-specific) |
| AC-7 | A camp has a whole-camp host block covering the entire selected range | The camper opens the catalog with dates selected | The camp appears marked `ไม่ว่างในช่วงที่เลือก` | A whole-camp block forces "fully unavailable" regardless of the numeric capacity left (a block always wins, per CAM-303 BR-1) | EC-3 |
| AC-8 | Every camp matching the non-date filters is fully unavailable for the selected range | The camper opens the catalog with dates selected | All the camps appear, each marked `ไม่ว่างในช่วงที่เลือก`; the "no results" empty state is NOT shown | Results are badged, never filtered down to an empty list by availability | EC-7 |
| AC-9 | The availability computation for the result page fails or times out | The camper opens the catalog with dates selected | The cards render normally with no availability marking (the list is never blocked, blanked, or emptied by an availability error) | The badge is omitted (fail-open); the result list is still returned | EC-8 |

## Rules
- BR-1 The availability status is computed ONLY from `lib/campsite-availability.ts` — reusing the exact single-source predicates: Booking with status in (`CONFIRMED`,`PENDING`) overlapping the range, whole-camp `BlockedDate` (`spotId` null, `deletedAt` null) overlapping the range, and `InternalHold` with `status = ACTIVE` and `expiresAt > now` overlapping the range; nights only, with the check-out day excluded (same night-exclusive shape the booking write path uses). No parallel availability math anywhere (ADR-009 / feature No-go "no forked data path"). (proves AC-1, AC-2, AC-5, AC-7)
- BR-2 A night counts as "unavailable for the party" when the camp is host-blocked that night OR `capacity` is a number AND `bookedGuests + heldGuests + requestedGuests > capacity`. `requestedGuests` = the search `guests` param, defaulting to `1` when absent. `capacity = null` (unbounded — no explicit `maxGuestsPerDay`) is never numerically unavailable; only a whole-camp block can make an unbounded camp unavailable. (proves AC-2, AC-3, AC-5, AC-9)
- BR-3 Classification over the nights of the range: zero unavailable nights → **fully available** (no badge); at least one but not all unavailable nights → **partially unavailable** (`ว่างบางวันในช่วงที่เลือก`); all nights unavailable → **fully unavailable** (`ไม่ว่างในช่วงที่เลือก`). A single-night range can only be fully available or fully unavailable, never partial. (proves AC-1, AC-2, AC-3, AC-8)
- BR-4 Badge copy is verbatim and plain-language (no jargon, no em-dash): fully unavailable = `ไม่ว่างในช่วงที่เลือก`; partially unavailable = `ว่างบางวันในช่วงที่เลือก`; fully available = no badge rendered. Copy lives in `locales/` (TH/EN), never hardcoded. (proves AC-1, AC-2, AC-3)
- BR-5 Performance — batched, never per-camp. The status for a page of camps (≤ the catalog page size) is computed with a bounded number of grouped queries over the page's camp ids (one Booking query, one BlockedDate query, one InternalHold query, each `WHERE campSiteId IN [page ids]`), reusing the single-source predicates and then classified in memory. It MUST NOT call `getCampSiteDailyAvailability`/`getRemainingCapacity` once per camp (that is N round-trips per page and blows the API p95 < 200ms budget). Target: API p95 < 200ms; actual latency not measured (no staging data yet) — the batched shape keeps it O(1) extra queries per page instead of O(N). (perf)
- BR-6 Dated search no longer excludes any camp by date-availability: `buildCampSiteWhere` step 7 (the Booking-overlap + whole-camp-BlockedDate exclusion) is removed. All non-date filters stay unchanged — including the static guest-capacity filter (step 5, `maxGuestsPerDay >= guests OR null`), which is a structural capacity gate independent of dates, not a date-availability filter. (proves AC-1, AC-8)
- BR-7 No date filter (missing check-in OR check-out) → no availability status is computed and no badge is attached, on the first SSR page and on every cursor page. Behaviour is byte-identical to today's undated catalog. (proves AC-4)
- BR-8 The badge folds holds and blocks into ONE aggregate "unavailable" signal and never labels a camp "held" / "on hold" / names the reason — the camper sees only "unavailable" or "partly available", honouring the feature No-go "no public/guest-facing hold surfaces" (a hold's existence is never disclosed, only its effect on availability). (proves AC-5)
- BR-9 [ASSUMED DEFAULT — owner may veto at G1] Sort order is unchanged: badged (unavailable / partial) camps keep their position in the active sort (related / price / rating); results are NOT re-ranked to sink unavailable camps below available ones. Rationale: the catalog uses keyset-cursor pagination whose cursor encodes the sort keys (createdAt / priceLow / avgRating); re-ranking by availability would force a dynamic, time-sensitive value into the keyset cursor and make pagination unstable. The badge carries the availability signal without touching sort. (default for AC-1, AC-2, AC-8)
- BR-10 The whole result card stays a single link to the camp detail page; the badge is presentational and never intercepts the tap (existing behaviour preserved). (proves AC-6)

## Edge cases
<!-- cover: invalid · empty/zero · concurrent/duplicate · permission · boundary. -->
- EC-1 IF the selected range spans two calendar months (e.g. 30 Jul → 2 Aug) THEN the status is computed across the full continuous range in one batched pass, never split or truncated at the month boundary (BR-1, BR-5)
- EC-2 IF the selected range is a single night (check-out = check-in + 1) THEN exactly one night is classified and the camp is only ever fully available or fully unavailable — the partial state is impossible for a one-night range (BR-3)
- EC-3 IF a whole-camp host block covers the entire selected range THEN the camp is fully unavailable (`ไม่ว่างในช่วงที่เลือก`), regardless of any numeric capacity left — a block always wins over the numeric subtraction (CAM-303 BR-1) (BR-1, BR-2)
- EC-4 IF a camp's remaining room for the nights is consumed by an ACTIVE non-expired hold THEN it counts as unavailable; IF the only overlapping hold has already expired (`expiresAt <= now`) THEN it does NOT count (lazy read-time expiry, no cron) and the night stays available (BR-1)
- EC-5 IF the camper has selected no dates (undated search) THEN no availability status is computed and no card shows a badge (BR-7)
- EC-6 IF the date range has zero nights or is inverted (check-out ≤ check-in) THEN it is treated as no valid dated-availability window: no badge is computed (mirrors the same-day guard in `getRemainingCapacity`); the existing query-boundary validation still governs whether such a range is accepted at all (BR-7)
- EC-7 IF every camp matching the non-date filters is fully unavailable for the range THEN all of them are shown, each badged, and the "no results" empty state is NOT rendered — the empty state appears only when zero camps match the NON-date filters (BR-3, BR-6)
- EC-8 IF the batched availability computation throws or times out THEN each card renders with no badge (fail-open) and the result list is still returned in full — an availability error never blanks, blocks, or empties the catalog (BR-5)
- EC-9 IF a camp has unbounded capacity (`maxGuestsPerDay` = null) and no host block THEN it is never numerically unavailable (fully available, no badge); IF `maxGuestsPerDay` is an explicit `0` THEN every night is unavailable → fully-unavailable badge (BR-2)

## Data
- Read-only. No schema change, no migration. The per-camp availability status is a COMPUTED, non-persisted value (compute-on-the-fly per architecture §12 / ADR-009) attached to each result item on the catalog search response — on the first SSR page (`CatalogResults`) AND on the `/api/campsites` cursor-page response — and added as one explicit optional field on the `CampSiteCardData` type. It is NOT a Prisma column and will NOT ride through `campCardSelect`/`CampSiteCardData` automatically (CAM-342 trap): it must be attached explicitly in both surfaces and declared explicitly on the type.
- 🟡 ASSUMED (architect to confirm at G2): the status is a small enum with three states — fully-available (no badge) / partially-unavailable / fully-unavailable. Exact enum literal + response field name + where `maxGuestsPerDay` is read (added to `campCardSelect`, or a small side `select` over the page ids) are architect/backend contract details, not fixed here.
- migration: none.

## Seams & refs
- Reuse: `lib/campsite-availability.ts` — the new batched status helper MUST derive from the same predicates as `getCampSiteDailyAvailability` / `getActiveHoldsForRange` / `getBlockedDatesForRange` (Booking `CONFIRMED`/`PENDING` overlap · `BlockedDate` `spotId` null overlap · `InternalHold` `ACTIVE` + `expiresAt > now` overlap · night-exclusive checkout). No parallel math (ADR-009, feature No-go).
- `lib/campsite-filters.ts` step 7 — the date-availability exclusion to REMOVE (the hide→badge pivot; removing it also deletes the Booking-only, InternalHold-blind exclusion, fixing the blindness by construction). Keep step 5 (static guest-capacity) and all other steps.
- Two attach points (CAM-342 field-enumeration trap — the field will not ride through either): `components/CatalogResults.tsx` (first SSR page) AND `app/api/campsites/route.ts` GET (cursor pages). Both build results via `buildCampSiteWhere` + `campCardSelect`; both must attach the status when dates are present. `app/actions/getCampSiteCount.ts` / `getCampgroundCount.ts` also call `buildCampSiteWhere` — removing step 7 changes their count to include unavailable camps (consistent with "show all"); verify no consumer relies on the old availability-filtered count.
- `components/CampgroundCard.tsx` — reuse the existing `components/ui/badge.tsx` Badge primitive (the card already uses `variant="overlay"` for the "New" badge as precedent). Exact variant + placement (overlay on image vs. inline under the name) is a Designer G2 decision; semantic intent: fully-unavailable = neutral/negative, partially-unavailable = caution. Badge renders IFF the availability status field is present, so wishlist/similar-camp reuses of this card (no date context) never show it.
- `components/InfiniteScrollGrid.tsx` / `components/CampgroundGrid.tsx` (`CampSiteCardData`) — the serialized item type gains the explicit optional status field; the client passes it to `CampgroundCard`.
- `locales/translations.ts` — 2 new i18n keys for the badge copy (TH verbatim above; EN parity).
- Refs: ADR-012 §4 (InternalHold, lazy expiry) · ADR-006 (serializable inventory lock) · ADR-009 (no forked/duplicated data path) · CAM-302 (holds folded into availability) · CAM-303 (single-source math, block-always-wins BR-1).

## Out of scope
- Map view of search results — `components/MapComponent.tsx` is the camp-detail location map (used by `CampgroundDetailClient`), not a dated-search results surface; no map-list surface renders these cards → no follow-up needed (different surface).
- Wishlist / "similar camps" card surfaces showing the badge — those have no date context and never populate the status field → not applicable.
- Camp detail page availability display — already has its own calendar; unchanged.
- A numeric "X spots left" count on the card — the badge is a binary two-level signal only → follow-up if the owner later wants numbers.
- Per-spot (spot-level) availability nuance on the card — camp-level aggregate only, matching the single-source camp-level semantics.
- Re-ranking / sorting results by availability — deferred; if the owner vetoes BR-9's "keep sort order" default at G1, that becomes its own follow-up (it is a keyset-cursor contract change).
- Removing dead/superseded availability code paths noticed while building → CAM-345.

## Self-verify
- AC-1, AC-2, AC-3, AC-7, AC-8 → unit on the batched status helper (fixtures: all-nights-full · some-nights-full · all-nights-open · whole-range block · all-camps-full) asserting the three-state classification + that no camp is filtered out.
- AC-4, AC-5 → unit (undated → no status computed; active hold consumes capacity → unavailable; expired hold → still available, EC-4) + integration asserting `/api/campsites` and the SSR path attach the status only when dates are present.
- AC-6 → owner-verify (browser-only) on the real Staging URL: a badged card still navigates to detail.
- AC-9 / EC-8 → unit (availability helper throws → cards returned with no badge, list not emptied).
- Story-specific: assert step-7 removal does NOT hide camps (a camp with an overlapping booking now appears) · assert BOTH surfaces (SSR first page + cursor page) carry the field (CAM-342 trap) · assert the count actions still return sane numbers after step-7 removal · Thai copy asserted char-for-char (`ไม่ว่างในช่วงที่เลือก`, `ว่างบางวันในช่วงที่เลือก`).
- Gate = /quality-gate · Done = every AC verified on the real Staging URL (badge visible on a dated search, absent on undated).

## Changelog
- v1 (legacy stub) — original scope: `buildCampSiteWhere` step 7 EXCLUDES (hides) camps with a date-overlapping booking or whole-camp block from dated search; the gap noted was that the exclusion is blind to `InternalHold`. Superseded.
- v2 (2026-07-04) — SUPERSEDED the hide behaviour per the owner's FINAL decision (2026-07-04): dated search must SHOW unavailable camps with a two-level availability badge (fully vs partially unavailable), never hide them. Removes step 7's date-availability exclusion (which also fixes the InternalHold blindness by construction) and computes the badge from the single availability source (`lib/campsite-availability.ts`). Product decisions made here (owner-delegated): badge copy `ไม่ว่างในช่วงที่เลือก` / `ว่างบางวันในช่วงที่เลือก` (BR-4); requested-guests threshold defaulting to 1 (BR-2); keep-sort-order default, owner may veto (BR-9); folds holds without disclosing them, honouring the No-go (BR-8).
</content>
