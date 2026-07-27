---
feature: Platform hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: tech
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-27
---
# Tech — Align mismatched provinces and fill the missing accommodation types (CAM-583)

## Data model

**No migration.** `Location.lat/lon/adminAreaId/district/subDistrict`, `CampSite.latitude/longitude`, and `CampSite.accommodationTypes` all already exist on the schema. `prisma migrate status` confirmed up to date before and after; `git status --short prisma/migrations/ prisma/schema.prisma` is empty. Both corrections are script-only.

## Correction 1 — province alignment (`scripts/backfill-cam-583-align-provinces.mjs`)

### Candidate identification — CAM-562's own classification, not new logic

`identifyProvinceMismatches` calls CAM-562's `runBackfill(prisma, {dryRun:true, cache})` and reads its `provinceMismatch` array — zero new classification. Real scan against the dev DB (reusing CAM-562's frozen `cam-562-geocode-cache.json`, one leftover uncached candidate from pre-flight reconnaissance): **83 candidates, 0 fresh identification calls needed beyond that one** — exact match to the ticket's stated dev count.

Staging has never been scanned by CAM-562 (confirmed: `prisma.location.count({where:{lat:{not:null},lon:{not:null},OR:[{district:null},{subDistrict:null}]}})` → 146 of 797 rows are still candidates for CAM-562's own classification, vs. 679/797 already carrying a `district`). Identifying staging's mismatches therefore costs one live reverse-geocode call per still-uncached candidate (a one-time cost, same shape as CAM-562's own original dev run) — written to a SEPARATE cache file (`CAM_562_CACHE_FILE` env override), never mutating CAM-562's own dev artifact.

### Placement — reuse CAM-571's primitives directly, do not fork `planMoves`

`planProvinceAlignmentMoves` mirrors CAM-571's `planMoves` shape (fresh re-check → forward-geocode → reverse-verify → write Location+CampSite together) but is a NEW function, not an edit to CAM-571's own `planMoves`. Reason: CAM-571's `planMoves` hardwires its "already fixed" skip condition to a country check (`shortName !== 'TH'`) — the wrong test for a same-country, different-province candidate — and its candidate source is `identifyOutsideThailand`, not CAM-562's `provinceMismatch`. Bending `planMoves` to serve both shapes would risk CAM-571's own 36 already-shipped tests for no benefit, since the primitives that ARE identical (`callGoogleGeocodeForward`, `buildForwardAddress`, `getProvinceAncestor`, `verifyAndResolvePlacement`) are already exported and imported here unchanged. `planMoves` itself is not imported — this story writes its own orchestration loop, reusing everything beneath it.

The "already fixed" check here is a **province match**, not a country check: a fresh reverse-geocode of the row's CURRENT coordinates is matched (via `matchAdminAreaByName`) against the row's own claimed province node; a match skips the row (`already_matches_claimed_province`) — this is both the idempotency guard and the host-edit safety net, the same discipline CAM-571 established for its own candidates.

### Real dry-run result (dev DB, 2026-07-27)

| | count |
|---|---|
| candidates (CAM-562 `provinceMismatch`) | 83 |
| identification calls made / cached | 0 made / 83 cached (1 was spent during pre-flight reconnaissance and is now itself cached) |

Real run + staging run are executed as part of this story's self-verify (see PR body for the actual moved/failed/unverified counts and the independently-queried before/after row data — not the script's own log).

### CampSite/Location sync (CAM-575)

Same write order CAM-571 established after CAM-575 made `CampSite.latitude/longitude` the trigger-canonical column: `campSite.update` (fires `campsite_coords_sync`) runs first in the `$transaction`, then `location.update` carries `lat/lon` (redundant with the trigger's own derivation, kept only so the SAME call also carries `district`/`subDistrict`/`adminAreaId`, which have no CampSite analogue) — together, atomically.

## Correction 2 — accommodation-type assignment (`scripts/backfill-cam-583-assign-accommodation-type.mjs`)

### Candidates — real query, both databases

`prisma.campSite.findMany({where:{accommodationTypes:''}})`:

| DB | count | matches ticket |
|---|---|---|
| dev | 10 | yes |
| staging | 12 | yes |

Every candidate's `nameTh` + Terrain `options` were inspected directly (see PR body for the full per-camp list on both databases) — every one carries an open-field keyword (`ทุ่ง`/`เนิน`) in its Thai name AND at least one open-ground Terrain tag (`FARM`/`FILD`/`FORE`/`MTNS`). **0 exceptions on either database.**

### Why co-occurrence, not a bare name match (BR-6)

`fitsOpenFieldPattern` requires BOTH signals — the CAM-501/503 Thai-substring-collision lesson (`.claude/rules/code.md`'s rationalization table) is that a common word (ทุ่ง/เนิน are ordinary Thai words, not rare markers) can appear in an unrelated camp's name. A name-only match risks assigning `DISP` to, say, a beachside camp whose name happens to contain "ทุ่ง"; a terrain-only match risks assigning it to a camp whose Terrain tags include `FILD`/`FARM` but whose actual listing is a marked, developed site. Requiring both closes that gap without inventing a new taxonomy field.

## ADRs

No new ADR — reuses CAM-571's already-accepted forward-geocode-then-verify decision, CAM-562's already-accepted province-mismatch classification, and CAM-538's already-accepted `DISP`/`TSIT` semantics (`lib/validations/campsite.ts::AccommodationTypeEnum`).

Confirmation: `__tests__/cam-583-align-provinces.test.ts` + `__tests__/cam-583-assign-accommodation-type.test.ts` — identification reuse, placement verification/refusal, CampSite sync, idempotency, open-field co-occurrence guard, exception reporting, guard refusal.

## Links
`scripts/backfill-cam-583-align-provinces.mjs` · `scripts/backfill-cam-583-assign-accommodation-type.mjs` · `scripts/backfill-cam-562-subdistrict-geocode.mjs` (reused) · `scripts/backfill-cam-563-location-admin-area.mjs` (reused) · `scripts/backfill-cam-571-coordinates-inside-thailand.mjs` (reused) · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-571-coordinates-inside-thailand/tech.md` · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-562-backfill-subdistricts/tech.md` · `story.md`

## Changelog
- v1 (2026-07-27) — created
