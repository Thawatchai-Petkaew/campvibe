---
feature: Platform hardening
epic: taxonomy-ui-foundation
persona: Host
artifact: tech
owner: backend-engineer
status: done
version: v1
updated: 2026-07-27
---
# Tech — Retire the legacy ThailandLocation FK (CAM-574, phase B)

## Reader/writer inventory — mandatory sweep (architecture.md §15b)

**Search method:** `grep -rn "ThailandLocation\|thailandLocation\|thaiLocationId\|thaiLocation" app/ lib/ components/ scripts/ --include="*.ts" --include="*.tsx"` across the whole repo (not scoped to the dispatch's named files) + `grep -rln "thailandLocation" __tests__/` for every test that mocks/pins the retired shape + manual trace of two shared-state chains (`LocationPicker.tsx`'s cascading-select vs map-pin-drop paths; `CampgroundForm.tsx`'s prefill vs submit) to find id-space interactions a flat grep can't see.

| Reader/writer | Touches how | Action | Why |
|---|---|---|---|
| `app/api/location/route.ts` (POST, write path) | `prisma.thailandLocation.findUnique` to resolve `thaiLocationId`→`provinceCode`→`AdminArea` | **MOVED** — client now sends `adminAreaId` directly; route verifies it exists (FK-safe) and walks deeper via the existing `matchAdminArea`, unchanged | in allowed surface; the FK's own resolution site |
| `app/api/locations/search/route.ts` | `searchProvinces`/`searchDistricts` bridged `AdminArea`→`ThailandLocation.id`; "no type" combined branch read `ThailandLocation` directly + a raw-SQL fallback | **MOVED** — returns `AdminArea.id` directly (no bridge); combined branch removed (dead per CAM-573's own tech.md: no live caller) | in allowed surface; the id-bridge CAM-573 built specifically for this story to retire |
| `components/LocationPicker.tsx` | `LocationPickerValue.thaiLocationId` derived from `district?.id \|\| province?.id` (a `ThailandLocation.id`) | **MOVED** — `adminAreaId` field; `deriveValue` takes an optional override so the map-pin-drop path (below) stays correct | in allowed surface; the one write-path consumer named in the dispatch |
| `components/CampgroundForm.tsx` | prefill read `initialData.location?.thaiLocation`/`thaiLocationId`; submit sent `thaiLocationId` | **MOVED** — prefill reads server-attached `provinceTh`/`provinceEn`/`districtTh`/`districtEn` (see `lib/spot-aggregation.ts` below); submit sends `adminAreaId` | in allowed surface |
| `lib/validations/location.ts` | `createLocationSchema.thaiLocationId`; `thailandLocationRowSchema`/`geocodeReverseResultSchema` | **PARTIAL** — `createLocationSchema.thaiLocationId` → `adminAreaId`. `thailandLocationRowSchema`/`geocodeReverseResultSchema` **NOT touched** — shared with `app/api/geocode/_shared.ts` (out of surface, see below) | `lib/**`, but the geocode-shared schema must not change without its consumer |
| `lib/spot-aggregation.ts` (`getCampSiteWithCapacity`) | `include: { location: { include: { thaiLocation: true } } }` (feeds `CampgroundForm`'s edit prefill via `app/api/campsites/[id]/route.ts`, unedited pass-through) | **MOVED** — `include: { adminArea: { select: adminAreaChainSelect } }`; attaches `provinceTh`/`provinceEn`/`districtTh`/`districtEn` onto `location` via `resolveLocationDisplayNames` (imported from `lib/read-models/camp-card.ts`, not edited) | in allowed surface (`lib/**`); this is the ONLY place `CampgroundForm`'s prefill data comes from |
| `lib/ai/tools/search-campsites.ts` (`resolveProvinceForSearch`) | `prisma.thailandLocation.findFirst({ where: { provinceName: { contains } } })` | **MOVED** — `prisma.adminArea.findFirst({ where: { countryCode:'TH', level:'PROVINCE', nameTh:{contains} } })`, same fail-open contract | in allowed surface (`lib/**`); also backs the "near" proximity resolve path (CAM-502/503) |
| `prisma/seed.ts` | upserts `ThailandLocation` rows (kept — see BR-5) + set `thaiLocationId: thaiLoc?.id` on each seeded camp's `Location` | **MOVED** — the `thaiLocationId:` line removed; `thaiLoc` lookup kept (its `provinceCode` still feeds `adminAreaId` via `provinceAreaByCode`) | explicitly in surface |
| `app/api/operator/dashboard/route.ts` (My Camp Sites list API) | `include: { location: { include: { thaiLocation: true } } } ` × 2 (one on `ownedSites`, pure over-fetch — never read; one on the actual listing) | **MOVED (extended surface)** — the `ownedSites` include dropped entirely (unused, over-fetch); the listing include moved to `adminArea` chain + `resolveLocationDisplayNames` attached in the response map | NOT in the dispatch's literal file list, but the schema change breaks this file outright (a genuine reader that must move) — flagged here explicitly, not silently expanded |
| `app/dashboard/campsites/page.tsx` (My Camp Sites list UI) | client-side passthrough of `camp.location.thaiLocation`, rendered raw (wrong-language, pre-existing CAM-567-class gap this story incidentally also fixes) | **MOVED (extended surface)** — reads the `provinceTh`/`provinceEn`/`districtTh`/`districtEn` fields the API now attaches | same reasoning as above — the two files are one consumer chain |
| `lib/read-models/camp-card.ts` (`getProvinceNamePairs`) | `prisma.thailandLocation.findMany({ where: { districtCode: '' } })` — the province Thai-name fallback map | **OUT OF SURFACE, NOT TOUCHED** | explicitly named in OUT OF BOUNDS ("phase A and CAM-576 just settled those — reuse, do not adjust"); this is a DIRECT query (not via the `Location.thaiLocation` relation), so it is UNAFFECTED by the FK/index removal in this migration — the table it reads stays |
| `app/api/geocode/_shared.ts` (`resolveFromComponents`, reverse-geocode) | `prisma.thailandLocation.findFirst` twice (province row, district row) — populates `GeocodeReverseResult.province`/`district` (`thailandLocationRowSchema`-shaped) | **OUT OF SURFACE, NOT TOUCHED** | `app/api/geocode/**` was never listed in this dispatch's allowed surface. This is a DIRECT query (not via the `Location.thaiLocation` relation) — unaffected by the FK/index removal. See "The id-space landmine" below for why this ALSO blocks retiring the id-bridge naively |
| `app/api/admin-areas/subdistricts/route.ts` | comment only ("cannot hold a sub-district") | NO-CHANGE | no functional reference |
| `lib/geo/admin-area-match.ts` | comment only | NO-CHANGE | no functional reference |
| `lib/ai/place-resolver.ts` | imports `prisma/data/thailand-locations.json` (a static seed-data file), never the DB table | NO-CHANGE | not a DB reader at all |
| `lib/ai/tools/bulk-availability.ts` | comment describing a deliberate CAM-465 scope-cut (never actually queries `ThailandLocation`) | NO-CHANGE | no functional reference |

## The id-space landmine (why the id-bridge couldn't just be deleted blindly)

`components/LocationPicker.tsx` is shared state between TWO input methods that both feed the SAME `deriveValue()` id computation:
1. the cascading combobox (`/api/locations/search`, in this story's surface)
2. the map pin-drop (`/api/geocode/reverse` → `app/api/geocode/_shared.ts`, **out of surface**)

Before this story, `deriveValue()` computed `thaiLocationId: district?.id \|\| province?.id \|\| ''` — for EITHER input method, because both endpoints returned `ThailandLocation.id`-shaped rows (`thailandLocationRowSchema`). Naively changing `/api/locations/search` to return `AdminArea.id` (this story's whole point) while leaving `/api/geocode/reverse` untouched (mandatory — it's out of surface) would have made `deriveValue()` send a **`ThailandLocation.id` mislabeled as `adminAreaId`** for every map-pin-drop location choice — `prisma.adminArea.findUnique({where:{id: <wrong id space>}})` would silently return `null`, and the pin-drop path's location would silently fail to resolve an `adminAreaId` at all. This is exactly the "silently returns zero" failure mode this story was warned about, just one level removed (an id-space collision, not a province-count regression).

**Resolution, no geocode files touched:** `geocodeReverseResultSchema` already carries a top-level `adminAreaId` field (CAM-554's own "id-first result" design, computed as `subDistrictNode?.id ?? districtNode?.id ?? provinceNode?.id` — genuinely `AdminArea.id` values, independent of the `province`/`district` sub-objects' `ThailandLocation`-backed `.id`). `deriveValue()` now takes an optional 4th `overrideAdminAreaId` param; `applyResolvedPin` (the pin-drop handler) passes the geocode response's own `data.adminAreaId` through as that override, never deriving it from `resolved.province`/`district`'s `.id`. The cascading-select path (no override given) still defaults to `subDistrict?.id \|\| district?.id \|\| province?.id`, which is now correctly an `AdminArea.id` on that path. Verified behaviorally: `__tests__/cam-554-map-pin-sync.test.ts` (updated, source-inspection pins the exact `deriveValue(...)` call shape in `applyResolvedPin`).

## Why the ThailandLocation MODEL is not dropped

Two direct (non-FK) readers remain, both out of this dispatch's file surface:
- `app/api/geocode/_shared.ts` — queries `ThailandLocation` by `provinceCode`/`districtCode`, never via `Location.thaiLocation`.
- `lib/read-models/camp-card.ts` — queries `ThailandLocation` by `districtCode: ''` for the province Thai-name fallback map, never via the relation.

Neither goes through `Location.thaiLocationId`/`Location.thaiLocation` — both are standalone queries against the `ThailandLocation` table by its own columns. This means **dropping only the FK/column/index on `Location` is fully safe and does not affect either file** (confirmed: `npm test` — full suite green, including their pinned tests `cam-573-location-display.test.ts`, `cam-545-card-display.test.ts`, `cam-548-detail-location.test.ts`, `cam-554-geocode-routes.test.ts`, all unedited). Dropping the TABLE itself would break both. This is a partial retirement, stated plainly rather than forced: a follow-up story that extends the file surface to these two files (and, transitively, `app/api/geocode/reverse/route.ts` + `app/api/geocode/forward/route.ts`, which consume `_shared.ts`) could complete the model drop.

## The free-text columns — left alone, as instructed

`lib/campsite-filters.ts` matches `Location.province` by exact string equality; `province`/`district`/`subDistrict` are also read directly by `lib/read-models/camp-card.ts` (kept selected "for shape stability", per its own CAM-573 comment) and by the detail-page's un-migrated fallback path. Provably safe removal would require confirming every one of those readers is fully off the raw string in favor of the id-derived chain — CAM-573 itself found and left an unclosed gap here (`app/campgrounds/[slug]/page.tsx`). Not attempted in this story; left in place, per the dispatch's own instruction, with the reason stated.

## Migration — reversible, proven up → down → up on the local dev DB

`prisma/migrations/20260727010000_cam574_retire_thai_location_fk/migration.sql` (up) + `down.sql`. Generated via `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script` (non-interactive environment — `prisma migrate dev` refuses; this is the documented non-interactive equivalent) against the real local dev DB, then hand-folded into a migration folder with a matching `down.sql` (repo convention — see `20260725151126_cam509_assistant_turn_log/down.sql`).

Real commands + output (this session, local dev DB):
```
$ prisma migrate deploy            # UP
Applying migration `20260727010000_cam574_retire_thai_location_fk` ... All migrations have been successfully applied.

$ prisma db execute --file down.sql        # DOWN
Script executed successfully.
$ # verified: thaiLocationId column/FK/index all back (information_schema query)
thaiLocationId column present: true
FK present: true
index present: true

$ prisma db execute --file migration.sql   # UP again
Script executed successfully.
$ # verified: all three gone again
thaiLocationId column present: false
FK present: false
index present: false

$ prisma migrate status
Database schema is up to date!
```

No backfill needed on down (BR-5 in story.md): CAM-545 measured only 12/652 `Location` rows had `thaiLocationId` populated at all; every one of those rows is superseded by `adminAreaId` (populated for ~650/652 per CAM-573), which this migration does not touch in either direction.

## Chiang Mai canary — measured at every layer this story touched

| Layer | Count/result | How verified |
|---|---|---|
| DB (`prisma.campSite.count`, direct query, real dev DB) | **18** (before AND after the migration) | ad-hoc script against the real DB, run before creating the migration and again after `prisma generate` + migrate deploy |
| Migrated `resolveProvinceForSearch` (`AdminArea`, real dev DB, no mocks) | `เชียงใหม่` → `Chiang Mai` (matches the DB string exactly) | ad-hoc script, real `prisma.adminArea.findFirst` |
| `/api/locations/search`'s own query (real dev DB, no mocks) | Returns the real AdminArea row (`code: '50'`, `nameTh: 'เชียงใหม่'`, `nameEn: 'Chiang Mai'`, a real uuid `id`) | ad-hoc script, the exact `searchProvinces()` query verbatim |
| `buildCampSiteWhere`/`resolveProvinceAdminAreaIds` (the catalog-filter path) | **NOT touched by this story** — untouched code, still covered by CAM-573's own `__tests__/cam-573-province-filter-parity.test.ts` (unedited, still green in the full suite run) | n/a — out of this story's diff |

The catalog-filter canary (buildCampSiteWhere) is explicitly NOT re-verified here because this story does not touch that code path at all — re-asserting it would be redundant with CAM-573's own, still-passing, unedited test.

## Tests
`__tests__/cam-574-retire-thailand-location.test.ts` (new) — the end-to-end create+edit+search proof, with a regression guard (no `thailandLocation` key in the mocked prisma object at all — a resurrected call throws, never silently no-ops). Updated in place (describe the new shape, never loosened): `cam-573-locations-search.test.ts`, `cam-563-location-route-admin-area.test.ts` (full rewrite — the retired `thaiLocationId`→provinceCode walk no longer exists), `cam-216-sec-b-location-validation.test.ts`, `cam-559-cascading-location.test.ts`, `cam-209-rate1-abuse-hardening.test.ts` (RISK-9's `ThailandLocation`-based forcing branch moved to the `type=province` path), `cam-404-search-campsites-province-resolve.test.ts`, `cam-458-province-resolve.test.ts`, `cam-463-search-campsites-region.test.ts`, `cam-502-geo-proximity.test.ts`, `cam-503-landmark.test.ts`, `cam-554-map-pin-sync.test.ts` (the `deriveValue` 4-arg source-inspection pin).

Note on `resolveProvinceAdminAreaIds` (CAM-563's pre-existing, untouched safety net in `lib/campsite-filters.ts`): it now shares the same underlying `prisma.adminArea.findFirst` method as the migrated `resolveProvinceForSearch` (previously a different table, trivially distinguishable). Several tests' `toHaveBeenCalledOnce()`/`not.toHaveBeenCalled()` assertions were updated to filter calls by `resolveProvinceForSearch`'s own `nameTh.contains` shape (vs the safety net's `OR:[{equals}]` shape) so they assert only the function under test, not the unrelated safety net's real, correct, additional call.

## Links
`app/api/location/route.ts` · `app/api/locations/search/route.ts` · `components/LocationPicker.tsx` · `components/CampgroundForm.tsx` · `lib/spot-aggregation.ts` · `lib/ai/tools/search-campsites.ts` · `prisma/schema.prisma` · CAM-573 tech.md (the id-bridge this story retires) · CAM-553 tech.md (the model decision) · `story.md`

## Changelog
- v1 (2026-07-27) — created
