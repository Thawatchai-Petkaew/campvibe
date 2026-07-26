## Story
As a **Camper** browsing the camp detail page in Thai, I want the location line to show my chosen language and never the country, so that I can trust what I'm reading without seeing a stray English word.
Why: CAM-545 fixed this exact defect on the camp card (English-only `, Thailand` literal) but explicitly left `components/CampgroundDetailClient.tsx` out of scope (its own `## Out of scope`) — the same hardcoded literal exists at 2 call sites there. Separately, the owner changed the requirement on 2026-07-26: show `district, province`, never the country ("User รู้อยู่แล้ว").
Scope: `components/CampgroundDetailClient.tsx` (the 2 call sites that build the location text) · `app/campgrounds/[slug]/page.tsx` (the detail page's data fetch, extended additively to attach the Thai province name via the existing CAM-545 seam). Does NOT touch `components/CampgroundCard.tsx`, `lib/read-models/camp-card.ts`, or `lib/campsite-filters.ts`.
Depends on: CAM-545 (the `buildLocationText`/`getProvinceThaiNameMap`/`withProvinceThaiNames` seam this story reuses verbatim, no second implementation) · CAM-531 (province dropdown reads `Location.province` — the field this story must not disturb) · CAM-553 (import path for `Location.district`; district is still `null` on every camp today)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A Thai-language user views the detail-page header line for a camp whose `Location.province` (English) matches a real Thai province by name | The page renders | `นราธิวาส` (the Thai province name alone, in the header subtitle next to the rating — no country, never the literal `Thailand`) | The header location text resolves via the CAM-545 name-based lookup (`getProvinceThaiNameMap`/`withProvinceThaiNames`), attached in the page's data fetch; `Location.province` itself is read-only, unchanged | EC-1 |
| AC-2 | An English-language user views the same header line | The page renders | `Narathiwat` (the English province alone, no country) | Same underlying data; the pre-existing English province value, with the country word dropped entirely | — (mirrors AC-1, no failure twin) |
| AC-3 | A Thai-language user views the "Where you'll be" map section's location row | The page renders | `นราธิวาส` (no country) | Same `locationText` value reused for the map section's row (single source, not a second copy of the logic) | EC-1 |
| AC-4 (v2) | A camp's `Location.district` is populated (not true for any camp today, per CAM-545 BR-8) | Either location line renders | `<district>, <province>` (e.g. `เมืองนราธิวาส, นราธิวาส`) | The location line prefixes the district when present, exactly as the camp card already does; unaffected when absent | EC-2 |

## Rules
- BR-1 Both call sites on this page (the header subtitle, the map-section row) render through the SAME `buildLocationText(campground.location, language)` call already exported by `components/CampgroundCard.tsx` (CAM-545) — no second implementation, no re-derived string (proves AC-1/AC-2/AC-3).
- BR-2 The country is NEVER rendered on the detail page (owner requirement, 2026-07-26: "User รู้อยู่แล้ว") — no literal `Thailand` anywhere in `components/CampgroundDetailClient.tsx` (proves AC-1/AC-2/AC-3).
- BR-3 The header subtitle keeps its existing `campground.address ||` fallback precedence — when an explicit address string is set, it still wins over the localized province/district text (unchanged behavior; the fallback branch alone changes, not the precedence).
- BR-4 `Location.province` is NEVER changed, renamed, or reshaped by this story — `lib/campsite-filters.ts`'s exact-equality province filter and CAM-531's province dropdown both depend on its current stored (English) value.
- BR-5 The detail page's data fetch (`app/campgrounds/[slug]/page.tsx`) attaches `provinceTh` the same way the card's read models do — `getProvinceThaiNameMap()` + `withProvinceThaiNames([campSite], map)` — reusing the CAM-545 lookup verbatim, not a parallel query.

## Edge cases
- EC-1 IF `Location.province` has no match in the seeded province dataset (an unmapped/placeholder value) THEN the TH-mode text falls back to the raw `Location.province` value rather than throwing or blanking the line (inherited from CAM-545 BR-1, unchanged here).
- EC-2 IF `Location.district` is absent (true for every camp today) THEN both location lines render province-only, with no dangling separator or stray comma (inherited from CAM-545 BR-8/EC-4, unchanged here — `buildLocationText` already guards this).

## Data
- `Location.province` (existing column) — READ-ONLY, unchanged. `Location.district` (existing column, currently `null` on all rows) — already selected by `getCampBySlug`'s `include: { location: true }` (full row), so no select change was needed on the detail path; only the RENDER side (`buildLocationText`) needed wiring. `ThailandLocation` (existing table, 77 province-level rows, CAM-458) — READ by the existing `getProvinceThaiNameMap()` lookup, now also called from this page. No schema change; no migration.
- Measured coverage (dev DB, same dataset CAM-545 measured 2026-07-26): 650 of 650 real `CampSite` rows resolve a Thai province name via the shared name-based match; 77 of 78 distinct `Location.province` values match (the sole miss, `'x'`, is an orphaned `Location` row with zero live `CampSite` attached) — this story reuses that exact lookup unchanged, so the same coverage number applies to the detail page.

## Seams & refs
- Reuse: `buildLocationText` (exported from `components/CampgroundCard.tsx`, CAM-545) is imported directly into `components/CampgroundDetailClient.tsx` — no parallel/re-derived location-text function. `getProvinceThaiNameMap`/`withProvinceThaiNames` (`lib/read-models/camp-card.ts`, CAM-545) are imported directly into `app/campgrounds/[slug]/page.tsx`'s data fetch — the same name-based seam the card/catalog/wishlist call sites already use, extended additively (never mutated) to this fourth call site.
- Refs: CAM-545 (`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-545-card-display/story.md`, `## Out of scope` names this exact file as the deferred follow-up) · CAM-531 (province dropdown, the field this story must not disturb) · CAM-553 (`Location.district` import path).

## Out of scope
- Populating `Location.district` for any camp — that is host-data entry / a backfill, not a display-layer story (unchanged from CAM-545's own out-of-scope).
- Any other field on the detail page (price, amenities, taxonomy, reviews) — this story touches only the two location-text call sites and the data fetch that feeds them.

## Self-verify
- AC-1, AC-2, AC-3, AC-4 → unit: `buildLocationText`'s own exhaustive coverage already exists (`__tests__/cam-545-card-display.test.ts`, unchanged, not re-tested here) + `__tests__/cam-548-detail-location.test.ts` proves the WIRING — `grep -c 'Thailand' components/CampgroundDetailClient.tsx` → 0, both call sites use the shared `locationText` variable, the page's data fetch calls `getProvinceThaiNameMap`/`withProvinceThaiNames` before `serializeDecimals`, and a behavioral replay of the real 78 distinct `Location.province` values (imported from the same `prisma/data/thailand-locations.json` fixture CAM-545 uses) through the actual imported functions confirms 77-of-78 resolve in this call path too — not just one happy row.
- Story-specific: `components/CampgroundCard.tsx` untouched (not in the diff, reused via import only) · `lib/read-models/camp-card.ts` untouched (reused via import only) · `Location.province`'s stored value/shape unchanged · full suite re-run as the last act (grep for `Thailand` across `__tests__/` + `e2e/`).
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-26) — created (follow-up to CAM-545's own `## Out of scope` line + the owner's district/no-country requirement change).
