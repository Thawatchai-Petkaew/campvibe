## Story
As a **Host**, I want my camp's location to be anchored to the AdminArea tree by id, so that the province filter, the card's Thai name, and the detail page keep working correctly no matter which language I saved the location in.
Why: owner asked why location is free text rather than an id (2026-07-26). The schema already agrees — `Location.adminAreaId` (`prisma/schema.prisma:236`) is the FK into the AdminArea tree, and the legacy field's own comment (`:239`) reads "pending migration to adminArea" — designed, then never done. Measured: `adminAreaId` was set on 12 of 652 rows; `province` free text on all 652. Every location defect this session (the mixed Thai/English columns CAM-559 found, CAM-545's name-based card lookup, `lib/campsite-filters.ts`'s silent-zero province match) traces to this one root cause.
Scope: backfill `Location.adminAreaId` for existing camps; move `lib/campsite-filters.ts`'s province filter and the campsites/AI-tool readers onto an id-aware match, additive alongside the existing string match; extend the location-create write path to resolve deeper than province when a district/sub-district was also typed. Keep every free-text column populated and correct throughout (no removal, no big-bang swap). Does not touch `components/SearchModal.tsx`, `components/CampgroundForm.tsx`, `components/LocationPicker.tsx`, `components/LocationMapPin.tsx`, `app/api/geocode/**` (CAM-554/CAM-561, both in flight elsewhere) or `app/actions/getSearchLocations.ts` / `app/actions/getCampSiteCount.ts` / `components/CatalogResults.tsx` (outside this story's file surface — see tech.md's reader inventory for why they are not wired this round).
Depends on: CAM-554's reverse-geocode resolver (`app/api/geocode/_shared.ts`, PR #640 open, not yet merged as of this story) — its `matchAdminArea`/`normalizeAdminName` algorithm is the one this story's backfill/route matcher faithfully ports (see tech.md's Seams section for why it is a port, not a shared import, and the planned consolidation).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | 652 existing `Location` rows, 12 already carrying `adminAreaId` | The backfill script runs against the dev DB | No user-visible change (a data migration, not a UI change) | Every resolvable row (matched bilingually against the AdminArea tree) gets `adminAreaId` set; an already-resolved row is never re-touched; an unresolvable row is reported, never silently left null | EC-1 |
| AC-2 | A camper filters the catalog by a province name (`?province=X`) | The catalog list loads | Results are the SAME camps as before (a camp is never silently missing) | `GET /api/campsites` resolves `X` to its AdminArea subtree first, then matches a camp by the legacy string OR the resolved id-set — the result COUNT for today's dev-DB data is unchanged (no bilingual drift exists yet), and would be higher (never lower) once a bilingual-mismatched camp exists | EC-2 |
| AC-3 | A host fills in province, district, and sub-district on the new-camp form and submits | The form saves | The camp saves normally (no visible change) | `POST /api/location` resolves `adminAreaId` to the DEEPEST level that matches (sub-district ?? district ?? province), not just province as before | EC-3 |
| AC-4 | A host's typed district/sub-district text does not match any AdminArea node under the chosen province | The form saves | The camp still saves normally | `adminAreaId` stops at the deepest level that DID match (never guesses the next level) — the free-text columns are written regardless | EC-3 |

## Rules
- BR-1 Matching is bilingual (Thai OR English, case-insensitive `equals`) and hierarchical (a district match is scoped to its resolved parent province; a sub-district match is scoped to its resolved parent district) — never a substring/`contains` match (proves AC-1/AC-3).
- BR-2 `adminAreaId` is always the DEEPEST level actually resolved: sub-district if it matched, else district, else province, else left `null` (proves AC-3/AC-4).
- BR-3 The free-text `province`/`district`/`subDistrict` columns are written and read exactly as before, on every path this story touches — no column is cleared, no reader loses its string-based fallback (proves AC-2's non-regression).
- BR-4 A row whose `province` value matches no AdminArea node at all is left with `adminAreaId: null` and is reported (id + value + whether a live camp is attached) — never a silent null (proves AC-1).

## Edge cases
- EC-1 IF a `Location.province` value matches no AdminArea PROVINCE node THEN the row is reported in the backfill's `unresolved` list with its id, stored value, and whether a live camp references it (BR-4)
- EC-2 IF the AdminArea resolution for an incoming province filter throws (DB error) THEN the catalog still returns results using the legacy string match alone — never a 500 (BR-3)
- EC-3 IF a host's typed district does not match any AdminArea node under the resolved province THEN `adminAreaId` stays at the province level (or district level if only sub-district failed) — never guesses, never null when a shallower level DID resolve (BR-2)

## Data
- `Location.adminAreaId` (existing nullable FK, `prisma/schema.prisma:236`, already indexed) — backfilled for existing rows; no new column, no schema change. Migration: **none** (data-only — confirmed: `prisma migrate status` before and after this story report "up to date", `prisma migrate dev --name cam-563-noop-check` reports "Already in sync, no schema change or pending migration was found", no new folder under `prisma/migrations/`).

## Seams & refs
- Reuse: CAM-554's `matchAdminArea`/`normalizeAdminName` algorithm (`app/api/geocode/_shared.ts`, PR #640, not yet merged) — ported (not imported cross-module: `.mjs` backfill script vs TS route, and the PR isn't merged into `dev` yet) into `scripts/backfill-cam-563-location-admin-area.mjs` and `app/api/location/route.ts`. Refs: none (no ADR — data-only backfill + additive query changes, not an architectural pattern change).
- Reader/writer sweep (architecture.md §15b) — see tech.md's reader inventory table for the full list, search method, and NOW/LATER/OUT-OF-SURFACE tag per reader.

## Out of scope
- Retiring the free-text `province`/`district`/`subDistrict` columns — follow-up once every reader is proven on the id (this story explicitly keeps both, BR-3).
- Wiring `app/actions/getSearchLocations.ts`, `app/actions/getCampSiteCount.ts`, and `components/CatalogResults.tsx`'s direct `buildCampSiteWhere` call onto the id — outside this story's allowed file surface (not listed in the dispatch); the additive `provinceAdminAreaIds` param on `buildCampSiteWhere` is ready for them to adopt in a follow-up ticket.
- Retrying `lib/read-models/camp-card.ts`'s Thai-name derivation to prefer the AdminArea id — investigated, found to ripple `campCardSelect`'s Prisma-derived payload type into `lib/read-models/ai-camp-card.ts` and `app/wishlist/page.tsx` (both outside this story's surface); the existing name-match already covers 650/650 real camps, so this is deferred to a follow-up scoped to touch all three files together.
- CAM-562 (backfill sub-districts from coordinates) — this story unblocks it (adminAreaId now exists to reconcile against) but does not implement it.

## Self-verify
- AC-1 → unit (`__tests__/cam-563-location-admin-area-backfill.test.ts`, fake-Prisma) + real run against the dev DB (before/after counts + unresolved list reported in the PR body)
- AC-2 → unit (`__tests__/cam-563-campsite-filters-province-id.test.ts` count-parity proof) + integration (`__tests__/cam-563-campsites-route-province-id.test.ts`)
- AC-3/AC-4 → integration (`__tests__/cam-563-location-route-admin-area.test.ts`)
- Story-specific: migration up/down — N/A (data-only, no migration created; verified via `prisma migrate status`/`migrate dev --name cam-563-noop-check`, see tech.md)
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-26) — created
