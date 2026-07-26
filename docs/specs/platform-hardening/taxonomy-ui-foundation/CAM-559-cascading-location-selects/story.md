## Story
As a **Host**, I want to pick my camp's province, district and sub-district from cascading searchable lists (typing in Thai), so that my camp is findable down to sub-district and I never have to guess spellings by hand.
Why: split out of CAM-554 so the Google Maps pin (blocked on a missing owner API key) does not block the half of the location rework that needs no key. CAM-553 already landed the data (77 province / 930 district / 7,452 sub-district rows in `AdminArea`, verified in the dev DB) and fixed the CREATE write path for `district` — this story builds the UI on top of that data and folds in CAM-556 (the same "form collects, API ignores" defect on the EDIT path CAM-553 found but could not fix, being outside that story's file surface).
Scope: replace `components/LocationPicker.tsx`'s flat single-search list (province-level rows only, no district/sub-district step) with three cascading, independently-searchable comboboxes (province → district → sub-district), each strictly narrowing the next. Persist `subDistrict` through the same POST `/api/location` seam CAM-553 built for `district`. Fix the camp EDIT path (`app/api/campsites/[id]/route.ts` PUT) so a submitted `district`/`subDistrict` actually reaches `Location.update` (CAM-556). No map pin, no lat/lng UI change (CAM-554, blocked on the owner's Google Maps key).
Depends on: CAM-553 (data + CREATE write path) · folds in CAM-556 (EDIT write path defect) · blocks CAM-554 (map pin + coordinates, separate ticket)

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Host is creating a new camp, no province chosen yet | Host opens the province combobox and types a Thai province name | Matching provinces appear in a searchable list | `GET /api/locations/search?type=province&q=<text>` returns matches (unchanged, existing endpoint) | — |
| AC-2 | Host has picked a province | Host opens the district combobox | Only that province's districts are offered (never all 930 nationwide) | `GET /api/locations/search?type=district&provinceCode=<code>` scopes the query; the district trigger is disabled until a province exists | EC-1 |
| AC-3 | Host has picked a district | Host opens the sub-district combobox and types a Thai sub-district name | Only that district's sub-districts are offered, matching the typed Thai text | `GET /api/admin-areas/subdistricts?districtCode=<code>&q=<text>` scopes to the district (AdminArea) | EC-2 |
| AC-4 | Host picks all three levels and saves a NEW camp | Host submits the create form | Camp saves; the picked location is stored | `Location.province`/`district`/`subDistrict` all persist via `POST /api/location` (subDistrict wired through CAM-553's seam) | EC-3 |
| AC-5 | Host previously saved district+sub-district on create, then opens the SAME camp to edit an unrelated field (e.g. price) | Host saves the edit | District and sub-district are still there after the save (not silently dropped) | `PUT /api/campsites/[id]` now writes `district`/`subDistrict` to `Location.update` alongside `province` (CAM-556 fix) | EC-4 |
| AC-6 | Host picks a NEW province after already having picked a district under the OLD province | Host picks the new province | The district and sub-district selections clear (never show a stale child of the old province) | Component state resets `selectedDistrict`/`selectedSubDistrict` to null on a province change | — |

## Rules
- BR-1 Each level's combobox is independently searchable; typing narrows that level's own list only (province search never returns districts; district search is always scoped to `provinceCode`; sub-district search is always scoped to `districtCode`) — proves AC-1/AC-2/AC-3.
- BR-2 The district combobox is disabled until a province is selected; the sub-district combobox is disabled until a district is selected (proves AC-2/AC-3, EC-1/EC-2).
- BR-3 Selecting a new province at any point resets the district and sub-district selections (never leaves a child selection that no longer belongs to the newly-picked parent) — proves AC-6.
- BR-4 `Location.province`'s stored value and derivation are BYTE-IDENTICAL to what CampgroundForm already produced before this story (`language === 'th' ? <Thai name> : <English name>`, sourced from the same `ThailandLocation` row) — `lib/campsite-filters.ts`'s exact-equality province filter, CAM-531's province dropdown, and CAM-545's Thai-name lookup (`ThailandLocation.provinceNameEn` match) all depend on this value never changing shape. This story does not touch `/api/locations/search`, `lib/campsite-filters.ts`, or `lib/read-models/camp-card.ts`.
- BR-5 `subDistrict` is optional free text (mirrors `district`'s CAM-553 contract): trimmed, max 100 chars, on both `POST /api/location` (create) and the `PUT /api/campsites/[id]` location sub-payload (edit) — proves AC-4/AC-5.
- BR-6 On the EDIT path, `province`/`district`/`subDistrict` are validated at the zod boundary before any write (previously read unvalidated off the raw body) — an explicit `""` clears the column to `null` (matches the CAM-341/CAM-360 clearing pattern); an omitted key is a true no-op skip — proves AC-5, EC-3/EC-4.
- BR-7 Sub-district data is read from `AdminArea` (province/district keep reading the existing `ThailandLocation`-backed `/api/locations/search`, untouched) — never the whole 7,452-row `SUBDISTRICT` level in one payload; every sub-district fetch is scoped to a `districtCode`.

## Edge cases
- EC-1 IF no province is selected yet THEN the district combobox is disabled and shows a "select a province first" hint, never an unscoped list of all districts (BR-2)
- EC-2 IF no district is selected yet THEN the sub-district combobox is disabled and shows a "select a district first" hint (BR-2)
- EC-3 IF a camp EDIT submits an explicit empty string for `district`/`subDistrict` THEN the column is cleared to `null` (BR-6)
- EC-4 IF a camp EDIT omits `district`/`subDistrict` from the body entirely (e.g. a price-only save) THEN neither column is touched (BR-6) — the exact CAM-556 defect, now fixed
- EC-5 IF the sub-district query has no districtCode (malformed request) THEN `GET /api/admin-areas/subdistricts` rejects with `400`, never an unscoped nationwide query (BR-7)

## Data
- `Location.district` / `Location.subDistrict` — both already exist (CAM-553); no migration. This story only wires `subDistrict` through the CREATE seam (already built) and fixes the EDIT seam (previously `province`-only).
- `AdminArea` — already fully populated by CAM-553 (77 `PROVINCE` / 930 `DISTRICT` / 7,452 `SUBDISTRICT`, verified in the dev DB); read-only in this story (no new rows written).
- No schema/migration change. `prisma migrate status` unaffected (verified — no new migration folder in this diff).

## Seams & refs
- Reuse: `/api/locations/search?type=province|district` (existing, untouched, ThailandLocation-backed) for the first two levels · `lib/validations/location.ts`'s `createLocationSchema` (extended with `subDistrict`, mirrors CAM-553's `district`) · the CAM-553/CAM-360 mocked-Prisma route-test pattern for the write-path Prove-It.
- New: `GET /api/admin-areas/subdistricts?districtCode=&q=` — the one AdminArea-backed read this story adds (ThailandLocation cannot hold a sub-district at all).
- Reader/writer inventory for `Location.district`/`subDistrict` (architecture.md §15b): writer `app/api/location/route.ts` POST (already fixed for `district` by CAM-553; `subDistrict` added here, same seam) · writer `app/api/campsites/[id]/route.ts` PUT (`Location.update`) — **FIXED here** (was `province`-only, the CAM-556 finding) · reader `lib/campsite-filters.ts` (`where.location.district` exact-match — unaffected, not in this story's diff) · reader `components/CampgroundForm.tsx` edit-prefill — extended to fall back to the raw stored `Location.district`/`subDistrict` (not just the `thaiLocation` FK relation), otherwise the CAM-556 fix could silently blank a real value on the very next edit save.
- Refs: CAM-553 (`tech.md`'s AdminArea-vs-ThailandLocation model decision, unchanged by this story) · CAM-531 (province dropdown, `Location.province` dependency) · CAM-545 (Thai-name lookup, `Location.province` dependency).
- Out of bounds (owned elsewhere): `prisma/schema.prisma`, `prisma/migrations/**`, `prisma/seed.ts`, `lib/campsite-filters.ts`, `lib/read-models/camp-card.ts`, `components/ai-chat/**`, `components/Navbar.tsx`, `DESIGN.md`, `app/globals.css`, `components/ui/**`, `scripts/check-*.mjs`.

## Out of scope
- Map pin + two-way lat/lng sync → CAM-554, blocked on the owner's Google Maps key (not in the environment).
- Recording the resolved `AdminArea` node onto `Location.adminAreaId` — the schema/tech.md decision explicitly leaves this as a CAN-CHOOSE-LATER option, not required for this story's AC; `province`/`district`/`subDistrict` stay atomic free text only.
- Backfilling existing camps' district/sub-district — unchanged from CAM-553's decision (blank, not guessed).

## Self-verify
- AC-1/AC-2/AC-3 → integration (`__tests__/cam-559-cascading-location.test.ts`: the existing `/api/locations/search?type=district` route proves province-scoping + a Thai search term reaches the district name match; the new `/api/admin-areas/subdistricts` route proves district-scoping + Thai search) + source-inspection (the component's `disabled={!selectedProvince}` / `disabled={!selectedDistrict}` guards)
- AC-4 → integration (`POST /api/location` — `subDistrict` reaches `prisma.location.create`'s data) + source-inspection (CampgroundForm sends `subDistrict: formData.subDistrict`)
- AC-5 → integration, **Prove-It (RED-first)**: `PUT /api/campsites/[id]` — district/subDistrict reach `prisma.location.update`'s data; verified RED against the pre-fix `province`-only block (confirmed by hand before writing the fix, same shape as CAM-553's Prove-It), GREEN after
- AC-6 → source-inspection (`setSelectedDistrict(null)` / `setSelectedSubDistrict(null)` fire inside the province-select handler)
- Story-specific: `lib/campsite-filters.ts` untouched (not in the diff) · `Location.province`'s stored value/derivation unchanged (same `language === 'th' ? ... : ...` expression, same `ThailandLocation` source, just relocated into the component) · full suite re-run as the last act (grepped `__tests__/` and `e2e/` for `LocationPicker`/`province`/`district` — one pre-existing test (`__tests__/menu-hover-contrast.test.ts` AC-loc-subtitle) and one e2e spec (`e2e/regression/ac5-create-camp.spec.ts`) pin the OLD flat single-search UI's exact copy/DOM shape; both are outside this story's allowed file surface — flagged to the orchestrator/QA rather than edited out-of-scope, see the PR body)
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-26) — created
