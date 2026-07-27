## Story
As a **Camper**, I want every camp's map pin to sit inside the province its listing claims, and every camp to carry a real accommodation type, so that the location I see matches where the pin lands and no camp is invisible to a type filter.
Why: two owner-requested data corrections (2026-07-27). (1) 103 camps on staging (83 on dev) geocode to a province ADJACENT to the one stored against them — CAM-562 already found and reported these (`provinceMismatch`) but, per its own BR-8, never wrote to them; the owner now asks for the coordinate to move to agree with the stored province. (2) 12 camps on staging (10 on dev) have an empty `accommodationTypes` — the ones whose only value was the retired horse-camp code CAM-538 correctly dropped, leaving the column empty rather than guessing a replacement.
Scope: (1) reuse CAM-562's `provinceMismatch` classification to identify candidates; for each, forward-geocode the CLAIMED province (+district where known) into a point, verify by reverse-geocoding the new point back into that SAME claimed province before writing anything, re-derive district/subDistrict from the same verification call, and keep `CampSite.latitude/longitude` in sync with `Location.lat/lon` — never rewrite `Location.province`. (2) for every camp with `accommodationTypes === ''`, verify its Thai name + Terrain tags both agree it describes an open field, and only then assign `DISP`; a candidate that does not fit both signals is left untouched and reported. Both corrections: dry-run first, idempotent on a second run, explicit opt-in env guard + non-prod refusal, and applied to BOTH the dev and staging databases with counts queried independently from each. Does not touch `prisma/schema.prisma`/`migrations/**`, `components/**`, `app/**`, or `lib/campsite-filters.ts` (all out of this story's file surface — no schema change is needed for either correction).
Depends on: CAM-562 (province-mismatch classification + geocode cache, reused) · CAM-571 (forward-geocode + verify-and-resolve-placement primitives, reused directly) · CAM-563 (`matchAdminAreaByName`, reused) · CAM-538 (dropped `HCMP`, the origin of the type-less rows) · CAM-566 (the shared AdminArea matcher `lib/geo/admin-area-match.ts`, read-only — not forked)

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | CAM-562's own `provinceMismatch` classification names a `Location` row whose geocoded province disagrees with its stored, adjacent, Thai province | The alignment script runs (dry or real) | No user-visible change (a data migration) | The row is identified as a candidate, reusing CAM-562's classification with zero new logic; `identificationCallsMade`/`identificationCallsCached` are both reported | EC-1 |
| AC-2 | A candidate has been identified | The script runs with `DRY_RUN=1` | No user-visible change (dry-run reports only) | A fresh reverse-check of the CURRENT coordinates, a forward-geocode of the claimed province, and a reverse-geocode of the new point are all computed and reported — **zero** `prisma.location.update`/`prisma.campSite.update` calls execute | EC-2 |
| AC-3 | The dry-run projection has been reviewed | The script runs for real (`DRY_RUN` unset) | No user-visible change (the camp's map pin now sits inside its claimed province going forward) | Each verified candidate's `Location.lat`/`lon` AND its linked `CampSite.latitude`/`longitude` are updated together to the SAME new point, in one transaction; `adminAreaId`/`district`/`subDistrict` are re-derived; `Location.province` is never modified | EC-3 |
| AC-4 | A forward-geocoded point does not reverse-geocode back into the row's claimed province (or the forward/reverse call fails) | The real run processes that candidate | No user-visible change | The candidate is recorded as unverified/failed and **none** of its fields are written | EC-4 |
| AC-5 | A candidate's CURRENT coordinates already reverse-geocode into its claimed province (already moved by a prior run, or corrected by anything else) | The script runs (dry or real) | No user-visible change | The candidate is skipped (recorded as already-matching) — **zero** writes for it | EC-5 |
| AC-6 | The real alignment run has completed once | The script runs a second time (same DB) | No user-visible change | **Zero** rows are updated | EC-5 |
| AC-7 | A `CampSite.accommodationTypes` is empty (`''`) | The accommodation-type script runs (dry or real) | No user-visible change (a data migration) | The camp's Thai name + its Terrain MasterData tags are both checked against the open-field pattern | EC-6 |
| AC-8 | A type-less camp's name AND terrain both fit the open-field pattern | The real run processes that candidate | No user-visible change (the camp is now findable under `กางเต็นท์อิสระ (ไม่แบ่งล็อค)`) | `CampSite.accommodationTypes` is set to `DISP` | EC-7 |
| AC-9 | A type-less camp's name or terrain does NOT both fit the open-field pattern | The real run processes that candidate | No user-visible change | The row is left untouched and recorded in `exceptions` with a reason — never force-assigned | EC-7 |
| AC-10 | Either backfill has completed (dev or staging) | A camper filters the camp catalog by province "Chiang Mai" | Results are unchanged from before the backfill (same non-zero count) | `prisma.campSite.count({where:{location:{province:'Chiang Mai'}}})` returns the same number before and after, queried directly, on BOTH databases | EC-8 |

## Rules
- BR-1 Province-alignment candidates are exactly CAM-562's own `provinceMismatch` list (`runBackfill` dry-run, reused unmodified) — no new classification logic (proves AC-1).
- BR-2 A placement is written ONLY after its forward-geocoded point is reverse-geocoded back and confirmed to resolve to the SAME province node already stored on the row — an unverifiable placement is refused, never written as a guess (proves AC-4; reuses CAM-571's `verifyAndResolvePlacement` verbatim).
- BR-3 `Location.lat`/`lon` and the linked `CampSite.latitude`/`longitude` are written together, in one `$transaction`, for every moved row (CAM-575's sync invariant).
- BR-4 `Location.province` is never written by the alignment script under any circumstance.
- BR-5 Before moving any candidate, its CURRENT coordinates are freshly (not cache-)re-checked; a candidate that already matches its claimed province is skipped, never re-processed — the idempotency guard and the host-edit safety net (proves AC-5/AC-6).
- BR-6 The accommodation-type assignment requires BOTH the camp's Thai name to carry an open-field keyword (`ทุ่ง`/`เนิน`) AND at least one of its Terrain MasterData tags to be open-ground-consistent (`FARM`/`FILD`/`FORE`/`MTNS`) — either signal alone is refused, never a guess (proves AC-8/AC-9; guards the CAM-501/503 Thai-substring-collision lesson).
- BR-7 `DISP` is assigned, never `TSIT` — `TSIT` asserts a marked pitch, which nothing in these camps' data supports.
- BR-8 Both backfills reuse CAM-562's geocode cache where one already exists (dev); where none exists (staging), the one-time identification cost is spent once and cached to a separate file so no run re-bills it.
- BR-9 Both backfills refuse to run without their own explicit opt-in env flag, and refuse a production-looking `DATABASE_URL`.

## Edge cases
- EC-1 IF a `Location.id` was never scanned by CAM-562 (absent from its candidate set — e.g. no coordinates) THEN it is never a province-alignment candidate (BR-1)
- EC-2 IF `DRY_RUN=1` THEN no `prisma.location.update`/`prisma.campSite.update` call executes for any row, regardless of outcome (BR-2)
- EC-3 IF a candidate verifies THEN `Location.lat/lon` and every linked `CampSite.latitude/longitude` are updated in the SAME transaction (BR-3)
- EC-4 IF the forward-geocoded point's reverse-geocode does not match the row's claimed province THEN the row is recorded as unverified and none of its fields are written (BR-2)
- EC-5 IF a candidate's CURRENT coordinates already reverse-geocode into its claimed province THEN it is skipped — recorded as already-matching, zero writes (BR-5)
- EC-6 IF `CampSite.accommodationTypes` is already non-empty THEN the row is never a type-assignment candidate (idempotency by construction)
- EC-7 IF a type-less camp's name or terrain does not both fit the open-field pattern THEN it is left untouched and reported as an exception with a reason (BR-6)
- EC-8 IF the province filter's count differs before vs. after either real run, on either database THEN the run reports a regression (never silently ships one) (BR-4)

## Data
- `Location.lat`/`Location.lon` (existing nullable Float) — corrected for the province-mismatch candidates only (83 dev / 103 staging); unrelated rows untouched.
- `Location.adminAreaId`/`district`/`subDistrict` (existing nullable) — re-derived for moved rows only, from the verification reverse-geocode.
- `CampSite.latitude`/`CampSite.longitude` (existing non-null Float) — kept in sync for moved rows' linked camp(s) (CAM-575's trigger + this script's explicit write).
- `Location.province` — read only, never written by either script.
- `CampSite.accommodationTypes` (existing non-null String, CSV-shaped but single-value in practice per `lib/validations/campsite.ts`) — set to `DISP` for verified type-less candidates only (10 dev / 12 staging).
- No new column, no schema change, no migration (confirmed: this story's allowed surface excludes `prisma/schema.prisma`/`prisma/migrations/**`).

## Seams & refs
- Reuse: `scripts/backfill-cam-562-subdistrict-geocode.mjs`'s `runBackfill` (province-mismatch classification, dry-run only) + `callGoogleGeocode` (reverse) + `extractComponent` · `scripts/backfill-cam-563-location-admin-area.mjs`'s `matchAdminAreaByName` · `scripts/backfill-cam-571-coordinates-inside-thailand.mjs`'s `callGoogleGeocodeForward` + `buildForwardAddress` + `getProvinceAncestor` + `verifyAndResolvePlacement` (imported directly, not forked — CAM-571's own `planMoves`/tests are untouched). `lib/geo/admin-area-match.ts` (CAM-566) is read-only context (the matcher it wraps), not imported directly by these plain `.mjs` scripts (CAM-563's own re-exported wrapper is the actual import point, unchanged).
- Reader/writer sweep (architecture.md §15b) — no new readers/writers beyond what CAM-571 already inventoried for `Location.lat/lon` vs `CampSite.latitude/longitude`; this story writes through the SAME two columns via the SAME sync pattern, so no new consumer is affected. `CampSite.accommodationTypes` readers (`components/CampgroundCard.tsx`, filter/search paths) are unaffected in shape — this story only fills a previously-empty value into the SAME existing column, per the SAME existing contract (`lib/validations/campsite.ts::AccommodationTypeEnum`).

## Out of scope
- Any province-mismatch case CAM-562 already reported that is NOT inside `provinceMismatch` (e.g. the 18 already handled by CAM-571, or the unresolved/no-component cases) — untouched by this story.
- Running CAM-562's own full district/subDistrict backfill against staging — this story's staging identification pass is dry-run only (never toggled to write) and used purely to read `provinceMismatch`; a full staging CAM-562 write-run is a separate, not-yet-scoped story.
- A schema-level flag distinguishing seed vs. host-entered data — out of this story's file surface; BR-5's fresh-re-check mechanism is this story's (and CAM-571's) answer without one.

## Self-verify
- AC-1/AC-6 → unit (`__tests__/cam-583-align-provinces.test.ts`, fake-Prisma + mocked Google fetch) + real dry-run/run against dev + staging
- AC-7/AC-9 → unit (`__tests__/cam-583-assign-accommodation-type.test.ts`) + real query of every candidate's name+terrain on both databases
- AC-10 → real count query against BOTH databases (`prisma.campSite.count` for `location.province = 'Chiang Mai'`) before and after each backfill
- Story-specific: no ownership check (data-migration scripts, not authz'd endpoints) · idempotency (AC-6, EC-6) · every disallowed transition (province never rewritten, TSIT never assigned, EC-4/EC-7)
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-27) — created
- v2 (2026-07-27) — real dry-run + real run completed on dev AND staging, all counts independently verified (see tech.md); a host-entered-data-safety bug in the province-alignment identification step was found and fixed before shipping (tech.md "Candidate identification" section)
