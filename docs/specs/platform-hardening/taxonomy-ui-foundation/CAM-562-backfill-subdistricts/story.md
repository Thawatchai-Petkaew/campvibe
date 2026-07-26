## Story
As a **Camper**, I want the camp I'm looking at to carry accurate district and sub-district data derived from its real coordinates, so that the map pin and location text I see are trustworthy, never fabricated.
Why: the owner asked that every camp carry data down to ตำบล and be pinnable on a map (2026-07-26). Measured on the dev DB before planning: 650 of 652 camps already have real, trustworthy lat/lon (none on the Bangkok default); 0 have a district or sub-district; CAM-563 has already resolved `Location.adminAreaId` to the PROVINCE level for all 650. The coordinates are the trustworthy source — deriving administrative levels FROM them (never the reverse) avoids inventing a location a camper would wrongly trust.
Scope: reverse-geocode each of the 650 real camps' stored coordinates (server-side, `GOOGLE_GEOCODING_API_KEY`), match the result bilingually against the AdminArea tree (reusing CAM-563's/CAM-554's matcher, not a third implementation), and advance `Location.adminAreaId` deeper (district, then sub-district) plus the free-text `district`/`subDistrict` columns for readers still on them. Dry-run mode first (reports the projection, makes the real Google calls, writes nothing), idempotent real run second. Never touches `Location.province` — a geocoder disagreement is reported, not applied. Does not touch `components/**`, `app/api/**`, `prisma/schema.prisma`/`migrations/**`, or `lib/campsite-filters.ts` (all out of this story's file surface; the province-filter regression check is a read-only verification, not a code change).
Depends on: CAM-563 (`Location.adminAreaId` populated at PROVINCE level for 650/652 rows — this story starts from that state) · CAM-554 (`app/api/geocode/_shared.ts`'s bilingual/hierarchical AdminArea matcher — the algorithm this story's backfill script reuses, via CAM-563's own already-ported plain-JS twin, `scripts/backfill-cam-563-location-admin-area.mjs`, imported directly since both are same-runtime `.mjs` modules).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | 650 real `Location` rows with lat/lon, 0 with a district or sub-district, `adminAreaId` at PROVINCE level for all 650 | The backfill script runs with `DRY_RUN=1` against the dev DB | No user-visible change (a data migration, dry-run reports only) | The script makes the real Google Geocoding calls, computes what it WOULD write per row, and reports projected fill rates (resolved-to-sub-district / resolved-to-district-only / mismatched / unresolved) and the total API-call count — **zero** `prisma.location.update` calls execute | EC-1 |
| AC-2 | The dry-run projection has been reviewed | The script runs for real (`DRY_RUN` unset) against the same DB | No user-visible change (a data migration) | Each row whose geocoded province agrees with its stored province gets `adminAreaId` advanced to the deepest AdminArea node resolved (sub-district ?? district ?? unchanged-at-province), plus `district`/`subDistrict` free-text populated from that node's canonical name; `Location.province` is never modified by this script | EC-2 |
| AC-3 | A row's reverse-geocoded province disagrees with its currently stored province-level AdminArea node | The real run processes that row | No user-visible change | The row is recorded in a province-mismatch report (id, stored province, geocoded province name) and **none** of its fields (`adminAreaId`/`district`/`subDistrict`) are written | EC-2 |
| AC-4 | A `Location` row has a null `lat` or `lon` (2 orphaned placeholder rows, no live camp) | The backfill runs (dry or real) | No user-visible change | The row is excluded from the candidate query entirely — left blank, never guessed | EC-3 |
| AC-5 | The real run has completed once | The script runs a second time against the same DB | No user-visible change | **Zero** rows are updated (idempotent — already-resolved rows are excluded from the candidate query) and zero *additional* Google Geocoding calls are made for rows whose response is already cached from the first run | EC-4 |
| AC-6 | The backfill has completed | A camper filters the camp catalog by a province name (e.g. Chiang Mai) | Results are unchanged from before the backfill (same non-zero count) | The province filter (`lib/campsite-filters.ts`'s existing string-OR-id match, untouched by this story) still returns its expected count — verified by a real count query against the dev DB, before and after | EC-5 |

## Rules
- BR-1 Matching is bilingual (Thai OR English, case-insensitive `equals`) and hierarchical (district scoped to its resolved parent province, sub-district scoped to its resolved parent district) — reused from CAM-563's ported matcher, never a `contains`/substring match (proves AC-2).
- BR-2 `adminAreaId` only ever advances **deeper**, under the SAME province node already stored (`adminAreaId` unchanged if the geocoded province disagrees) — never re-homed to a different province (proves AC-2/AC-3).
- BR-3 `Location.province` is never written by this script under any circumstance; a disagreement is recorded in the mismatch report only (proves AC-3).
- BR-4 `district`/`subDistrict` free-text values are derived from the resolved AdminArea node's canonical name, in the SAME language (Thai or English) the row's own stored `province` value is already in — never the raw, unnormalized string Google returned, and never a language mismatched against the row's existing `province` (proves AC-2).
- BR-5 A row whose geocoded province matches no AdminArea PROVINCE node at all, or whose Google call fails, is recorded with the reason and left otherwise unchanged — never a silent no-op (proves AC-2).
- BR-6 Reverse-geocode responses are cached (keyed by `Location.id`, one cache file per script-invocation pairing) so a dry run immediately followed by the real run reuses the same ~650 Google calls rather than re-billing them; idempotent re-runs against already-resolved rows make zero further calls (proves AC-1/AC-5).
- BR-7 Rows with a null `lat` or `lon` are never candidates (proves AC-4).

## Edge cases
- EC-1 IF `DRY_RUN=1` THEN no `prisma.location.update` call executes for any row, regardless of outcome (BR-6)
- EC-2 IF the geocoded province disagrees with the row's currently-stored province-level AdminArea node THEN the row is added to the mismatch report and none of its fields are written (BR-2/BR-3)
- EC-3 IF a `Location` row has a null `lat` or `lon` THEN it is excluded from the candidate query entirely (BR-7)
- EC-4 IF a row was already fully resolved (both `district` and `subDistrict` set) in a prior run THEN it is excluded from the candidate query and makes no Google call on a subsequent run
- EC-5 IF the Google Geocoding API call fails (network/HTTP/non-OK status) for a row THEN the row is recorded as failed with the reason, no fields are written for it, and the run continues to the next row (never aborts the whole batch)

## Data
- `Location.adminAreaId` (existing nullable FK) — advanced deeper (district/sub-district) for resolvable rows; never regressed.
- `Location.district` / `Location.subDistrict` (existing nullable free-text columns) — populated for the first time (currently null on all 652 rows) from the resolved AdminArea node's canonical name.
- `Location.province` — read only, never written by this script.
- No new column, no schema change, no migration (confirmed: this story's allowed surface excludes `prisma/schema.prisma`/`prisma/migrations/**`; `prisma migrate status` reports up to date before and after).

## Seams & refs
- Reuse: `scripts/backfill-cam-563-location-admin-area.mjs`'s `matchAdminAreaByName`/`normalizeAdminAreaName` (imported directly — both are same-runtime `.mjs` modules, no port needed this time) for the bilingual/hierarchical AdminArea match; the Google Geocoding HTTP call itself has no existing plain-JS twin (CAM-554's `callGoogleGeocode` lives in `app/api/geocode/_shared.ts`, TS, `app/api/**` — out of this story's file surface) so a small, documented, necessary duplicate of that fetch wrapper lives in this story's new script, same constraint CAM-563 already recorded for its own port. No `lib/geo/**` extraction was made: its only possible consumer would be this new `.mjs` script, which cannot import a `@/`-aliased TS module without a new tsx-based script-runner convention — out of this story's scope, so evaluated and declined rather than silently skipped or forced.
- Reader/writer sweep (architecture.md §15b — `Location.district`/`.subDistrict`/`.adminAreaId` reads/writes, search: `grep -rn "\.district\b|\.subDistrict\b" app/ lib/ components/ scripts/`, cross-checked against CAM-563's own inventory for `adminAreaId`):
  - `components/CampgroundCard.tsx`'s `buildLocationText` (CAM-545) — **NOW (activates, no code change)**. Its `district` branch was built and tested in advance for exactly this moment ("NOT YET POPULATED... wired through so the moment district data exists, it slots into the line with no further code change"); this backfill is what makes that branch render live for the first time. Its own doc comment already documents the known, pre-existing constraint that `district` has no separate Thai form and renders as-is in both languages — BR-4 (write in the row's own existing province language) narrows, but does not fully close, that gap; flagged for Frontend/QA visibility in the handoff, not a defect this story introduces or is scoped to fix.
  - `app/wishlist/page.tsx` (renders `campSite.location.district`) — **NO-CHANGE**, display-only, same activation as above.
  - `app/api/campsites/[id]/route.ts` PATCH (host edits `district`/`subDistrict` free text) — **NO-CHANGE, pre-existing gap noted only**: this path never touches `adminAreaId` even before this story (only `POST /api/location`'s create path does); a host edit after this backfill can drift `district` free text away from the `adminAreaId` this script set. Pre-existing, out of this story's file surface (`app/api/**`), not introduced here.
  - `lib/campsite-filters.ts`'s exact-equality `district` filter — **NO-CHANGE**, out of file surface, not exercised by any live caller today (no UI district selector exists yet).
  - `components/FilterModal.tsx`'s `district` passthrough — **NO-CHANGE**, out of file surface, dormant (no upstream UI sets it).

## Out of scope
- Fixing `app/api/campsites/[id]/route.ts`'s PATCH path to also re-resolve `adminAreaId` when a host edits `district`/`subDistrict` free text — pre-existing gap, out of file surface → follow-up ticket.
- Giving `district`/`subDistrict` a separate Thai/English column pair (would close `CampgroundCard.tsx`'s known mixed-language display gap fully) — a schema change, explicitly out of bounds for this story → follow-up ticket if the owner wants it closed.
- Wiring a live district-selection UI/filter — no UI consumes `district`/`subDistrict` for filtering today; out of this story's scope.

## Self-verify
- AC-1/AC-5 → unit (`__tests__/cam-562-geocode-backfill.test.ts`, fake-Prisma + mocked Google fetch, 30/30 green) + real dry-run against the dev DB (proved candidate-query correctness — 650 scanned — and cache-reuse across two real runs; see tech.md for why the LIVE Google round-trip itself is currently blocked externally)
- AC-2/AC-3/AC-4 → unit (bilingual Thai + English rows, mismatch row, null-coordinate row, all with fake Prisma) — proven correct against realistic Google-response fixtures; the real dev-DB run additionally proved 0 writes occur when every call fails (fail-safe, never a crash/partial write)
- AC-6 → real count query against the dev DB (`prisma.campSite.count` for `location.province = 'Chiang Mai'`) → **18**, unaffected (0 rows touched)
- Story-specific: migration — N/A, none created (data-only, verified via `prisma migrate status`)
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`; **the real geocode round-trip (fill rates, mismatch count) is blocked on an external Google Cloud Console credential fix — see tech.md — and remains to verify once that lands**

## Changelog
- v1 (2026-07-26) — created
- v1.1 (2026-07-26) — real dev-DB run surfaced `GOOGLE_GEOCODING_API_KEY`'s HTTP-referrer restriction is incompatible with server-side calls (Google Cloud Console config, not code) — every call denied; code/tests proven correct via mocks + the fail-safe path (0 writes) proven live; see tech.md for the full finding and the required fix
