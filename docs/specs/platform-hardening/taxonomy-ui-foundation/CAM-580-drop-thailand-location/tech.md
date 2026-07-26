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
# Tech — Drop the legacy ThailandLocation table itself (CAM-580)

## Reader/writer inventory — mandatory sweep (architecture.md §15b)

**Search method:** `grep -rn "ThailandLocation\|thailandLocation\|thaiLocationId\|thaiLocation" app/ lib/ components/ scripts/ prisma/ --include="*.ts" --include="*.tsx" --include="*.mjs"` (whole repo, not scoped to the two named files) + `grep -rln "thailandLocation\|ThailandLocation" __tests__/ e2e/` for every test that mocks/mentions the retired shape, then for each test file a second, narrower `grep -n "thailandLocation\."` (the actual property-access pattern) to separate a live mock/call from a prose comment. Repeated as a LIVE regression guard in `__tests__/cam-580-drop-thailand-location.test.ts` Section A (walks `app/`, `lib/`, `components/`, `scripts/` at test-run time, not just this session).

| Reader/writer | Touches how | Action | Why |
|---|---|---|---|
| `app/api/geocode/_shared.ts` (`resolveFromComponents`) | `prisma.thailandLocation.findFirst` × 2 — province row (`districtCode:''`) and district row, joined off the matched `AdminArea` node's `code` | **MOVED** — `province`/`district` rows built DIRECTLY from the matched `provinceNode`/`districtNode` (`AdminAreaNode`) into the byte-identical `thailandLocationRowSchema` shape, same mapping `/api/locations/search`'s `searchProvinces`/`searchDistricts` already use post-CAM-574. Closes a latent data-drift edge case: previously district resolution was gated on the `ThailandLocation` join succeeding (`if (provinceRow && districtRaw)`), so a matched `AdminArea` province with no corresponding `ThailandLocation` row would silently stop the whole walk before ever reaching district/sub-district — that branch is now impossible by construction. | named in the dispatch; the direct reader CAM-574 flagged and left |
| `lib/read-models/camp-card.ts` (`getProvinceNamePairs`, backs `getProvinceThaiNameMap`) | `prisma.thailandLocation.findMany({where:{districtCode:''}})` — the province Thai-name fallback map (77 rows) | **MOVED** — `prisma.adminArea.findMany({where:{countryCode:'TH', level:'PROVINCE'}, select:{nameEn,nameTh}})`, same 77-row set, same `[en,th][]` pair shape returned to `getProvinceThaiNameMap()` unchanged | named in the dispatch; the other direct reader CAM-574 flagged and left |
| `prisma/seed.ts` (Thailand Locations block) | `prisma.thailandLocation.upsert` × 2 per province/district (province record `districtCode:''` + one per district) | **REMOVED entirely** — the JSON source (`prisma/data/thailand-locations.json`) is still loaded and still feeds the very next `AdminArea` seed loop; only the `ThailandLocation` upserts themselves are gone | explicitly in surface; BR-2 |
| `prisma/seed.ts` (mock camp→province linking) | `prisma.thailandLocation.findFirst({where:{provinceNameEn, districtCode:''}})` to get `thaiLoc.provinceCode`, then `provinceAreaByCode[thaiLoc.provinceCode]` | **MOVED** — the AdminArea seed loop now ALSO builds `provinceAreaByNameEn: Record<string,string>` (keyed by `province.nameEn`, same loop, no extra DB read); the camp-linking block reads `provinceAreaByNameEn[provinceNameEn]` directly — zero DB reads, was 1 extra `findFirst` per mock camp (12 total) | explicitly in surface; BR-2 — closes an N+1-shaped (12x) read entirely, not just moves it |
| `prisma/schema.prisma` (`model ThailandLocation`) | the model + table definition itself | **DROPPED** — model block removed; `Location`/`AdminArea` doc comments updated to stop referencing it as "retained"/"coexisting" | explicitly in surface; the story's whole point |
| `app/api/location/route.ts`, `app/api/campsites/[id]/route.ts`, `app/api/locations/search/route.ts`, `components/LocationPicker.tsx`, `components/CampgroundForm.tsx`, `lib/spot-aggregation.ts`, `lib/ai/tools/search-campsites.ts` | already migrated onto `AdminArea`/`adminAreaId` by CAM-574 | **NO-CHANGE** — re-verified via the Section A grep: zero `.thailandLocation.` property access in any of these | CAM-574's own inventory; re-confirmed here, not re-done |
| `lib/campsite-filters.ts`, `lib/read-models/camp-card.ts`'s `campCardSelect`/`district` free-text field, `app/campgrounds/[slug]/page.tsx` | reads `Location.province`/`district` free-text columns directly (exact-string match / shape-stability field) | **NO-CHANGE** — these never queried `ThailandLocation` at all (CAM-573/574 already decided the free-text columns stay); explicitly OUT OF BOUNDS for this story (`lib/campsite-filters.ts` named) | unrelated system; do not fork/touch per dispatch |
| `lib/geo/admin-area-match.ts` (`matchAdminArea`) | comment only ("the full shape for its `subDistrict` response field") | **NO-CHANGE** — no functional reference; the module itself never touched `ThailandLocation` | comment-only |
| `lib/ai/place-resolver.ts` | imports `prisma/data/thailand-locations.json` (the static seed-source JSON file), never the DB table | **NO-CHANGE** — not a DB reader at all; the JSON file is untouched and still feeds the `AdminArea` seed loop | not a DB reader |
| `__tests__/cam-554-geocode-routes.test.ts` | mocked `thailandLocation.findFirst`; asserted `body.province.id`/`body.district.id` against a SEPARATE `PROVINCE_ROW`/`DISTRICT_ROW` id-space | **UPDATED** — mock removed; `PROVINCE_ROW.id`/`DISTRICT_ROW.id` now literally alias `PROVINCE_NODE.id`/`DISTRICT_NODE.id` (same id-space, per the code change) | pins the retired shape; updated not loosened |
| `__tests__/cam-545-card-display.test.ts`, `cam-548-detail-location.test.ts`, `cam-573-location-display.test.ts`, `cam-576-detail-district-language.test.ts` | mocked `prisma.thailandLocation.findMany` to back `getProvinceThaiNameMap()` | **UPDATED** — mock swapped to `prisma.adminArea.findMany`; fixture rows re-shaped `{provinceNameEn,provinceName}` → `{nameEn,nameTh}`; one assertion's expected `where` clause updated to `{countryCode:'TH',level:'PROVINCE'}` | pins the retired shape; updated not loosened |
| `__tests__/cam-563-campsites-route-province-id.test.ts` | mocked `thailandLocation.findMany` (dead — `getProvinceThaiNameMap()`'s new `adminArea.findMany` call is now served by the SAME `mockAdminAreaFindMany` this file already declared for district/sub-district resolution) | **UPDATED** — dead mock removed; the shared `mockAdminAreaFindMany` (returns `[]`) now also backs the province-map call; no assertion in this file depended on call-count, verified before the change | cleanup, no behavior change |
| `__tests__/cam-553-location-write-path.test.ts` | declared a `thailandLocation.findUnique` mock, never invoked or asserted anywhere in the file (`app/api/location/route.ts` was already migrated by CAM-574) | **UPDATED** — dead mock declaration removed | cleanup, no behavior change |
| `__tests__/cam-554-map-pin-sync.test.ts` | comment describing `province`/`district`'s `.id` as staying "ThailandLocation ids" | **UPDATED** — comment corrected (they are AdminArea ids now; the component still never reads them, so the assertion itself needed no change) | doc accuracy only, no assertion changed |
| `__tests__/cam-574-retire-thailand-location.test.ts`, `cam-559-cascading-location.test.ts`, `cam-458-thailand-locations-data.test.ts`, `cam-553-thailand-hierarchy-import.test.ts`, `cam-216-sec-b-location-validation.test.ts`, `cam-503-landmark.test.ts`, `cam-563-location-route-admin-area.test.ts`, `cam-502-geo-proximity.test.ts`, `cam-404-search-campsites-province-resolve.test.ts`, `cam-525-icon-i18n-coverage.test.ts`, `cam-573-locations-search.test.ts`, `cam-458-province-resolve.test.ts`, `cam-463-thai-regions.test.ts`, `cam-209-rate1-abuse-hardening.test.ts`, `e2e/regression/ac5-create-camp.spec.ts` | mention `ThailandLocation`/`thaiLocation`/`thailandLocationRowSchema` only in comments, or import the static JSON seed-source file (unrelated to the DB table) | **NO-CHANGE** — re-verified via the narrower `\.thailandLocation\.` grep: zero matches in any of these | confirmed comment-only or JSON-file-only, not a DB reader |

## The id-space question this story does NOT reopen

CAM-574's tech.md documented an id-space landmine: `LocationPicker.tsx`'s `deriveValue()` never reads `.id` off the geocode-reverse response's `province`/`district` sub-objects for either input path (cascading-select uses its own picked row's `.id`; map-pin-drop uses the response's own top-level `adminAreaId` override) — confirmed again by source-inspection in this story (`components/LocationPicker.tsx`'s own doc comment, unedited). This means changing what id-space `province.id`/`district.id` carry (from `ThailandLocation.id` to `AdminArea.id`, this story's actual change) is safe for that consumer by construction — verified behaviorally by the unedited `cam-554-map-pin-sync.test.ts` (still green) and the updated `cam-554-geocode-routes.test.ts` (39/39 green).

## Migration — reversible, proven up → down → up on the local dev DB

`prisma/migrations/20260727050000_cam580_drop_thailand_location_table/migration.sql` (up) + `down.sql`. Hand-authored (same non-interactive convention as CAM-574's migration — `prisma migrate dev` refuses in this environment) against the real local dev DB, verified with `information_schema`/`pg_indexes` queries at every step (not just "it didn't error").

Real commands + output (this session, local dev DB):
```
$ prisma migrate deploy                     # UP
Applying migration `20260727050000_cam580_drop_thailand_location_table` ...
All migrations have been successfully applied.

$ node verify-table.mjs                     # (information_schema + pg_indexes query)
ThailandLocation table exists: false
provinceName_districtName index exists: false
provinceCode_districtCode unique index exists: false

$ prisma db execute --file down.sql         # DOWN
Script executed successfully.

$ node verify-table.mjs
ThailandLocation table exists: true
provinceName_districtName index exists: true
provinceCode_districtCode unique index exists: true

$ prisma db execute --file migration.sql    # UP again
Script executed successfully.

$ node verify-table.mjs
ThailandLocation table exists: false
provinceName_districtName index exists: false
provinceCode_districtCode unique index exists: false

$ prisma migrate status
Database schema is up to date!
```

No data backfill on `down` (BR-4 in story.md): the table's rows are fully superseded by `AdminArea` — the SAME source JSON (`prisma/data/thailand-locations.json`) already seeds the `AdminArea` tree, and by the time this migration ships, nothing reads `ThailandLocation` (BR-1, the reader inventory above). `down.sql` restores structure only (no FK — `Location`'s FK into this table was already dropped by CAM-574's own migration, `20260727010000_cam574_retire_thai_location_fk`, so re-adding it here would not match the actual pre-this-migration state).

## Chiang Mai canary — measured at every layer this story touched, BEFORE and AFTER

| Layer | Before | After | How verified |
|---|---|---|---|
| DB (`prisma.campSite.count`, real dev DB, no mocks) | **18** | **18** | ad-hoc script against the real DB, run before any code/schema change and again after migration + code changes + `npx prisma db seed` re-run |
| `ThailandLocation` row count (real dev DB) | 1007 (77 provinces + ~930 districts) | table dropped (n/a) | same ad-hoc script |
| `AdminArea` province-resolve (real dev DB, no mocks) | `{code:'50', nameTh:'เชียงใหม่', nameEn:'Chiang Mai'}` | same (unchanged — this layer was never touched, only re-confirmed) | ad-hoc script, real `prisma.adminArea.findFirst` |
| `resolveFromComponents` (geocode reverse-resolution, real dev DB, no mocks) | n/a (not yet migrated) | resolves `เชียงใหม่`→`Chiang Mai` / `เมืองเชียงใหม่`→`Mueang Chiang Mai`, `adminAreaId` = the district node's id | `__tests__/cam-580-chiang-mai-canary.test.ts` (real-DB-gated) |
| `getProvinceThaiNameMap()` (camp-card, real dev DB, no mocks) | n/a (not yet migrated) | 77 provinces, `Chiang Mai`→`เชียงใหม่` | `__tests__/cam-580-chiang-mai-canary.test.ts` (real-DB-gated) |
| `/api/locations/search`'s own query shape (real dev DB, no mocks) | unchanged (CAM-574's own layer, not touched by this story) | unchanged — re-confirmed, not re-migrated | `__tests__/cam-580-chiang-mai-canary.test.ts` (real-DB-gated) |
| Real camp full-chain render (`phra-nakhon-si-ayutthaya-meadow-camp-3-60-th`) | n/a (CAM-576's own AC, unaffected by table drop) | still renders `โคกม่วง, ภาชี, พระนครศรีอยุธยา` (SUBDISTRICT→DISTRICT→PROVINCE, Thai, no English "Phachi" leak) | `__tests__/cam-580-chiang-mai-canary.test.ts` (real-DB-gated) |

The catalog-filter path (`buildCampSiteWhere`/`resolveProvinceAdminAreaIds` in `lib/campsite-filters.ts`) is explicitly OUT OF BOUNDS for this story (never queried `ThailandLocation`) and stays covered by CAM-573's own `__tests__/cam-573-province-filter-parity.test.ts` (unedited, still green in the full suite run).

## Tests

`__tests__/cam-580-drop-thailand-location.test.ts` (new) — Section A: a LIVE repo-wide grep guard (walks `app/`, `lib/`, `components/`, `scripts/` at test-run time) asserting zero `.thailandLocation.` property accesses, plus a `prisma/seed.ts`-specific check. Section B: schema-level checks (`model ThailandLocation` gone, the migration folder + its up/down content). Section C: a mocked behavioral proof of `resolveFromComponents`'s new derivation (mock omits `thailandLocation` entirely — same "throws instead of silently no-ops" technique as CAM-574's own suite).

`__tests__/cam-580-chiang-mai-canary.test.ts` (new) — real-local-dev-DB-gated (`describe.skipIf(!process.env.DATABASE_URL)`, same precedent as `cam-575-coordinate-sync-invariant.test.ts`): the Chiang Mai canary as a NUMBER (18) at the DB / AdminArea-resolve / camp-card-province-map / reverse-geocode layers, plus the real 3-level camp's full location-chain render. SKIPS in the Postgres-less CI `quality-gate` job; RUNS for real on localhost, which is where this story's AC must be verified before merge (CLAUDE.md Definition of Done).

Updated in place (describe the new shape, never loosened): `cam-554-geocode-routes.test.ts` (mock removed, id-space fixtures re-aliased), `cam-545-card-display.test.ts`, `cam-548-detail-location.test.ts`, `cam-573-location-display.test.ts`, `cam-576-detail-district-language.test.ts` (all 4: mock swapped `thailandLocation.findMany`→`adminArea.findMany`), `cam-563-campsites-route-province-id.test.ts` (dead mock removed), `cam-553-location-write-path.test.ts` (dead mock removed), `cam-554-map-pin-sync.test.ts` (comment corrected only).

## Links
`app/api/geocode/_shared.ts` · `lib/read-models/camp-card.ts` · `prisma/schema.prisma` · `prisma/seed.ts` · `lib/geo/admin-area-match.ts` (reused, unchanged) · CAM-574 tech.md (the direct predecessor — "Why the ThailandLocation MODEL is not dropped") · CAM-573 tech.md · CAM-566 tech.md · `story.md`

## Changelog
- v1 (2026-07-27) — created
