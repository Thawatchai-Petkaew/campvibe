## Story
As a **Host**, I want the province + district I enter for my camp to actually reach the database (and the full Thai administrative hierarchy to exist for the province/district/sub-district data CAM-554's cascading selects will read), so that my camp is findable by district/sub-district and the taxonomy the app searches against is complete for Thailand, not a 29-district sample.
Why: CAM-551 found the district the host types is silently discarded by the location create payload — a write-path defect, not unseeded mock data. This ticket is the DATA FOUNDATION half of the location-picker rework; the cascading-select UI + Google Maps pin is CAM-554 and depends on this.
Scope: import the full province/district/sub-district hierarchy as reference data (no schema migration — see `## Data`), fix the write path so a submitted `district` persists, leave existing camps' district/sub-district blank. No map/coordinate UI, no new cascading selects (CAM-554).
Depends on: CAM-551 (found the defect) · blocks CAM-554 (cascading selects + map pin)

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Host is creating a new camp and types a district into the location section | Host submits the form | The camp saves exactly as before (no visible change) | `Location.district` is persisted with the submitted string (was previously always `null`) | EC-1 |
| AC-2 | Host leaves the district field blank | Host submits the form | The camp saves as before | `Location.district` is stored `null` (no regression to the optional contract) | EC-2 |
| AC-3 | The full Thai administrative hierarchy has been imported | A developer/QA queries `AdminArea` | — (no UI in this story) | `AdminArea` holds 77 `PROVINCE` + ~930 `DISTRICT` + ~7,452 `SUBDISTRICT` rows, each with `nameTh`, `nameEn`, and an official DOPA-style code | EC-3 |
| AC-4 | A camp already existed before this story shipped | The migration/seed runs | The camp is unchanged | The existing ~650 camps' `Location.district`/`subDistrict` stay exactly as they were (`null`) — nothing is guessed/backfilled from province | — (explicit BR-4 default, no failure twin needed) |

## Rules
- BR-1 The `/api/location` POST payload accepts an optional `district` (string, trimmed, max 100 chars, mirrors `province`'s existing contract) and persists it verbatim to `Location.district` (proves AC-1/AC-2).
- BR-2 The full hierarchy import is idempotent (upsert on the official code) — running it twice produces the same row counts, never duplicates (proves AC-3).
- BR-3 `Location.province` keeps storing exactly what it stores today (the free-text province string) — `lib/campsite-filters.ts` matches it by exact equality and CAM-531's province dropdown + CAM-545's Thai-name lookup depend on that; this story does not change `province`'s write path or value shape.
- BR-4 Existing camps' `Location.district`/`subDistrict` are left `null` by this story — no province-based guess (proves AC-4).

## Edge cases
- EC-1 IF the submitted district exceeds 100 characters THEN the request is rejected `400` before any write (BR-1)
- EC-2 IF `district` is omitted entirely THEN the column is left untouched/`null` — never coerced to an empty string (BR-1)
- EC-3 IF the import script runs against a DB that already has partial rows (the pre-existing 29 real districts) THEN every pre-existing row is updated in place, not duplicated (BR-2, verified: re-running the seed twice produces identical counts)
- EC-4 IF a host later edits an existing camp's district (the PUT path, `app/api/campsites/[id]/route.ts`) THEN that path's `Location.update` still only writes `province` today — same defect class, **out of scope here** (file not in this story's surface), flagged as a follow-up finding in `## Out of scope`

## Data
- `Location.district` / `Location.subDistrict` — **no migration needed.** Verified against the live schema (not assumed): both columns already exist as atomic free-text fields on `Location`, present since the very first migration (`20260620112306_init`); `AdminArea`'s `AdminLevel` enum already includes `SUBDISTRICT` (added in `20260621130951_s5_multi_region`). `prisma migrate status` reports "Database schema is up to date!" (23 migrations) both before and after this story's changes — zero schema drift. This directly contradicts the ticket's framing that a new migration was required; see `tech.md` for the full finding + the model decision this replaces it with.
- `AdminArea` gains ~930 `DISTRICT` + ~7,452 `SUBDISTRICT` rows (was 77 `PROVINCE` + 29 `DISTRICT` + 0 `SUBDISTRICT`) via `prisma/seed.ts`'s existing upsert loop, extended one level deeper.
- `ThailandLocation` gains the full ~930 real districts (was 29 real + 77 province-only placeholders) via the SAME existing upsert loop — schema unchanged, just fed complete source data.
- Source dataset: `prisma/data/thailand-locations.json`, rebuilt from `kongvut/thai-province-data` (MIT license), `data/raw/{provinces,districts,sub_districts}.json`, dataset v2.0.0 (`CHANGELOG.md`, 2025-09-20), downloaded 2026-07-26. Codes derived to match the existing DOPA-style convention already used by this file (province 2-digit / district 4-digit / sub-district 6-digit) — cross-checked: 75/77 existing province rows already matched this source by code+name exactly; 2 English spellings were overridden to the RTGS two-word form (`Lop Buri`, `Phang Nga`) to keep the pre-existing CAM-458 pinned spelling-regression test green (kongvut spells them as one word).
- Real DB before/after (measured on the local dev DB, `campvibe`): `AdminArea` PROVINCE/DISTRICT/SUBDISTRICT = 77/29/0 → 77/930/7,452. `ThailandLocation` total rows 106 → 1,007. `CampSite` count unchanged at 650 (seed re-run twice, idempotent, no camp duplication). `Location.district` non-null count: 0 before and 0 after the seed (unchanged, per BR-4 — only NEW camps created after this story's API fix will populate it).

## Seams & refs
- Reuse: `prisma/seed.ts`'s existing `ThailandLocation`/`AdminArea` upsert loops (extended, not replaced) · `lib/validations/location.ts`'s `createLocationSchema` (extended with `district`, mirrors `province`) · the CAM-216/CAM-360 mocked-Prisma route-test pattern (`__tests__/cam-216-sec-b-location-validation.test.ts`, `__tests__/cam-360-logo-clear-persists.test.ts`).
- Refs: CAM-531's story explicitly documented (independently, before this ticket) that `Location.district` is never written by any seed path and removed the search modal's district control for exactly that reason — this story is the fix that makes CAM-531's "follow-up ticket, data-dependent" viable.
- Reader/writer inventory for `Location.district` (architecture.md §15b): writer `app/api/location/route.ts` POST (FIXED, this story) · writer `app/api/campsites/[id]/route.ts` PUT (`Location.update`, line ~162) still writes ONLY `province`, never `district` — same defect class, **NOT fixed here** (file outside this story's allowed surface) — flagged below · reader `lib/campsite-filters.ts` (`where.location.district = district`, exact-match filter, already wired, out of bounds to touch) · reader `components/CampgroundForm.tsx` (edit prefill, `initialData.location?.thaiLocation?.districtName`, unaffected by this change).
- Out of bounds (owned elsewhere): `components/LocationPicker.tsx`, `app/globals.css`, `DESIGN.md`, `scripts/check-*.mjs`, `components/CampgroundCard.tsx`, `lib/campsite-filters.ts`, `lib/read-models/camp-card.ts`.

## Out of scope
- **Finding, not fixed here:** `app/api/campsites/[id]/route.ts`'s PUT (edit) path only writes `province` on `Location.update` (line ~162), never `district` — the same "form collects, API ignores" defect on the EDIT path. Out of this story's allowed file surface (only `app/api/location/**` was in scope). → follow-up ticket.
- Cascading province→district→sub-district selects, Thai-language search, and the two-way Google Maps pin → CAM-554 (depends on this ticket's data + write-path fix).
- Backfilling the ~650 existing camps' district/sub-district (by reverse-geocode or otherwise) → explicit owner decision was blank, not guessed; a backfill is a separate, later ticket if ever wanted.
- Sub-district acceptance on `/api/location`/`createLocationSchema` — not added, because nothing submits it yet (`CampgroundForm` has no sub-district field/state today); CAM-554 adds the field and the corresponding schema/route acceptance together.

## Self-verify
- AC-1/AC-2 → integration (`__tests__/cam-553-location-write-path.test.ts`: mocked-Prisma POST /api/location asserts `district` reaches `prisma.location.create`'s `data`; Prove-It confirmed RED before the fix, GREEN after) + owner-verify (create a camp on localhost dev DB with a district typed, confirm the DB row via Prisma Studio/`SELECT`)
- AC-3 → unit (`__tests__/cam-553-thailand-hierarchy-import.test.ts`: exact counts + code-prefix consistency + uniqueness on `prisma/data/thailand-locations.json`) + real-DB verification (seed run twice against the dev DB, counts confirmed: see `## Data`)
- AC-4 → real-DB verification (measured `Location.district` non-null count stays 0 across the seed re-run; no camp row touched)
- Story-specific: migration reversibility — **no new migration exists** (verified: `prisma migrate status` reports "up to date" before and after; `prisma migrate dev --name cam-553-noop-check` reports "Already in sync, no schema change or pending migration was found" and creates no new migration folder). Full suite re-run as the last act (grepped `__tests__/` for `ThailandLocation`, `province`, `district` — `cam-458-thailand-locations-data.test.ts` re-verified green against the new 77/930/7,452 dataset).
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-26) — created
