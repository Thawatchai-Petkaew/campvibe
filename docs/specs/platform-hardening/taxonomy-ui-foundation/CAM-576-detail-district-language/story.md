## Story
As a **Camper**, I want the camp detail page's district and sub-district to render in the language I chose, so that I never see an English place name sitting beside a Thai province on the one page where I decide whether to book.
Why: CAM-573 moved the catalog and wishlist cards onto the id-derived `AdminArea` chain and closed this defect (CAM-567) everywhere except the detail page — its own data-fetch (`getCampBySlug`) and the test pinning its `include` shape both sat outside CAM-573's file surface, so it stopped and flagged rather than widening its own scope (tech.md "Known gap"). This story is that named follow-up.
Scope: extend `getCampBySlug`'s (`lib/catalog-cache.ts`) `location` include with the resolved `AdminArea` chain (`adminAreaChainSelect`, the same select `campCardSelect` and the wishlist page already use); update the one pinned assertion in `__tests__/cam-195-cache-catalog.test.ts` that encoded the old `location: true` shape. No new renderer — the page already calls the shared `buildLocationText`/`withProvinceThaiNames` seam CAM-573 built; it picks the enhancement up transparently the moment the row carries `adminArea`. `app/campgrounds/[slug]/page.tsx` and `components/CampgroundDetailClient.tsx` need no logic change (verified — see tech.md).
Depends on: CAM-573 (`buildLocationText`, `resolveLocationDisplayNames`, `withProvinceThaiNames`, `adminAreaChainSelect` — all reused verbatim, not reimplemented).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A Thai-language camper opens the detail page for a camp whose location resolved to DISTRICT depth or deeper (e.g. `phra-nakhon-si-ayutthaya-meadow-camp-3-60-th`) | The page renders | The location line shows the Thai district (and sub-district when resolved) beside the Thai province, e.g. `โคกม่วง, ภาชี, พระนครศรีอยุธยา` — never the English free-text district (`Phachi`) | `getCampBySlug` now includes `location.adminArea`; `withProvinceThaiNames`/`buildLocationText` derive `districtTh`/`subDistrictTh` from it instead of falling back to the raw `district` column | EC-1 |
| AC-2 | The same camp, English mode | The page renders | The location line shows the English district/sub-district beside the English province, e.g. `Khok Muang, Phachi, Phra Nakhon Si Ayutthaya` | Same id-derived chain, English fields (`districtEn`/`subDistrictEn`) | EC-1 |
| AC-3 | A camp whose location resolved to PROVINCE depth only (96 of 650 live camps) | The detail page renders | The location line shows the province alone, with no dangling leading or trailing comma | `resolveLocationDisplayNames` returns `districtTh`/`districtEn`/`subDistrictTh`/`subDistrictEn` all `undefined`; `buildLocationText`'s `filter(Boolean)` join drops the absent levels cleanly | EC-2 |
| AC-4 | A camp whose `Location.adminAreaId` is null (2 of 652 rows total; both confirmed orphans with no live `CampSite`, so unreachable via a real detail-page request) | — (no live route exercises this row) | N/A on the detail page itself; the pre-existing fallback (`withProvinceThaiNames`'s raw-province path) still applies defensively if ever reached | `resolveLocationDisplayNames(null)` returns `{}` — the same guarantee CAM-573 already proved | — (covered by CAM-573's existing null/undefined unit tests; no live camp can exercise this row on this page, so no new integration case is added here) |

## Rules
- BR-1 `getCampBySlug`'s `location` include carries `adminArea: { select: adminAreaChainSelect }` — the identical 3-level select `lib/read-models/camp-card.ts` already exports and `campCardSelect`/wishlist's page already use; no second select shape is defined (proves AC-1/AC-2).
- BR-2 The detail page's render path is unchanged: `app/campgrounds/[slug]/page.tsx` still calls `withProvinceThaiNames([campSite], provinceThaiNameMap)` exactly as before, and `components/CampgroundDetailClient.tsx` still calls the shared `buildLocationText(campground.location, language)` exactly as before — the fix is entirely in what `location` now carries, not in a second render implementation (proves the "no new renderer" scope line).
- BR-3 A level that did not resolve (district/sub-district absent) is omitted from the rendered line with no dangling comma or separator — the existing `buildLocationText` `filter(Boolean).join(', ')` behavior, unchanged (proves AC-3).

## Edge cases
- EC-1 IF the literal string `Phachi` (the English free-text district) appears anywhere in the Thai-mode render of `phra-nakhon-si-ayutthaya-meadow-camp-3-60-th`'s detail page THEN that is the regression this story exists to close — asserted as a negative test (BR-1)
- EC-2 IF a camp's chain resolved to PROVINCE depth only THEN the rendered location line contains no `,` character at all (BR-3)

## Data
- No schema change. `Location.adminAreaId` and `AdminArea.level`/`nameTh`/`nameEn`/`parentId` are pre-existing (CAM-553/563), already populated for 650 of 652 rows. This story only widens one Prisma `include` on an existing read; no migration.

## Seams & refs
- Reuse: `components/CampgroundCard.tsx`'s `buildLocationText` (render) · `lib/read-models/camp-card.ts`'s `resolveLocationDisplayNames`/`withProvinceThaiNames`/`adminAreaChainSelect` (derivation) — all CAM-573, called verbatim, no parallel implementation. Refs: ADR-004 (S5 multi-region / AdminArea), CAM-573 tech.md "Known gap" (the exact 1-line fix this story applies).
- Reader/writer sweep: only one reader changes — `lib/catalog-cache.ts`'s `getCampBySlug`. Every other location reader (`campCardSelect`, wishlist's page, `/api/locations/search`, catalog filters) was already migrated onto `AdminArea` by CAM-573 and is untouched here.

## Out of scope
- `lib/read-models/camp-card.ts`, `components/CampgroundCard.tsx`, `components/CatalogResults.tsx`, `app/wishlist/page.tsx`, `app/api/locations/search/**` — already correct (CAM-573), not touched.
- Deleting the raw free-text `Location.district`/`subDistrict` columns or the `district` field on `CampgroundCardData` — still written/kept for shape stability per CAM-573's scope; a future cleanup ticket, not this one.
- `CampSite.latitude/longitude`/`Location.lat/lon` — a different Backend story (CAM-575) is live on that surface concurrently.

## Self-verify
- AC-1/AC-2 → integration (`__tests__/cam-576-*.test.ts`) — mocked-Prisma-shaped fixture for `phra-nakhon-si-ayutthaya-meadow-camp-3-60-th`'s real DB values (district `Phachi`/`ภาชี`, sub-district `Khok Muang`/`โคกม่วง`, province `Phra Nakhon Si Ayutthaya`/`พระนครศรีอยุธยา`) through `withProvinceThaiNames` + `buildLocationText`, both languages
- AC-3 → unit, a province-only fixture asserting no `,` in the output
- AC-4 → covered by CAM-573's existing `resolveLocationDisplayNames(null)` unit test; not re-asserted here (no live route reaches it)
- EC-1 → negative assertion: `Phachi` absent from the Thai-mode render
- Source-inspect: `getCampBySlug`'s `include` shape carries `adminArea: { select: adminAreaChainSelect }` (guards the exact regression — removing it reproduces the bug)
- Story-specific: no migration (N/A); the cam-195 pinned assertion is updated (not deleted/loosened) to describe the new include shape
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-26) — created
