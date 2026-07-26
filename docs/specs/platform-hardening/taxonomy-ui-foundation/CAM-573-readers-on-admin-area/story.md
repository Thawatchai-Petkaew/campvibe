## Story
As a **Host** and **Camper**, I want every location reader (the host's cascading picker, the camp card, the detail page, the catalog filter, and the AI-chat tools) to read from the same `AdminArea` tree, so that a Thai user never sees a wrong-language district beside a Thai province, and the province filter never silently loses a camp.
Why: owner decision 2026-07-26 — "finish the location migration." `AdminArea` was designed under S5/ADR-004 as the conformant replacement for the flat `ThailandLocation`, and the schema comment has said "legacy — pending migration to adminArea" since it landed. CAM-553/CAM-559/CAM-563/CAM-566 each built one piece (the 3-level hierarchy, the cascading sub-district picker, the id backfill, the shared bilingual matcher) but were each told not to touch the working province/district picker or the card's rendering — this story is the one explicitly allowed to finish it.
Scope: move `/api/locations/search` (province + district) from `ThailandLocation` onto `AdminArea`, bridged back to a real `ThailandLocation.id` so `thaiLocationId` (still a live FK, write path untouched) never regresses; move the camp card + detail page's district/sub-district rendering from raw free text onto the id-derived bilingual chain (closes CAM-567); wire the existing `resolveProvinceAdminAreaIds` id-boost (built by CAM-563) into every catalog-filter reader that hadn't adopted it yet (`CatalogResults.tsx`, `getCampSiteCount.ts`, the `bulkAvailability` AI tool). Keep writing every free-text column exactly as before (`Location.province`/`district`/`subDistrict`, `thaiLocationId`) — this is a read-side migration only.
Depends on: CAM-563 (`resolveProvinceAdminAreaIds`, `Location.adminAreaId` backfill — 650/652 rows), CAM-566 (`lib/geo/admin-area-match.ts`, the shared bilingual matcher), CAM-559 (the cascading sub-district picker, `/api/admin-areas/subdistricts`).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A host opens the province combobox on the camp form | They type a Thai search term, e.g. `เชียงใหม่` | The matching province appears in the list exactly as before (no visible change) | `/api/locations/search?type=province` now matches against `AdminArea` instead of `ThailandLocation`; the returned `id` is still a real `ThailandLocation.id` so `thaiLocationId` keeps working | EC-1 |
| AC-2 | A host has picked a province and opens the district combobox | They type a Thai search term | Only districts under the chosen province appear, never all 930 nationwide | `/api/locations/search?type=district` matches against `AdminArea` scoped by `parentId`, bridged back to a real `ThailandLocation.id` | EC-2 |
| AC-3 | A Thai-language camper views a camp card whose location resolved to DISTRICT depth or deeper | The catalog/wishlist card renders | The district name is shown in Thai (e.g. `เมืองเชียงใหม่`) beside the Thai province name — never the raw English free-text value | `CampgroundCard.tsx`'s `buildLocationText` reads `districtTh`/`subDistrictTh` (derived from `Location.adminAreaId`'s AdminArea chain) instead of the raw `district` column | EC-3 |
| AC-4 | The same card in English mode | The card renders | The district/sub-district name is shown in English (e.g. `Mueang Chiang Mai`) beside the English province name | `buildLocationText` reads `districtEn`/`subDistrictEn` from the same id-derived chain | EC-3 |
| AC-5 | A camper filters the catalog by `province=Chiang Mai` (or its Thai name) | The list loads | The same 18 published Chiang Mai camps appear, at every layer (DB count, catalog page, wishlist, AI search) | `buildCampSiteWhere`'s existing `provinceAdminAreaIds` OR-boost (CAM-563) is now also supplied by `CatalogResults.tsx`, `getCampSiteCount.ts`, and the `bulkAvailability` AI tool — closing the gap where only `/api/campsites` and `searchCampsites` had adopted it | EC-4 |
| AC-6 | A camp's `Location.adminAreaId` is null (no live camp attached, per this story's data check) | Any reader that touches it defensively (e.g. a future card render) | Renders the raw `province` value alone, never a stray leading/trailing comma, never a thrown error | `resolveLocationDisplayNames`/`withProvinceThaiNames` return every id-derived field `undefined`, falling back to the pre-existing raw/name-based path | EC-5 |

## Rules
- BR-1 Province/district search-as-you-type matches `AdminArea.nameTh`/`nameEn` (case-insensitive `contains`, the existing autocomplete UX — never the exact-equality matcher CAM-566 built for a different problem shape) (proves AC-1/AC-2).
- BR-2 Every returned province/district row's `id` is a real `ThailandLocation.id` (bridged via the shared `code` value — verified 1:1 against the dev DB, 77/77 provinces + 930/930 districts, zero mismatch either direction) — never an `AdminArea.id` (proves AC-1/AC-2, protects `thaiLocationId`'s FK).
- BR-3 District search is always scoped to the given `provinceCode`'s AdminArea node — a missing/unresolvable `provinceCode` returns zero candidates, never the full 930-row table (proves AC-2).
- BR-4 `buildLocationText` renders "sub-district, district, province" using only the levels the id chain actually resolved (never guesses a deeper level); a card whose chain has no `adminArea` at all falls back to the pre-existing raw-value display for that level (proves AC-3/AC-4/AC-6).
- BR-5 `Location.province`/`district`/`subDistrict`/`thaiLocationId` are written by exactly the same paths as before this story — no write-path change (proves the "keep writing free text" scope line).

## Edge cases
- EC-1 IF an `AdminArea` province candidate has no matching `ThailandLocation` row (data drift; verified not to occur today) THEN it is dropped from the results and logged server-side — never returned with a fabricated id (BR-2)
- EC-2 IF `provinceCode` is missing on a `type=district` request THEN the endpoint returns `[]` immediately, never an unscoped nationwide `AdminArea` query (BR-3)
- EC-3 IF a camp's `adminAreaId` resolved only to PROVINCE depth THEN the card/detail render province-only — no district/sub-district line, never a wrong-language guess (BR-4)
- EC-4 IF the id-boost resolution throws (DB error) THEN the catalog/count/AI-tool read fails open to the legacy exact-string province match — never a 500, never a silently emptier result than before (BR-5's mirror on the filter side)
- EC-5 IF `Location.adminArea` is absent on a card's row (the 2 orphan rows with no live camp, or an older/narrower caller) THEN every id-derived field is `undefined` and the raw `province`/name-based lookup renders instead — never a crash, never `undefined, undefined` (BR-4)

## Data
- No schema change (`prisma migrate status` before/after this story: up to date; confirmed no new folder under `prisma/migrations/`). `Location.adminAreaId`, `AdminArea.parentId`/`level`/`nameTh`/`nameEn`/`code` — all pre-existing, populated by CAM-553/559/563. This story only reads them differently; no column added, no write path changed.

## Seams & refs
- Reuse: `lib/campsite-filters.ts`'s `resolveProvinceAdminAreaIds` (CAM-563, unchanged) — wired into 3 new callers. `lib/geo/admin-area-match.ts`'s `matchAdminArea` (CAM-566) was considered for `/api/locations/search`'s autocomplete and NOT reused — its exact-equality single-match shape doesn't fit a multi-candidate `contains` search; see tech.md. Refs: ADR-004 (S5 multi-region / AdminArea).
- Reader/writer sweep (architecture.md §15b) — full inventory + search method in tech.md.

## Out of scope
- Deleting `ThailandLocation` or `Location.thaiLocationId` — CAM-574 (phase B), gated on this story proving out.
- `components/LocationPicker.tsx` / `components/CampgroundForm.tsx` write paths, `app/api/location/route.ts` — untouched; `thaiLocationId` keeps flowing through them unchanged.
- The camp detail page's OWN data-fetch (`app/campgrounds/[slug]/page.tsx` → `getCampBySlug` in `lib/catalog-cache.ts`) — outside this story's file surface (neither file was listed, and `lib/catalog-cache.ts`'s `getCampBySlug` include shape is pinned by an existing test, `__tests__/cam-195-cache-catalog.test.ts`). The shared `buildLocationText`/`withProvinceThaiNames` enhancement is written so the detail page never regresses, but its own instance of CAM-567 is not fully closed by this story — see tech.md "Known gap" + follow-up CAM-575 (proposed).
- `lib/ai/tools/bulk-availability.ts`'s Thai-character `ThailandLocation` name resolution (the OTHER half of what `search-campsites.ts` does) — a deliberate CAM-465 scope-cut, not this story's concern; only the id-boost was added here.

## Self-verify
- AC-1/AC-2 → integration (`__tests__/cam-559-cascading-location.test.ts`, updated) + `__tests__/cam-573-locations-search.test.ts`
- AC-3/AC-4/AC-6 → unit (`__tests__/cam-573-location-display.test.ts`) covering the real distinct-province/district set, not one happy row
- AC-5 → unit/integration (`__tests__/cam-573-province-filter-parity.test.ts`) asserting **18** for Chiang Mai at every touched layer, as a number
- Story-specific: migration up/down — N/A (no schema change); ownership — n/a (no new mutation, read-only story)
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-26) — created
