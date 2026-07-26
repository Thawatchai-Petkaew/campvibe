---
feature: Platform hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: tech
owner: backend-engineer
status: done
version: v1
updated: 2026-07-27
---
# Tech — Make CampSite the single source of a camp's coordinates (CAM-575)

## Data model

**One migration, additive-only, no column/schema change.** `prisma/migrations/20260726165149_cam575_campsite_location_coord_sync_trigger/migration.sql` adds a Postgres trigger + function; it does not touch `prisma/schema.prisma` (no new/removed/renamed field). `prisma migrate status` confirmed up to date before and after.

## Reader/writer inventory — every reader and writer of both column pairs

**Search method:** `grep -rn "\.latitude\b" app/ lib/ components/ scripts/ prisma/ --include="*.ts" --include="*.tsx" --include="*.mjs" --include="*.js"`, repeated for `\.longitude\b`, `\.lat\b`, `\.lon\b` (excluding `__tests__`), then cross-checked against CAM-571's own inventory (which found the column pair in the first place) and CAM-562's tech.md. Assumed the first pass was incomplete — CAM-571's own near-miss (its dispatch named only `Location.lat/lon`) is the exact lesson this rests on — so every hit was opened and read, not just counted.

| Reader/writer | Touches how | Action this story | Why |
|---|---|---|---|
| `components/CampgroundDetailClient.tsx` ("Get directions" link + map pin) | Reads `campSite.latitude/longitude` | VERIFIED, NO-CHANGE | Camper-facing; already reads the canonical column |
| `lib/ai/tools/get-camp-detail.ts` / `lib/ai/tools/compare-camps.ts` (`distanceFromBangkokKm`) | Reads `campSite.latitude/longitude` | VERIFIED, NO-CHANGE | Same reason |
| `lib/ai/tools/search-campsites.ts` (`nearCentroid` proximity ranking) | Reads `c.latitude/c.longitude` on already-queried CampSite rows | VERIFIED, NO-CHANGE | Same reason |
| `app/wishlist/page.tsx`, `app/api/wishlist/route.ts` | Read `campSite.latitude/longitude` | **OUT OF BOUNDS** — PR #649/CAM-573 open on `app/wishlist/page.tsx`; not touched, not re-verified beyond a read | Ticket's explicit OUT OF BOUNDS list |
| `components/CampgroundForm.tsx` | Reads/writes `formData.latitude/longitude`; POSTs the SAME values to both `/api/location` (`lat`/`lon`) and `/api/campsites` (`latitude`/`longitude`) in one synchronous submit handler | VERIFIED, NO-CHANGE | Client-side "independent-looking" duplication was never the actual bug — both calls always read the same in-memory value at submit time; the bug lived server-side (see the PATCH route below). No client change needed now that the server enforces agreement regardless of what either call sends |
| `app/api/campsites/route.ts` (POST, create) | Writes `CampSite.latitude/longitude` directly; `locationId` points at a Location already created by a prior `/api/location` call | **NOW (comment added)** | Fires the sync trigger on INSERT — the provisional value `/api/location` wrote is overwritten to match CampSite's, closing the two-step race by construction rather than by both calls happening to agree |
| `app/api/location/route.ts` (POST, create) | Writes `Location.lat/lon` from client-supplied values, BEFORE any CampSite exists (FK requires the parent row first) | **NOW (comment added)** | Provisional only — documented as such; the very next `POST /api/campsites` overwrites it via the trigger |
| `app/api/campsites/[id]/route.ts` (PATCH, edit) | Writes `CampSite.latitude/longitude` on every pin edit; historically NEVER wrote `Location.lat/lon` (an explicit code comment said so: "lat/lon are NOT updated from camp site data - they remain independent") | **NOW (comment corrected + trigger enforces)** | **This is almost certainly the actual root cause of the 4 real divergent camps** — a host editing a camp's pin moved `CampSite`'s coordinates while `Location`'s silently went stale, with no error anywhere. The trigger closes this without any functional code change (the `campSite.update` call already existed) |
| `app/api/scrape-seed/route.ts`, `app/api/bulk-seed/route.ts`, `app/api/seed/route.ts` | Create `Location` then `CampSite` (same two-step, single-request pattern as the host form) | **NO-CHANGE** — trigger enforces automatically at their `campSite.create()` call | Seed/scrape routes, not this story's concern beyond confirming the trigger covers them for free |
| `scripts/load-mock-staging.mjs`, `prisma/seed.ts`, `prisma/seed-bookings.ts` | Create `Location` then `CampSite` | **NO-CHANGE — outside this story's allowed file surface** | Not `lib/**`/`app/api/**`, not named in the allowed surface; the trigger enforces correctness at their `campSite.create()` regardless of internal order — verified by reading each file, not assumed |
| `scripts/backfill-cam-571-coordinates-inside-thailand.mjs` | Wrote `Location.lat/lon` THEN linked `CampSite.latitude/longitude` in one `$transaction`, for its 18 moved rows | **NOW (write order inverted + header comment updated)** | CampSite is canonical; write it first. The Location write is kept (now redundant with the trigger) ONLY because it also carries `district`/`subDistrict`/`adminAreaId` in the same call, which have no CampSite analogue — removing it entirely would need touching `__tests__/cam-571-coordinates-inside-thailand.test.ts`, which is out of this story's file surface, and that file only asserts FINAL values, not write order, so keeping both writes (reordered) changes nothing observable to that suite |
| `scripts/backfill-cam-562-subdistrict-geocode.mjs` | Reads `Location.lat/lon` (to reverse-geocode); writes ONLY `district`/`subDistrict`/`adminAreaId` | **NO-CHANGE — investigated, confirmed no coordinate write exists** | The ticket's own comment said "CAM-562's and CAM-571's scripts currently write Location first" as a general statement; grepping this script's body (`grep -n "lat\|lon"`) shows it never contains a `prisma.location.update` call touching `lat`/`lon` at all — only a read for geocoding. No write-order change applies here. Documented rather than silently skipped, per the "assume the first list is incomplete, prove otherwise" instruction — proving a NO-CHANGE is as much the job as finding a NOW |
| `scripts/backfill-cam-575-reconcile-coordinates.mjs` (new, this story) | Writes `CampSite.latitude/longitude` ONLY for the 4 divergent camps | **NEW** | The one-time remediation; `Location` is derived by the trigger, never written directly here |
| `prisma/seed.ts` line ~774 comment referencing `campData.latitude`/`locationData.lat` | Writes both, same convention-only pattern | **NO-CHANGE — outside allowed surface** | Same reasoning as `load-mock-staging.mjs` above |
| `lib/campsite-filters.ts` province filter | Reads `location.province`/`adminAreaId`, never `latitude/longitude` | VERIFIED, NO-CHANGE | Unaffected by this story; confirmed by the Chiang Mai canary before/after every write |
| `app/api/locations/search/**`, `lib/read-models/camp-card.ts`, `components/CatalogResults.tsx`, `lib/catalog-cache.ts` | Not inspected beyond a `grep` hit count | **OUT OF BOUNDS** | Ticket's explicit OUT OF BOUNDS list — PR #649/CAM-573 |

**Orphan Locations found during the sweep (pre-existing, out of scope):** 2 of 652 `Location` rows (`province: 'x'`, `lat`/`lon` both `null`) have zero linked `CampSite` rows — confirmed via `prisma.location.findMany({where:{campSites:{none:{}}}})`. These predate this story (CAM-563's tech.md already names them as orphaned placeholders) and hold no coordinates at all, so they are never candidates for divergence and are not touched by the trigger (the trigger only fires from a `CampSite` write; a Location with no linked CampSite has nothing to derive from). Left alone.

## Making CampSite canonical — chosen mechanism: a database trigger, not a code convention

**Chosen: DERIVE, not remove.** `Location.lat/lon` still has real readers (`scripts/backfill-cam-562-*.mjs`'s reverse-geocode input, `scripts/backfill-cam-571-*.mjs`'s candidate scan, this story's own reconciliation script) — removing the column is a bigger migration than this story's file surface allows and was not what the column-duplication problem actually needed solved. **Enforcement is a Postgres trigger** (`campsite_coords_sync`, `prisma/migrations/20260726165149_cam575_campsite_location_coord_sync_trigger/migration.sql`):

```sql
CREATE OR REPLACE FUNCTION sync_location_coords_from_campsite()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "Location"
  SET "lat" = NEW."latitude", "lon" = NEW."longitude"
  WHERE "id" = NEW."locationId"
    AND ("lat" IS DISTINCT FROM NEW."latitude" OR "lon" IS DISTINCT FROM NEW."longitude");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campsite_coords_sync
AFTER INSERT OR UPDATE OF "latitude", "longitude", "locationId" ON "CampSite"
FOR EACH ROW
EXECUTE FUNCTION sync_location_coords_from_campsite();
```

**Why a trigger and not a Prisma Client extension / application-level helper:** the writer set spans BOTH the Next.js app (via `@/lib/prisma`) AND standalone `.mjs` scripts that each instantiate their own `new PrismaClient()` (`scripts/backfill-cam-571-*`, `load-mock-staging.mjs`, `prisma/seed.ts`, and any future script). A Prisma extension only fires for code paths that import the SAME extended client instance — every script here creates its own, so an extension would need to be re-applied everywhere and silently miss any path that forgets it, which is precisely the "a comment will not stop that" failure mode item 5 warns about. A database trigger fires for every write to the `CampSite` table regardless of which process, client, or language wrote it — including a future writer nobody has built yet.

**Direction is one-way only** (BR-3): `CampSite → Location`. There is deliberately no reverse trigger; if one existed, whichever table was touched LAST would win, which is the exact "two places, no rule for which wins" defect this story closes, just moved one layer down.

## Reversible migration — proven up→down→up on the local dev DB (behavioral, not source-inspection)

```
$ npx prisma migrate dev   # UP — applies the trigger
Applying migration `20260726165149_cam575_campsite_location_coord_sync_trigger`
Your database is now in sync with your schema.

# Behavioral proof (scratch CampSite+Location pair, deleted after):
after CREATE — location.lat/lon (expect 1,2, not the provisional 10,20): 1 2
after UPDATE (CampSite only) — location.lat/lon (expect 99,88): 99 88

$ # DOWN — DROP TRIGGER IF EXISTS campsite_coords_sync ON "CampSite";
  #        DROP FUNCTION IF EXISTS sync_location_coords_from_campsite();
DOWN — trigger present (expect empty array): []

# Behavioral proof divergence is possible again with the trigger dropped:
WITH TRIGGER DROPPED — location.lat/lon (expect STALE 5,5, proving divergence is possible again): 5 5

$ # UP again — re-applied the same CREATE FUNCTION + CREATE TRIGGER SQL
RE-UP — trigger restored: [{"tgname":"campsite_coords_sync"}]

# Re-confirmed the trigger works again after the up→down→up cycle:
after CREATE — location.lat/lon (expect 1,2, not the provisional 10,20): 1 2
after UPDATE (CampSite only) — location.lat/lon (expect 99,88): 99 88

$ npx prisma migrate status
Database schema is up to date!
```

All scratch rows created during this proof were deleted; `prisma.location.count({where:{province:'Test Province'}})` and the "Down" variant both confirmed 0 leftover after cleanup.

## Reconciling the 4 divergent camps — per-camp evidence, never a blanket preference

**Measurement (dev DB, 2026-07-26/27):** `prisma.campSite.findMany({where:{location:{lat:{not:null},lon:{not:null}}}}, ...)` compared against each linked `Location.lat/lon` → exactly **4** of 650 disagree (matches the ticket's own measurement exactly).

**Instrument:** reverse-geocode BOTH candidate points (`callGoogleGeocode`, `language=th` — CAM-562's own instrument) and match the geocoded province against the row's claimed province (via `Location.adminAreaId`'s PROVINCE ancestor, or the free-text `province` string when unset) using `matchAdminAreaByName` (bilingual, hierarchical, exact-match — the SAME matcher this codebase already trusts for this exact class of decision, not a naive raw-string compare).

**A real false lead caught before it shipped:** the first pass used an unauthenticated English-language reverse-geocode and naively string-compared the result against the stored `province`. For "Bangkok Beachside Camp 1" this returned `"Bangkok"` for the `CampSite` point but `"Krung Thep Maha Nakhon"` for the `Location` point — Google's own English naming is inconsistent for the same province depending on address specificity, and the `AdminArea` table only stores `"Bangkok"` as the English alias, so a naive compare would have wrongly flagged this camp as ambiguous/divergent-by-geocode. Re-running with `language=th` (matching `callGoogleGeocode`'s own convention) and the real `matchAdminAreaByName` resolved both points to the exact same `AdminArea` node (`กรุงเทพมหานคร`) — no ambiguity. This is why the reconciliation script uses the codebase's own matcher, never a fresh string comparison.

| Camp | Claimed province | `CampSite` point verifies? | `Location` point verifies? | Verdict | Evidence |
|---|---|---|---|---|---|
| Phra Nakhon Si Ayutthaya Riverside Camp 1 (`ca952d76`) | Phra Nakhon Si Ayutthaya | YES | YES | **Kept CampSite** (canonical, not disproven) | Both points reverse-geocode to `จังหวัดพระนครศรีอยุธยา` — no evidence to override canonical |
| Bangkok Beachside Camp 1 (`8edf774a`) | Bangkok | YES | YES | **Kept CampSite** (canonical, not disproven) | Both points reverse-geocode to `กรุงเทพมหานคร` (see the false-lead note above — an English-only check wrongly looked ambiguous here) |
| Phra Nakhon Si Ayutthaya Forest Camp 2 (`0e2deba6`) | Phra Nakhon Si Ayutthaya | YES | YES | **Kept CampSite** (canonical, not disproven) | Both points reverse-geocode to `จังหวัดพระนครศรีอยุธยา` |
| Bangkok Forest Camp 2 (`bbf0255b`) | Bangkok | **NO** — lands in `สมุทรปราการ` (Samut Prakan) | **YES** — lands in `กรุงเทพมหานคร` | **Corrected FROM Location** — this camp diverged in the OTHER direction | `CampSite`'s stored point (13.6035, 100.5979) reverse-geocodes to Samut Prakan, a real adjacent-province miss of the exact shape CAM-562 already catalogued elsewhere (Bangkok↔Samut Prakan is one of its own documented adjacent-province pairs); `Location`'s point (13.6695, 100.6142) is the one that actually sits in the claimed province |

**Real dry-run + real-run result (dev DB, 2026-07-26/27):** 4 candidates, 3 kept (CampSite verified), 1 corrected (from Location), 0 unresolved. Chiang Mai province-filter count: 18 before, 18 after. **Independently re-verified by direct DB query, not the script's own log:** re-running `findDivergentPairs` after the real run returns `[]` (0 rows). **Second real run (idempotency):** 0 candidates found, 0 writes — the reconciliation is stable.

## CAM-571's backfill — write order inverted

`scripts/backfill-cam-571-coordinates-inside-thailand.mjs`'s `planMoves` now writes the linked `CampSite.latitude/longitude` FIRST, then `Location`'s `lat`/`lon` + `district`/`subDistrict`/`adminAreaId` SECOND, inside the same `$transaction` (previously Location-first). The Location coordinate write is kept (now redundant with the `campsite_coords_sync` trigger) because that same call also carries the non-coordinate fields (`district`/`subDistrict`/`adminAreaId`), which have no CampSite analogue and are NOT trigger-derived — removing the coordinate half of that one call would need touching `__tests__/cam-571-coordinates-inside-thailand.test.ts` (asserts final `fake.data[0].lat/lon` and `fake.campSites[0].latitude/longitude` values, not write order or which call carries what), which sits outside this story's allowed file surface. Re-running that story's OWN existing test suite (unedited) after this change: still green — confirms the write-order change is invisible to that suite's final-state assertions, and the new order is the one this story requires.

**CAM-562's backfill — investigated, no change needed.** `grep -n "lat\|lon" scripts/backfill-cam-562-subdistrict-geocode.mjs` shows the ONLY coordinate touches are a read (`callGoogleGeocode(row.lat, row.lon)` for reverse-geocoding) and the candidate-scan `where` clause (`lat: {not: null}`) — every write in that script (`prisma.location.update({data: result.write})`) carries only `adminAreaId`/`district`/`subDistrict`, never `lat`/`lon`. The ticket's own comment generalized "CAM-562's and CAM-571's scripts currently write Location first" across both backfills; for CAM-562 specifically that statement does not apply to coordinates because it never wrote them in the first place. No code change made there — documented as a verified NO-CHANGE rather than silently skipped.

**Creation-flow nuance (documented, not a contradiction):** for any CREATE flow (`app/api/campsites/route.ts`, the seed/scrape routes, `load-mock-staging.mjs`, `prisma/seed.ts`), `Location` must still be created BEFORE `CampSite` — the FK (`CampSite.locationId → Location.id`) requires the parent row to exist first, and no story can invert that. "CampSite is canonical" for these flows means the trigger fires on the `CampSite` INSERT and overwrites whatever provisional value `Location` held, moments after it was written — correctness is enforced by WHICH value wins, not by literal wall-clock write order (which the FK constraint fixes regardless).

## ADRs

No new ADR — reuses CAM-554's already-accepted server-side-Google-Geocoding decision and CAM-563's already-accepted `adminAreaId`-as-anchor decision, same as CAM-571.

Confirmation: `__tests__/cam-575-coordinate-sync-invariant.test.ts` (real dev-DB integration test — fails if the trigger is ever removed/broken: it writes through `CampSite` only and reads back `Location`) · `__tests__/cam-575-reconcile-coordinates.test.ts` (fake-Prisma unit tests for the reconciliation decision logic, using the real 4 camps' fixture shape).

## Links
`prisma/migrations/20260726165149_cam575_campsite_location_coord_sync_trigger/migration.sql` · `scripts/backfill-cam-575-reconcile-coordinates.mjs` · `scripts/backfill-cam-571-coordinates-inside-thailand.mjs` (write-order inverted + 2 helpers exported) · `app/api/campsites/route.ts` / `app/api/campsites/[id]/route.ts` / `app/api/location/route.ts` (comments corrected) · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-571-coordinates-inside-thailand/tech.md` · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-562-backfill-subdistricts/tech.md` · `story.md`

## Changelog
- v1 (2026-07-27) — created; migration proven up→down→up on the dev DB; 4 divergent camps reconciled (3 kept, 1 corrected) with per-camp reverse-geocode evidence; CAM-571 write order inverted; CAM-562 investigated, confirmed no change needed.
