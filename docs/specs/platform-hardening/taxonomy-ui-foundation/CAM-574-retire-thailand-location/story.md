## Story
As a **Host**, I want the platform's location write path to stop depending on the legacy `ThailandLocation` FK, so that the taxonomy migration the owner approved (CAM-553/559/563/566/573) reaches its intended end state — one conformant `AdminArea` hierarchy, not two parallel ones.
Why: owner decision — "phase B of the migration" (CAM-573 was explicitly scoped read-only, out-of-scope line: "Deleting `ThailandLocation` or `Location.thaiLocationId` — CAM-574 (phase B), gated on this story proving out"). This is the one story allowed to touch the FK/model.
Scope: move every in-bounds reader/writer of `Location.thaiLocationId`/`ThailandLocation` onto `Location.adminAreaId`/`AdminArea` (write path: `app/api/location/route.ts`, `components/LocationPicker.tsx`, `components/CampgroundForm.tsx`; search: `app/api/locations/search/route.ts`; display: `lib/spot-aggregation.ts`, `app/api/operator/dashboard/route.ts`, `app/dashboard/campsites/page.tsx`; AI resolve: `lib/ai/tools/search-campsites.ts`); remove the `Location.thaiLocationId` FK + index via a reversible migration; leave the `ThailandLocation` TABLE itself in place because two out-of-surface readers (`app/api/geocode/_shared.ts`'s reverse-geocode resolution, `lib/read-models/camp-card.ts`'s province Thai-name fallback) still query it directly, not via the retired relation. The free-text `province`/`district`/`subDistrict` columns are untouched (still written exactly as before).
Depends on: CAM-573 (this story's own out-of-scope line names it as the gate), CAM-563 (`Location.adminAreaId` backfill, `matchAdminArea`), CAM-566 (`lib/geo/admin-area-match.ts`).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A host creates a new camp and picks a province/district in the cascading location picker | They save the location step | No visible change — the picker behaves exactly as before | `LocationPicker.tsx` sends `adminAreaId` (an `AdminArea.id`) instead of the retired `thaiLocationId`; `POST /api/location` resolves it to the deepest level (walking district/sub-district free text as before) and writes `Location.adminAreaId` — no `thaiLocationId` column exists to write to | EC-1 |
| AC-2 | A host edits an existing camp's district/sub-district text fields | They save | The saved district/sub-district reach the camp's location, exactly as before (CAM-556 stays fixed) | `PUT /api/campsites/[id]` persists `district`/`subDistrict` on `Location` — this path never touched `thaiLocationId`/`ThailandLocation` and is unaffected by the retirement | EC-2 |
| AC-3 | A host opens the province/district combobox and types a Thai search term | The list renders | The matching province/district appears exactly as before | `/api/locations/search` matches against `AdminArea` and returns the `AdminArea.id` directly — no `ThailandLocation` bridge, no `ThailandLocation` read on this endpoint at all | EC-3 |
| AC-4 | A camper filters the catalog by `province=Chiang Mai` (or searches it in the AI chat, Thai or English) | The list/chat responds | The same 18 published Chiang Mai camps appear | Verified as a number at the DB layer (`campSite.count`) and at the migrated `AdminArea`-based Thai-name resolver layer (`lib/ai/tools/search-campsites.ts`'s `resolveProvinceForSearch`) — both unaffected by the FK removal (neither reads `Location.thaiLocationId`) | EC-4 |
| AC-5 | The `Location.thaiLocationId` column/FK/index | After this story's migration runs | No visible change to any camper/host-facing screen | The column, its FK constraint, and its index are dropped in a single reversible migration (proven up→down→up on the local dev DB); `ThailandLocation` the TABLE is not dropped (two out-of-surface direct readers still need it) | EC-5 |

## Rules
- BR-1 The client sends `adminAreaId` (an `AdminArea.id`), never a `ThailandLocation.id` — `createLocationSchema.adminAreaId` replaces `thaiLocationId` (backward-incompatible by necessity: the FK it pointed at no longer exists) (proves AC-1).
- BR-2 `POST /api/location` verifies the given `adminAreaId` actually exists in `AdminArea` before using it (FK-safety — never trusts the client id blindly); a stale/forged id resolves to `adminAreaId: undefined`, never a fabricated value (proves AC-1, EC-1).
- BR-3 The district/sub-district free-text walk (matching deeper than whatever level the client's `adminAreaId` already resolved to) is preserved unchanged in shape — only its starting point moves from a `thaiLocationId`→provinceCode lookup to the client-supplied `adminAreaId` directly (proves AC-1).
- BR-4 `/api/locations/search`'s response `id` is the real `AdminArea.id` — the `ThailandLocation` id-bridge CAM-573 built (because the FK still existed then) is removed in this story, along with the dead "no type" combined-search branch that only ever read `ThailandLocation` for a test's sake (proves AC-3).
- BR-5 The `ThailandLocation` MODEL/table is not dropped — `app/api/geocode/_shared.ts` and `lib/read-models/camp-card.ts` query it directly (never via the `Location` relation) and are outside this dispatch's file surface; only `Location.thaiLocationId`/its FK/its index are removed (proves AC-5; see tech.md "Known gap").

## Edge cases
- EC-1 IF a client sends an `adminAreaId` that does not exist in `AdminArea` THEN the write proceeds with `adminAreaId: undefined` (never a foreign-key violation, never a fabricated id) (BR-2)
- EC-2 IF an edit sends only `district`/`subDistrict` (no `province`) THEN only those columns are written — `adminAreaId` is never re-derived on edit (unchanged pre-existing behavior, not this story's concern) (BR-3)
- EC-3 IF `/api/locations/search` receives no/unrecognized `type` THEN it returns `[]` — never the removed `ThailandLocation` combined-search branch, never a 500 (BR-4)
- EC-4 IF the migrated `resolveProvinceForSearch`'s `AdminArea` lookup throws THEN it falls back to the raw value unchanged, never throws (unchanged fail-open behavior, now against `AdminArea` instead of `ThailandLocation`) (BR-4)
- EC-5 IF the migration is rolled back (down) THEN `Location.thaiLocationId`/its FK/its index are restored (column comes back NULL for every row — accepted, see tech.md) and rolling forward again (up) succeeds cleanly (BR-5)

## Data
- `Location.thaiLocationId` (column) + its FK (`Location_thaiLocationId_fkey`) + its index (`Location_thaiLocationId_idx`) — dropped. `ThailandLocation.locations` (the back-relation field) — removed (virtual, no SQL). `ThailandLocation` the model/table — unchanged, not dropped. Migration: reversible (up/down/up proven on the local dev DB — see tech.md for the real command output). No backfill needed (CAM-545 measured only 12/652 `Location` rows had this FK populated at all, and every one is superseded by `adminAreaId`, already at ~650/652 per CAM-573).

## Seams & refs
- Reuse: `lib/geo/admin-area-match.ts`'s `matchAdminArea` (CAM-566, unchanged) — `app/api/location/route.ts`'s district/sub-district walk keeps using it, only its starting node changes. `lib/read-models/camp-card.ts`'s `adminAreaChainSelect`/`resolveLocationDisplayNames` (CAM-573, unchanged, imported not edited) — reused by `lib/spot-aggregation.ts` and `app/api/operator/dashboard/route.ts` for the same bilingual-name derivation pattern. Refs: ADR-004 (S5 multi-region / AdminArea).
- Reader/writer sweep (architecture.md §15b) — full inventory + search method in tech.md.

## Out of scope
- Dropping the `ThailandLocation` model/table itself — blocked by two out-of-surface direct readers (`app/api/geocode/_shared.ts`, `lib/read-models/camp-card.ts`); a future story extending the file surface to those two files could close this.
- Removing the free-text `province`/`district`/`subDistrict` columns — `lib/campsite-filters.ts` matches `province` by exact string equality; not provably safe to remove without a fuller audit (see tech.md).
- Fixing `app/campgrounds/[slug]/page.tsx`'s own CAM-567 gap (still not on the id-derived chain) — a pre-existing, separately-tracked gap CAM-573 already flagged; unrelated to this story's FK removal.

## Self-verify
- AC-1/AC-2 → integration (`__tests__/cam-563-location-route-admin-area.test.ts` rewritten, `__tests__/cam-559-cascading-location.test.ts` updated, `__tests__/cam-574-retire-thailand-location.test.ts` new)
- AC-3 → integration (`__tests__/cam-573-locations-search.test.ts` rewritten, `__tests__/cam-574-retire-thailand-location.test.ts`)
- AC-4 → the Chiang Mai=18 canary, verified as a number at the DB layer and the migrated AdminArea-resolve layer (real dev DB, documented in the PR body) + unit (`__tests__/cam-404-search-campsites-province-resolve.test.ts`, `cam-458-province-resolve.test.ts`, `cam-463-search-campsites-region.test.ts`, `cam-502-geo-proximity.test.ts`, `cam-503-landmark.test.ts`, all updated)
- AC-5 → migration up/down/up proven on the local dev DB (real command output in the PR body)
- Story-specific: ownership — n/a (no new mutation surface, existing authz unchanged); every disallowed transition — an invalid/stale `adminAreaId` never writes a fabricated value (EC-1)
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-27) — created
