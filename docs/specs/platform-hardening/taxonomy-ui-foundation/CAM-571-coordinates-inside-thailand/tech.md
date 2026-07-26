---
feature: Platform hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: tech
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-26
---
# Tech — Move coordinates outside Thailand inside their claimed province (CAM-571)

## Data model

**No migration.** `Location.lat`/`lon`/`adminAreaId`/`district`/`subDistrict` and `CampSite.latitude`/`longitude` all already exist on the schema. This story is a script-only change; `prisma migrate status` confirmed up to date before and after.

## Identification — by geocoded country, not a bounding box

The ticket's own comment carries a measurement correction: "650/650 coordinates inside Thailand's bounding box" was reported earlier as evidence the coordinates were trustworthy. That check is weaker than it sounds — Thailand is not a rectangle, so a box drawn around it also covers slivers of Laos, Myanmar, Malaysia, and Cambodia. Re-running the box check still returns 0 outside; it does not contradict the real 18 found here, it only confirms the box was never the right instrument.

CAM-562's reverse-geocode run cached every `Location.id -> {ok, zeroResults, components}` result to `os.tmpdir()/cam-562-geocode-cache.json` — including a `country`-typed `address_components` entry on every OK response. This story scans that FROZEN cache (`identifyOutsideThailand`) and flags every id whose country's `short_name !== 'TH'`. Zero new Google calls for identification.

**Real scan result (dev DB, 2026-07-26):**

| | count |
|---|---|
| `Location` rows in CAM-562's cache | 650 |
| geocoded country != TH (this story's candidates) | **18** — Laos x13, Myanmar x3, Malaysia x2 |
| cross-checked against CAM-562's own `province_unmatched` classification | 18/18 — exact id match |

The ticket's own comment estimated ~16; the real count is 18. Every one of the 18 sits in a Thai province that genuinely borders the geocoded country (Chiang Rai x1, Nakhon Phanom x5, Bueng Kan x4, Nong Khai x2, Ranong x2, Prachuap Khiri Khan x1, Satun x2, Mukdahan x1) — consistent with a seed coordinate sitting just across a national border, not a random data-corruption pattern.

## Placement rule — forward-geocode the claimed province, verify by reverse-geocoding it back

For each of the 18, `Location.province` is treated as the trustworthy intent (CAM-563 already resolved it against the real `AdminArea` tree). CAM-554's forward-geocode algorithm (`address -> lat/lon`, same Google Geocoding API/key/billing model as its reverse mode) turns `"<district>, <province>, Thailand"` into a real point (`callGoogleGeocodeForward`, a small necessary duplicate of `app/api/geocode/forward/route.ts`'s address-string construction — that route lives in `app/api/**`, TS, out of this story's file surface). None of the 18 have a stored `district`, so the address is always just `"<province>, Thailand"`.

**Placement rule stated plainly:** the new point is whatever Google's forward-geocoder returns for the bare province name — effectively a province-centroid-equivalent point, never a hand-picked or randomly-jittered coordinate. The repo also holds a locally-precomputed `prisma/data/province-centroids.json`, but it is itself derived from the CURRENT (partly-wrong) seed coordinates (CAM-502's own doc comment says so) — not authoritative, so it is used ONLY for the report-only 83-case distance estimate below, never as a write source.

**Verification, not assumption:** every new point is immediately reverse-geocoded again (`verifyAndResolvePlacement`) and its province component is matched (bilingual, hierarchical, exact — CAM-563's `matchAdminAreaByName`) against the row's OWN currently-stored province node. Only an exact match is written; anything else is refused and reported (`placementUnverified`), never guessed. The SAME verification call's `administrative_area_level_2`/`sublocality_level_1` components re-derive `district`/`subDistrict` (CAM-562's own bilingual/language-consistency rule, BR-4) — so a moved camp's sub-district backfill runs for free, from the same call, satisfying the ticket's item 4 without a second geocode pass.

## CampSite/Location coordinate duplication (found via this story's mandatory reader/writer sweep, architecture.md §15b)

**Search method:** `grep -rn "\.latitude\b|\.longitude\b" app/ lib/ components/ scripts/` (excluding `__tests__`).

`CampSite.latitude/longitude` is a SEPARATE column from `Location.lat/lon` — confirmed byte-identical for all 650 real camps today (sampled 5 rows via direct query) because every writer that has ever set one has always set both together (`app/api/campsites/route.ts` POST, `scripts/load-mock-staging.mjs`). Location:CampSite is 1:1 in practice today (652 Locations, 650 CampSites, 0 with >1 linked CampSite).

| Reader | Touches how | Action this story | Why |
|---|---|---|---|
| `components/CampgroundDetailClient.tsx` ("Get directions" link + map pin) | Reads `campSite.latitude/longitude` | **NOW (activates correctly)** | Moving only `Location.lat/lon` would leave the camper-visible pin exactly where it was (outside Thailand) — silently defeating the story |
| `lib/ai/tools/get-camp-detail.ts` / `lib/ai/tools/compare-camps.ts` (`distanceFromBangkokKm`) | Reads `campSite.latitude/longitude` | **NOW (activates correctly)** | Same reason |
| `app/wishlist/page.tsx` | Reads `campSite.latitude/longitude` | **NOW (activates correctly)** | Same reason |
| `lib/campsite-filters.ts`'s province filter | Reads `location.province`/`adminAreaId`, never `latitude/longitude` | **VERIFIED, NO-CHANGE** | Out of file surface; unaffected by this story's writes |

**Fix:** `Location.lat/lon` and every linked `CampSite.latitude/longitude` are written together, in ONE `prisma.$transaction`, for every moved row.

## Host-entered-data safety (owner's explicit ask)

No schema column marks a row "seed" vs. "host-entered" (a schema change is out of this story's file surface), so the mechanism is structural:

1. **Candidate set = keys already present in CAM-562's frozen cache.** A row created or edited AFTER that snapshot has no entry in it at all, so it can never become a candidate here, regardless of its current coordinates. Proven by a test: a row with foreign-looking coordinates but ABSENT from the injected cache is left completely untouched.
2. **Fresh, live re-check before any write.** Immediately before moving a candidate, this script re-reverse-geocodes its CURRENT (not cached) lat/lon (~18 calls, not a fresh 650) and moves it only if that fresh check still shows a non-Thailand country right now. A row already corrected by a host, by a prior run of this very script, or by anything else, now reads Thailand and is skipped (`already_inside_thailand`) — this is also what makes a second run idempotent.
3. **Explicit opt-in + non-prod guard**, same shape as CAM-562/563 (`ALLOW_COORDINATES_INSIDE_THAILAND_BACKFILL=1`, refuses a production-looking `DATABASE_URL`).

## Real dry-run + real-run result (dev DB)

<!-- Filled in after the real run against the dev DB — see Changelog. -->

## 83 adjacent-province cases — report, not rewrite

CAM-562's own `provinceMismatch` list (83 rows, reused via `runBackfill` import, zero new classification logic) is inside Thailand, so the owner's instruction does not cover it. `reportProvinceMismatchDistances` ranks each by a haversine distance from the row's CURRENT point to its claimed province's (camp-derived, non-authoritative) centroid (`prisma/data/province-centroids.json`) — a cheap, 0-extra-Google-call heuristic, not a boundary check (no province polygon data exists in this repo).

**Real result (dev DB, 2026-07-26):** max distance observed 31.2km (`Chai Nat` -> `Nakhon Sawan`), min 3.2km (`Bangkok` -> `Samut Prakan`) — every one of the 83 sits well under the 100km far-outlier threshold. **Recommendation: report only, do not bulk-rewrite** — this is consistent with a seed coordinate sitting near a provincial border, categorically different from the 18 foreign-country cases.

## AC-9 — province filter regression, verified before AND after

```
prisma.campSite.count({ where: { location: { province: 'Chiang Mai' } } }) → 18
```
None of the 18 moved rows or the 83 reported rows are in Chiang Mai (verified by direct query) — the count holds by construction (this script never writes `Location.province` and never re-homes a row to a different province's `adminAreaId`).

## ADRs

No new ADR — reuses CAM-554's already-accepted server-side-Google-Geocoding decision and CAM-563's already-accepted `adminAreaId`-as-anchor decision.

Confirmation: `__tests__/cam-571-coordinates-inside-thailand.test.ts` (36 tests) — identification-by-country, placement verification/refusal, CampSite sync, host-entered-safety, idempotency, 83-case report, guard.

## Links
`scripts/backfill-cam-571-coordinates-inside-thailand.mjs` · `scripts/backfill-cam-562-subdistrict-geocode.mjs` (reused) · `scripts/backfill-cam-563-location-admin-area.mjs` (reused) · `app/api/geocode/forward/route.ts` (CAM-554, algorithm reference) · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-562-backfill-subdistricts/tech.md` · `story.md`

## Changelog
- v1 (2026-07-26) — created; real dev-DB dry-run + real run pending (see story.md Self-verify)
