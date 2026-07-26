## Story
As a **Camper**, I want every camp's map pin to actually sit inside Thailand, so that a pin I open never lands in another country.
Why: the owner asked directly (2026-07-26): bring every camp's coordinates inside Thailand. CAM-562's real reverse-geocode run measured that of 650 camps, 18 (not the ~16 first estimated) fail because Google places their coordinates in Laos, Myanmar, or Malaysia — real geography, not a bounding-box artifact (a rectangle drawn around Thailand also covers slivers of those countries; only a real reverse-geocode reveals it). A further 83 geocode to a province ADJACENT to the one stored against them, which is inside Thailand and out of this story's corrective scope.
Scope: identify the affected `Location` rows by their CAM-562-cached geocoded country (never a bounding box); for each, forward-geocode its already-claimed `province` (+`district` where known — none of the 18 have one) into a real point (CAM-554's forward-geocode algorithm, reused as a small necessary duplicate); verify the new point by reverse-geocoding it back into the claimed province before writing anything; re-derive `district`/`subDistrict` from that same verification call; keep `CampSite.latitude/longitude` in sync with `Location.lat/lon` (found during this story's own reader/writer sweep — a separate column every camper-facing reader actually uses). Report, never rewrite, the 83 adjacent-province cases with a centroid-distance estimate. Dry-run first, idempotent, guarded the same shape as CAM-562/563. Does not touch `prisma/schema.prisma`/`migrations/**`, `components/**`, `app/api/**`, or `lib/campsite-filters.ts` (all out of this story's file surface).
Depends on: CAM-562 (the reverse-geocode cache this story reuses to identify candidates, zero fresh calls) · CAM-554 (the forward-geocode algorithm, reused) · CAM-563 (`Location.adminAreaId` populated at PROVINCE level — the trusted anchor this story verifies a new placement against)

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | CAM-562's frozen geocode cache holds a reverse-geocode result per `Location.id`, including a `country` component | The backfill script scans that cache (no new Google calls) | No user-visible change (a data migration) | Every `Location.id` whose cached country is not Thailand is identified and counted (18, verified — not assumed from the ~16 estimate); a row whose cached country IS Thailand, or whose result is zero-results/failed, is never flagged | EC-1 |
| AC-2 | 18 candidates identified | The script runs with `DRY_RUN=1` | No user-visible change (dry-run reports only) | For each candidate: a fresh reverse-check of its CURRENT coordinates, a forward-geocode of its claimed province, and a reverse-geocode of the new point are all computed and reported — **zero** `prisma.location.update`/`prisma.campSite.update` calls execute | EC-2 |
| AC-3 | The dry-run projection has been reviewed | The script runs for real (`DRY_RUN` unset) | No user-visible change (a data migration; the camp's map pin now sits inside Thailand going forward) | Each verified candidate's `Location.lat`/`lon` AND its linked `CampSite.latitude`/`longitude` are updated together to the SAME new point, in one transaction; `adminAreaId`/`district`/`subDistrict` are re-derived from the verification reverse-geocode; `Location.province` is never modified | EC-3 |
| AC-4 | A forward-geocoded point does not reverse-geocode back into the row's claimed province (or the forward/reverse call fails) | The real run processes that candidate | No user-visible change | The candidate is recorded as unverified/failed and **none** of its fields are written — never a guessed placement | EC-4 |
| AC-5 | A candidate's CURRENT coordinates already reverse-geocode to Thailand (already moved by a prior run, or corrected by anything else) | The script runs (dry or real) | No user-visible change | The candidate is skipped (recorded as already-inside-Thailand) — **zero** writes for it | EC-5 |
| AC-6 | The real run has completed once | The script runs a second time | No user-visible change | **Zero** rows are updated (every moved candidate's current coordinates now read Thailand on the fresh re-check) | EC-5 |
| AC-7 | CAM-562's own 83 province-mismatch rows (adjacent province, inside Thailand) | The script runs (dry or real) | No user-visible change | Each of the 83 is reported with a distance (km) from its claimed province's centroid and a recommendation; **none** of the 83 is written to, regardless of mode | EC-6 |
| AC-8 | A `Location.id` is absent from CAM-562's frozen cache (the structural stand-in for a row created/edited after that snapshot — e.g. a real host's entry) | The script runs (dry or real) | No user-visible change | That row is never a candidate and is never written, regardless of its current coordinates | EC-7 |
| AC-9 | The backfill has completed | A camper filters the camp catalog by province "Chiang Mai" | Results are unchanged from before the backfill (same non-zero count) | `prisma.campSite.count({where:{location:{province:'Chiang Mai'}}})` returns the same number before and after — verified by a real count query, not assumed | EC-8 |

## Rules
- BR-1 Identification is by the geocoded COUNTRY component (`address_components` type `country`), never a bounding box — a point can pass a Thailand bounding-box check and still not be in Thailand (proves AC-1).
- BR-2 The candidate set is restricted to `Location.id`s already present as keys in CAM-562's frozen cache file — a row absent from it (created/edited after that snapshot) is never a candidate, regardless of its current coordinates (proves AC-8, the host-entered-data safety rule).
- BR-3 A placement is written ONLY after its forward-geocoded point is reverse-geocoded back and confirmed to resolve to the SAME province node already stored on the row (`Location.adminAreaId`'s province ancestor) — an unverifiable placement is refused, never written as a guess (proves AC-4).
- BR-4 `district`/`subDistrict` are re-derived from the SAME reverse-geocode-of-the-new-point call (no extra Google call), written in whichever language the row's own `province` value is already stored in (Thai or English) — reuses CAM-562's own language rule.
- BR-5 `Location.lat`/`lon` and the linked `CampSite.latitude`/`longitude` are written together, in one `$transaction`, for every moved row — leaving only one in sync would leave the camper-visible pin unmoved (found via this story's own reader/writer sweep).
- BR-6 `Location.province` is never written by this script under any circumstance.
- BR-7 Before moving any candidate, its CURRENT coordinates are freshly (not cache-)re-checked; a candidate that already reads Thailand is skipped, never re-processed — this is both the idempotency guard and the safety net against touching a coordinate already corrected by anything else (proves AC-5/AC-6).
- BR-8 The 83 CAM-562 province-mismatch rows (adjacent province, inside Thailand) are reported with a centroid-distance estimate but never written by this script — the owner's instruction covers coordinates outside Thailand, not an adjacent-province disagreement (proves AC-7).
- BR-9 A mismatch case whose distance from its claimed province's centroid exceeds 100km is flagged as a likely outlier deserving the same treatment as the 18 — a report-time flag only, never an automatic write.

## Edge cases
- EC-1 IF a cached geocode result has no `country` component at all, or is zero-results/failed, THEN it is never flagged as outside Thailand (a different, out-of-scope failure mode CAM-562 already reports) (BR-1)
- EC-2 IF `DRY_RUN=1` THEN no `prisma.location.update`/`prisma.campSite.update` call executes for any row, regardless of outcome (BR-3)
- EC-3 IF a candidate verifies THEN `Location.lat/lon` and every linked `CampSite.latitude/longitude` are updated in the SAME transaction (BR-5)
- EC-4 IF the forward-geocoded point's reverse-geocode does not match the row's claimed province THEN the row is recorded as unverified and none of its fields are written (BR-3)
- EC-5 IF a candidate's CURRENT coordinates already reverse-geocode to Thailand THEN it is skipped — recorded as already-inside-Thailand, zero writes (BR-7)
- EC-6 IF a row is one of CAM-562's 83 province-mismatch rows THEN it is reported with a distance estimate and never written, in any mode (BR-8)
- EC-7 IF a `Location.id` is absent from CAM-562's frozen cache THEN it is never a candidate, regardless of its current coordinates (BR-2)
- EC-8 IF the province filter's count differs before vs. after the real run THEN the run reports a regression (never silently ships one) (BR-6)

## Data
- `Location.lat`/`Location.lon` (existing nullable Float) — corrected for the 18 outside-Thailand rows only; unrelated rows untouched.
- `Location.adminAreaId`/`district`/`subDistrict` (existing nullable) — re-derived for the 18 moved rows only, from the verification reverse-geocode.
- `CampSite.latitude`/`CampSite.longitude` (existing non-null Float, a separate column from `Location.lat/lon`) — kept in sync for the 18 moved rows' linked camp(s).
- `Location.province` — read only, never written by this script.
- No new column, no schema change, no migration (confirmed: this story's allowed surface excludes `prisma/schema.prisma`/`prisma/migrations/**`).

## Seams & refs
- Reuse: `scripts/backfill-cam-563-location-admin-area.mjs`'s `matchAdminAreaByName` (imported directly) · `scripts/backfill-cam-562-subdistrict-geocode.mjs`'s `callGoogleGeocode` (reverse mode, imported directly, reused for BOTH the fresh re-check and the new-point verification) + `extractComponent` + `runBackfill` (reused purely for its already-computed `provinceMismatch` list, for the 83-case report) · CAM-554's forward-geocode ADDRESS-STRING algorithm (`app/api/geocode/forward/route.ts`), reimplemented as a small, documented, necessary duplicate (`callGoogleGeocodeForward`) since no plain-JS twin exists and `app/api/**` is out of this story's file surface.
- Reader/writer sweep (architecture.md §15b — `Location.lat`/`.lon` vs `CampSite.latitude`/`.longitude`, search: `grep -rn "\.latitude\b|\.longitude\b" app/ lib/ components/ scripts/`):
  - `components/CampgroundDetailClient.tsx` ("Get directions" link + map pin) — **NOW (activates correctly)**: reads `CampSite.latitude/longitude`; this story writes both columns together so the visible pin actually moves.
  - `lib/ai/tools/get-camp-detail.ts` / `lib/ai/tools/compare-camps.ts` (`distanceFromBangkokKm`) — **NOW (activates correctly)**, same reason.
  - `app/wishlist/page.tsx` — **NOW (activates correctly)**, same reason.
  - `lib/campsite-filters.ts`'s `province` string/id OR-match — **VERIFIED, NO-CHANGE** (AC-9); this script never touches `Location.province` or moves a row to a different province's `adminAreaId`.
- `lib/geo/**` — read only (evaluated: `lib/geo/distance.ts`'s `haversineDistanceKm` is TS, this script is a plain `.mjs`, same cross-language constraint CAM-562/563 already recorded; also mid-restructure under CAM-566 at the time of writing) — a small, documented, necessary duplicate lives in this story's own script instead; no changes made to `lib/geo/**`.

## Out of scope
- Bulk-rewriting the 83 adjacent-province cases — reported only, with a recommendation; a follow-up ticket if the owner wants any of them corrected.
- `district` having no separate Thai column (CampgroundCard's known mixed-language display gap) — pre-existing, unrelated to this story.
- A schema-level flag distinguishing seed vs. host-entered data — out of this story's file surface (no `prisma/schema.prisma` change); the structural cache-membership + fresh-re-check mechanism (BR-2/BR-7) is this story's answer without one.

## Self-verify
- AC-1/AC-8 → unit (`__tests__/cam-571-coordinates-inside-thailand.test.ts`, fake-Prisma + mocked Google fetch) + real scan of CAM-562's cache against the dev DB (18 identified, cross-checked against CAM-562's own `province_unmatched` classification — exact id match)
- AC-2/AC-3/AC-4/AC-5/AC-6 → unit (dry-run zero-write, real-run write incl. CampSite sync, placement-mismatch refusal, forward-geocode-failure refusal, already-inside-Thailand skip, second-run idempotency) + real dry-run then real run against the dev DB
- AC-7 → unit (mismatch report + distance + farOutliers) + real report against the dev DB (83 cases, max distance measured)
- AC-9 → real count query against the dev DB (`prisma.campSite.count` for `location.province = 'Chiang Mai'`) before and after
- Story-specific: no ownership check (this is a data-migration script, not an authz'd endpoint) · idempotency (AC-6) · the CampSite/Location sync invariant (EC-3) · every disallowed transition (province never rewritten, EC-4/EC-6/EC-7)
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-26) — created
