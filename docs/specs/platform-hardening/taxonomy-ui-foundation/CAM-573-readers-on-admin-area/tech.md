---
feature: Platform hardening
epic: taxonomy-ui-foundation
persona: Host
artifact: tech
owner: backend-engineer
status: done
version: v1
updated: 2026-07-26
---
# Tech — Every location reader moves onto AdminArea (CAM-573)

## Ground-truth data check (measured against the real dev DB, before writing any code)

The ticket stated approximate counts from earlier in the day ("536 camps have a district, 519 a sub-district"). Re-measured at implementation time (`node --env-file=.env`, direct Prisma queries against the local dev DB):

```
Location rows total: 652
  adminAreaId populated: 650
  adminAreaId null:      2   (both province:"x", campSites: [], confirmed orphans, no live camp)

Among the 650 Location rows WITH a live CampSite attached:
  resolved to PROVINCE only:    96
  resolved to DISTRICT:         23
  resolved to SUBDISTRICT:     531
  (23 + 531 = 554 reach district-or-deeper)

Free-text column counts (for reconciliation):
  district    NOT NULL: 554   (exact match to the 554 above — zero divergence)
  subDistrict NOT NULL: 531   (exact match — zero divergence)

Chiang Mai province filter (the ticket's canary):
  campSite.count({ isActive:true, isPublished:true, deletedAt:null,
    location:{ province:'Chiang Mai' } }) = 18
```

The small drift from the ticket's stated numbers (536/519 vs the measured 554/531) is explained by CAM-562's coordinate-based backfill (PR #646) having merged into `dev` between when the ticket was written and when this story started — not a defect. Zero camps with a live `CampSite` have `adminAreaId: null`; zero camps have a free-text `district`/`subDistrict` value that AdminArea resolution *didn't* also reach — i.e. deriving district/sub-district display **purely** from the `adminAreaId` chain (never falling back to the raw free-text columns) loses no information for any real camp today.

## Reader/writer inventory — mandatory sweep (architecture.md §15b)

**Search method:** `grep -rn "ThailandLocation\|thailandLocation" app/ lib/ components/ scripts/ --include="*.ts" --include="*.tsx"` (every remaining reader of the legacy table) + `grep -rln "buildCampSiteWhere" app/ lib/ components/ --include="*.ts" --include="*.tsx" | grep -v __tests__` (every province-filter caller, to check which ones had NOT yet adopted CAM-563's `provinceAdminAreaIds`) + `grep -rln "withProvinceThaiNames\|getProvinceThaiNameMap\|campCardSelect" app/ lib/ components/` (every card/detail rendering path) + reading CAM-553/559/563/566's own tech.md "Reader/writer inventory" tables (they already named most of this story's targets as explicit follow-ups). Cross-checked against the ticket's own named list.

| Reader/writer | Touches location how | Action this story | Why |
|---|---|---|---|
| `app/api/locations/search/route.ts` (province+district picker) | `ThailandLocation.findMany` (`contains`, search-as-you-type) | **NOW** — rewritten to search `AdminArea`, bridged to a real `ThailandLocation.id` | the ticket's named scope item 1; the split this whole story exists to close |
| `app/api/admin-areas/subdistricts/route.ts` | `AdminArea.findMany` (sub-district, CAM-559) | **NO-CHANGE** | already on AdminArea; not part of this story's split |
| `lib/read-models/camp-card.ts` `campCardSelect`/`withProvinceThaiNames` | selects `location.province`/`district`; name-matches province via `ThailandLocation` | **NOW** — added `adminArea` (3-level chain select) + `resolveLocationDisplayNames`; `withProvinceThaiNames` (same exported name/signature — 2 out-of-surface callers depend on it, see "Known gap") now prefers the id-derived chain, falls back to the name-match only when `adminArea` is absent | the ticket's named scope item 2; closes CAM-567 |
| `components/CampgroundCard.tsx` `buildLocationText`/`CampgroundCardData` | renders `location.district` raw regardless of language | **NOW** — reads `districtTh`/`districtEn`/`subDistrictTh`/`subDistrictEn` (id-derived) with a graceful fallback to the raw value | the ticket's named root cause of CAM-567; shared by the card AND the detail page (`CampgroundDetailClient.tsx` imports this same function — no second implementation, confirmed no direct edit needed there) |
| `components/CampgroundDetailClient.tsx` | calls `buildLocationText(campground.location, language)` at 2 call sites, consumes the string only | **VERIFIED, NO-CHANGE** | the fix flows through the shared function; this file has no location-specific logic of its own to touch |
| `app/campgrounds/[slug]/page.tsx` + `lib/catalog-cache.ts`'s `getCampBySlug` | `include: { location: true }` (blanket scalar include, no `adminArea` relation) → calls the SAME `withProvinceThaiNames([campSite], ...)` | **KNOWN GAP, NOT CHANGED** | neither file is in this dispatch's allowed file surface, and `getCampBySlug`'s exact include shape is pinned by `__tests__/cam-195-cache-catalog.test.ts` (`toContain('location: true')`) — an out-of-surface test. Editing either would mean touching 2 files + 1 test file outside the stated surface for one remaining reader; STOP-RULE #3 applies. The detail page does NOT regress (its `campSite.location.adminArea` is simply absent, so `withProvinceThaiNames` gracefully falls back to the pre-existing name-based/raw-district display) — but its own instance of CAM-567 (wrong-language district) is NOT closed by this story. Fix is a 1-line addition: `location: { include: { adminArea: { select: adminAreaChainSelect } } }` in `getCampBySlug`, zero change needed to `page.tsx` itself (its existing `withProvinceThaiNames([campSite], provinceThaiNameMap)` call picks up the enhancement transparently). Recommend a fast-follow ticket or amending this story's surface. |
| `lib/read-models/ai-camp-card.ts` `aiCampCardSelect`/`toAiCampCard` | spreads `campCardSelect` verbatim; `AiCampCard.location` re-narrows to `{province:string}` | **VERIFIED, NO-CHANGE NEEDED** | `Omit<AiCampCardPayload,'location'>` discards the widened `location` key entirely before re-adding the narrow shape — confirmed structurally immune to `campCardSelect`'s new `adminArea` field (the exact ripple CAM-563 deferred on; it turned out to be a non-issue). `npm run typecheck` confirms 0 errors from this file. |
| `components/ai-chat/AiChatCampCard.tsx` | renders `card.location.province` only, no district, out of this story's file surface | **NO-CHANGE, not touched** | doesn't render district today; nothing to fix here even if it were in-surface |
| `lib/campsite-filters.ts` `resolveProvinceAdminAreaIds`/`buildCampSiteWhere` | already accepts `provinceAdminAreaIds` (CAM-563) | **VERIFIED, NO-CHANGE NEEDED** | the mechanism already exists; only new CALLERS were needed |
| `app/api/campsites/route.ts` (cursor "load more") | already calls `resolveProvinceAdminAreaIds` (CAM-563) + already uses `campCardSelect`/`withProvinceThaiNames` | **INHERITS AUTOMATICALLY, NOT EDITED** | reuses the shared `campCardSelect` constant and `withProvinceThaiNames` function this story extended — the widened select/function ripple in for free, no edit to this file |
| `lib/catalog-cache.ts` `getDefaultCatalog` (cached default homepage catalog) | already uses `select: campCardSelect` | **INHERITS AUTOMATICALLY, NOT EDITED** | same reuse as above — the cached default catalog gets `adminArea` + the enhanced derivation with zero code change |
| `components/CatalogResults.tsx` (SSR first page + live/filtered branch) | calls `buildCampSiteWhere` directly, did NOT supply `provinceAdminAreaIds` | **NOW** — resolves it before calling `buildCampSiteWhere`, mirroring `app/api/campsites/route.ts`'s exact pattern | the ticket's named scope item; closes the gap CAM-563's own tech.md flagged as a follow-up |
| `app/actions/getCampSiteCount.ts` (FilterModal live count preview) | calls `buildCampSiteWhere(filters)` directly, did NOT supply `provinceAdminAreaIds` | **NOW** — resolves it when `filters.province` is a string | same reason; the previewed count must match what the apply button will return |
| `app/actions/getSearchLocations.ts` (province dropdown, distinct list) | `buildCampSiteWhere({})` — no `province` param at all | **VERIFIED, NO-CHANGE NEEDED** | not a province-matching reader; lists distinct values that already have a camp, unaffected either way |
| `lib/ai/tools/search-campsites.ts` | already calls `resolveProvinceAdminAreaIds` (CAM-563) | **VERIFIED, NO-CHANGE NEEDED** | already migrated |
| `lib/ai/tools/bulk-availability.ts` | calls `buildCampSiteWhere` directly, did NOT supply `provinceAdminAreaIds` (a documented CAM-465 scope-cut also skips the separate Thai-name `ThailandLocation` resolution — NOT this story's concern) | **NOW** — added the SAME id-boost `search-campsites.ts` has, additively, alongside (not replacing) the existing scope-cut | the ticket's named "any AI-chat tool that filters by location"; closes the id-boost gap without touching the separate, deliberate Thai-name-resolution scope-cut |
| `lib/ai/tools/check-availability.ts`, `compare-camps.ts`, `get-camp-detail.ts`, `my-bookings.ts`, `my-profile-wishlist.ts` | no province/district matching logic (get-camp-detail.ts reads `location.province`/`region` for ONE already-known camp, display-only) | **NO-CHANGE** | not part of the silent-zero failure mode (no filter/match logic to migrate) |
| `components/LocationPicker.tsx`, `components/CampgroundForm.tsx`, `app/api/location/route.ts` | write paths; `thaiLocationId` FK | **OUT OF BOUNDS, not touched** | explicitly excluded by the dispatch; `/api/locations/search`'s response shape/`id` semantics were designed to keep these working unchanged (see "The id-bridge" below) |

## The id-bridge — why `/api/locations/search` still returns a `ThailandLocation.id`

`components/LocationPicker.tsx`'s `deriveValue()` sets `thaiLocationId: district?.id || province?.id || ''` directly from this endpoint's response `id` field, and that value is submitted to `POST /api/location` as `thaiLocationId` — a real `String? @relation` FK to `ThailandLocation` (`prisma/validations/location.ts`'s `z.string().uuid()`), still read by that route (`prisma.thailandLocation.findUnique({where:{id:thaiLocationId}})`, out of this story's surface, unedited). If this endpoint's matching moved onto `AdminArea` and started returning `AdminArea.id` values, `thaiLocationId` would silently start carrying an id that does not exist in `ThailandLocation` — a real FK-integrity regression, invisible until the write path's own `tl` lookup returned `null` and quietly degraded.

Fix: the SEARCH/MATCH itself now runs against `AdminArea` (bilingual, one source with sub-district), but each matched candidate is bridged back to its `ThailandLocation` counterpart via the shared `code` value. Verified empirically before writing any matching code (not assumed):

```
AdminArea PROVINCE codes vs ThailandLocation provinceCode (districtCode=''): 77 vs 77, 0 mismatch either direction
AdminArea DISTRICT codes vs ThailandLocation districtCode:                   930 vs 930, 0 mismatch either direction
```

This is the SAME pattern `app/api/geocode/_shared.ts`'s `resolveFromComponents` (CAM-554/566) already established for the identical problem shape ("the id-first path is the AdminArea node, strings/ids are DERIVED from it via a `ThailandLocation` join, never the other way round") — reused here, not reinvented. A province lookup uses `findUnique({where:{countryCode_level_code:{...}}})`, the same compound-unique access `app/api/location/route.ts`'s write path already uses (kept consistent, and avoids needing a `findFirst` mock key not already present in the existing test's `vi.mock('@/lib/prisma', ...)` block).

**Why `lib/geo/admin-area-match.ts`'s `matchAdminArea` (CAM-566) was NOT reused here:** that function does a single, exact-equality (`equals`, never `contains`) resolution of ONE free-text value to ONE node — built for resolving a host-typed district/sub-district string or a geocoder result. This endpoint needs the OPPOSITE query shape: search-as-you-type, `contains`, returning UP TO 20 candidates. Force-fitting the exact matcher would mean calling it once per keystroke-narrowed candidate (N+1) or not being able to use it at all for partial text — a different problem, not a fork of the same one.

## API contract

No new endpoint; response shape and query params of `GET /api/locations/search` are unchanged (`?type=province|district&q=&provinceCode=`), still returning `LocationSearchRow[]` matching `thailandLocationRowSchema` (`lib/validations/location.ts`, reused as the TypeScript type via `z.infer`, never re-declared) — the exact shape `components/LocationPicker.tsx`'s `ThailandLocationRow` interface expects. Error codes unchanged: `500` generic (`{error:'Failed to fetch locations'}`, no detail leak — RISK-9 precedent preserved). No authz dimension (public reference data, matches the pre-existing endpoint).

`buildCampSiteWhere`/`resolveProvinceAdminAreaIds` (`lib/campsite-filters.ts`) — unchanged, zero edits; only 3 NEW callers (`CatalogResults.tsx`, `getCampSiteCount.ts`, `bulk-availability.ts`) now supply the already-existing, additive `provinceAdminAreaIds` param.

## Chiang Mai canary — measured at every layer this story touched

| Layer | Count | How verified |
|---|---|---|
| DB (`prisma.campSite.count`, direct query) | **18** | ad-hoc script, `--env-file=.env`, real dev DB |
| `lib/campsite-filters.ts` `buildCampSiteWhere({province:'Chiang Mai'})` (unit) | **18** | `__tests__/cam-573-province-filter-parity.test.ts` |
| `components/CatalogResults.tsx`'s live branch (integration, mocked Prisma returning the real 18-row fixture) | **18** | same test file |
| `app/actions/getCampSiteCount.ts` (integration, mocked Prisma) | **18** | same test file |
| `lib/ai/tools/bulk-availability.ts` (integration, mocked Prisma) | **18** candidate rows before the availability projection | same test file |

Before this story's `CatalogResults.tsx`/`getCampSiteCount.ts`/`bulk-availability.ts` changes, all 3 already returned 18 too (the legacy exact-string match alone is correct for every camp stored in English, which is 100% of the dev DB's `Location.province` values today, per CAM-563's own tech.md) — the id-boost is a **future-proofing, non-regressing addition** (BR-5's fail-open guarantee), not a fix to an already-broken count. The number is asserted as-is, not claimed to have "changed."

## ADRs

No new ADR — this story is a read-side migration onto an already-accepted data model (S5/ADR-004's AdminArea tree, CAM-553's model decision, CAM-563's id-first-then-ThailandLocation-join pattern). No new architectural pattern introduced.

Confirmation: `__tests__/cam-573-locations-search.test.ts` (province/district search now AdminArea-sourced, id-bridge correctness) + `__tests__/cam-573-location-display.test.ts` (district/sub-district bilingual rendering, real-dataset coverage not one happy row) + `__tests__/cam-573-province-filter-parity.test.ts` (the 18-Chiang-Mai canary at every touched layer) + `__tests__/cam-559-cascading-location.test.ts` (updated in place — the ONE pre-existing test whose assertions pinned the now-changed `type=district` call shape; every other pre-existing test file — `cam-545-card-display.test.ts`, `cam-548-detail-location.test.ts`, `cam-523-url-param-contract.test.ts`, `cam-465-bulk-availability.test.ts` — passes unedited, confirmed by reading each one's exact mocks/assertions before writing code, not by assumption).

## Known gap (flagged, not silently dropped)

The camp detail page's own data-fetch (`app/campgrounds/[slug]/page.tsx` → `lib/catalog-cache.ts`'s `getCampBySlug`) is outside this dispatch's allowed file surface, and `getCampBySlug`'s exact `include` shape is pinned by an out-of-surface test (`__tests__/cam-195-cache-catalog.test.ts`, `toContain('location: true')`). This story could not close CAM-567 for that ONE surface without touching 2 files + 1 test file beyond the stated dispatch surface — STOP-RULE #3 ("never touch a file outside this dispatch's stated surface") was applied. The detail page does not regress (the shared `buildLocationText`/`withProvinceThaiNames` functions gracefully fall back to the pre-existing behavior when `adminArea` is absent from a row), but its district/sub-district line still shows the pre-existing raw free-text value. Recommended follow-up (1-line production change, zero risk): add `adminArea: { select: adminAreaChainSelect }` inside `getCampBySlug`'s `location: { include: {...} }` and update `cam-195-cache-catalog.test.ts`'s pinned string; `app/campgrounds/[slug]/page.tsx` itself needs NO edit (its existing `withProvinceThaiNames([campSite], provinceThaiNameMap)` call already picks up the enhancement transparently).

## Links
`lib/read-models/camp-card.ts` · `app/api/locations/search/route.ts` · `lib/campsite-filters.ts` · `app/api/geocode/_shared.ts` (CAM-554/566, the id-bridge precedent) · CAM-563 tech.md · CAM-566 tech.md · `story.md`

## Changelog
- v1 (2026-07-26) — created
