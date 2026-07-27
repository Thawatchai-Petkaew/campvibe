---
feature: Platform hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: tech
owner: backend-engineer
status: done
version: v2
updated: 2026-07-27
---
# Tech — Align mismatched provinces and fill the missing accommodation types (CAM-583)

## Data model

**No migration.** `Location.lat/lon/adminAreaId/district/subDistrict`, `CampSite.latitude/longitude`, and `CampSite.accommodationTypes` all already exist on the schema. `prisma migrate status` confirmed up to date before and after; `git status --short prisma/migrations/ prisma/schema.prisma` is empty. Both corrections are script-only.

## Correction 1 — province alignment (`scripts/backfill-cam-583-align-provinces.mjs`)

### Candidate identification — a PURE frozen-cache scan (v2 fix, see Changelog)

`identifyProvinceMismatches` scans CAM-562's FROZEN geocode cache ONLY (`Object.keys(cam562Cache)`) and classifies each entry with CAM-562's own per-row `resolveCandidate` (imported directly — zero new classification logic, zero Google calls, since `resolveCandidate` classifies purely from an already-fetched geocode result plus one local, unbilled Prisma read for the row's current province anchor).

**v1 bug found and fixed before ship:** the first implementation called CAM-562's `runBackfill(prisma, {dryRun:true, cache})` LIVE — its candidate query re-scans the CURRENT database (`WHERE lat/lon not null AND (district IS NULL OR subDistrict IS NULL)`) on every invocation, not the frozen snapshot. That would classify — and this script would then MOVE — a real host's freshly created camp if it happened to sit in an adjacent province at write time, violating the ticket's explicit "do not touch anything a real host entered" requirement (CAM-571's own BR-2 precedent). Fixed to a pure cache-key scan, mirroring CAM-571's `identifyOutsideThailand` exactly: a row absent from the frozen cache can never be a candidate, structurally, regardless of live DB state. Regression tests: `__tests__/cam-583-align-provinces.test.ts` (a) — "a row ABSENT from the frozen cache is NEVER a candidate, even though it currently mismatches its claimed province".

Real scan against the dev DB (reusing CAM-562's frozen `cam-562-geocode-cache.json`, dev's real artifact): **83 candidates, 0 new identification calls** — exact match to the ticket's stated dev count (1 call was spent identifying this set during pre-flight reconnaissance, before either script existed, and is now itself cached).

Staging has never been scanned by CAM-562 at all, so a frozen snapshot for it does not yet exist. One-time cost to build it: CAM-562's own `runBackfill` dry-run, run ONCE standalone against staging (146 real reverse-geocode calls — confirmed: `prisma.location.count({where:{lat:{not:null},lon:{not:null},OR:[{district:null},{subDistrict:null}]}})` → 146 of 797 rows were still uncached candidates), saved to a SEPARATE file (`CAM_562_CACHE_FILE` env override) — never mutating CAM-562's own dev artifact. From that point on staging's snapshot is exactly as frozen as dev's, and this script's own `main()` refuses loudly (`✗ refusing: no frozen identification cache found...`) rather than silently falling back to a live re-scan if that file is missing — the same discipline CAM-571's `main()` uses for its own cache dependency.

### Placement — reuse CAM-571's primitives directly, do not fork `planMoves`

`planProvinceAlignmentMoves` mirrors CAM-571's `planMoves` shape (fresh re-check → forward-geocode → reverse-verify → write Location+CampSite together) but is a NEW function, not an edit to CAM-571's own `planMoves`. Reason: CAM-571's `planMoves` hardwires its "already fixed" skip condition to a country check (`shortName !== 'TH'`) — the wrong test for a same-country, different-province candidate — and its candidate source is `identifyOutsideThailand`, not CAM-562's `provinceMismatch`. Bending `planMoves` to serve both shapes would risk CAM-571's own 36 already-shipped tests for no benefit, since the primitives that ARE identical (`callGoogleGeocodeForward`, `buildForwardAddress`, `getProvinceAncestor`, `verifyAndResolvePlacement`) are already exported and imported here unchanged. `planMoves` itself is not imported — this story writes its own orchestration loop, reusing everything beneath it.

The "already fixed" check here is a **province match**, not a country check: a fresh reverse-geocode of the row's CURRENT coordinates is matched (via `matchAdminAreaByName`) against the row's own claimed province node; a match skips the row (`already_matches_claimed_province`) — this is both the idempotency guard and the host-edit safety net, the same discipline CAM-571 established for its own candidates.

### Real run result — both databases, independently verified (2026-07-27)

| | dev | staging |
|---|---|---|
| candidates (CAM-562 `provinceMismatch`, frozen-cache scan) | 83 | 103 |
| moved (verified, written) | 81 | 100 |
| placement unverified (refused, left alone) | 2 (Ang Thong pair) | 3 (Ang Thong triple) |
| forward-geocode failed | 0 | 0 |
| Chiang Mai count before / after | 18 / 18 | 18 / 18 |

**Independently verified — not the script's own log:** for each database, the ORIGINAL candidate set was reconstructed from the frozen cache (`resolveCandidate` re-applied per cached id, deterministic regardless of current district/subDistrict state) and, for every moved row, the reverse-verify cache's own stored Google response was re-read directly and matched (via `matchAdminAreaByName`, bilingual — not a raw string compare) against the row's current province anchor: **dev 81/81 verified, 0 mismatches, 2 not-moved (the refused pair); staging 100/100 verified, 0 mismatches, 3 not-moved.** `Location.lat/lon` vs. linked `CampSite.latitude/longitude`: 0 mismatches across 650 dev rows and 795 staging rows with a linked CampSite (a direct query, not assumed).

**Unverified pair/triple root cause (reported, not investigated further — out of this story's scope):** both databases carry rows claiming `Ang Thong` whose forward-geocoded point does not reverse-geocode back to Ang Thong (lands in a neighboring province instead) — refused per BR-2, never guessed. Left untouched.

**Google Geocoding calls actually spent (owner is billed for this), measured directly from the on-disk call caches, not estimated:**

| Phase | Calls |
|---|---|
| Identification — dev (pre-flight, before either script existed) | 1 |
| Identification — staging (one-time frozen-snapshot build) | 146 |
| Move/verify — reverse-check (distinct `id:lat,lon` keys, shared cache across dev+staging invocations) | 256 |
| Move/verify — forward-geocode (distinct `<province>, Thailand` addresses — legitimately shared cross-database, since the same address always forward-geocodes to the same point) | 37 |
| Move/verify — reverse-verify (distinct new-point keys — legitimately shared cross-database) | 37 |
| **Total** | **477** |

Every subsequent dry-run/real-run/idempotency-check invocation (multiple, on both databases, for this story's own self-verify) made **0** further calls — 100% served from cache, confirmed by each invocation's own "made: 0" log line.

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

**Real run result, independently verified (2026-07-27):** dev — 10 assigned `DISP`, 0 exceptions, `accommodationTypes=''` count 10→0, Chiang Mai 18/18. Staging — 12 assigned `DISP`, 0 exceptions, `accommodationTypes=''` count 12→0, Chiang Mai 18/18. Second run on both databases: 0 candidates, 0 rows changed (idempotent by construction — the candidate query itself excludes any row no longer empty). No Google Geocoding calls — this backfill is DB-only.

### Why co-occurrence, not a bare name match (BR-6)

`fitsOpenFieldPattern` requires BOTH signals — the CAM-501/503 Thai-substring-collision lesson (`.claude/rules/code.md`'s rationalization table) is that a common word (ทุ่ง/เนิน are ordinary Thai words, not rare markers) can appear in an unrelated camp's name. A name-only match risks assigning `DISP` to, say, a beachside camp whose name happens to contain "ทุ่ง"; a terrain-only match risks assigning it to a camp whose Terrain tags include `FILD`/`FARM` but whose actual listing is a marked, developed site. Requiring both closes that gap without inventing a new taxonomy field.

## Finding (Important, out of scope) — pre-existing CampSite/Location coordinate drift on staging, unrelated to this story

While independently verifying the CAM-575 sync invariant (`Location.lat/lon` vs. linked `CampSite.latitude/longitude`), 16 of 795 staging `Location` rows were found already mismatched — confirmed NONE of the 16 ids appear anywhere in this story's own moved-row list (grepped against the real run's log). CAM-575's own tech.md measured 4 such drifted camps on dev; staging appears to carry more, most plausibly because `scripts/backfill-cam-575-reconcile-coordinates.mjs` (already shipped) has not yet been run against staging. This is a pre-existing data-quality gap this story did not cause and is out of this story's file surface to fix — flagged here for DevOps/a follow-up ticket, not silently patched.

## ADRs

No new ADR — reuses CAM-571's already-accepted forward-geocode-then-verify decision, CAM-562's already-accepted province-mismatch classification, and CAM-538's already-accepted `DISP`/`TSIT` semantics (`lib/validations/campsite.ts::AccommodationTypeEnum`).

Confirmation: `__tests__/cam-583-align-provinces.test.ts` + `__tests__/cam-583-assign-accommodation-type.test.ts` — identification reuse, placement verification/refusal, CampSite sync, idempotency, open-field co-occurrence guard, exception reporting, guard refusal.

## Links
`scripts/backfill-cam-583-align-provinces.mjs` · `scripts/backfill-cam-583-assign-accommodation-type.mjs` · `scripts/backfill-cam-562-subdistrict-geocode.mjs` (reused) · `scripts/backfill-cam-563-location-admin-area.mjs` (reused) · `scripts/backfill-cam-571-coordinates-inside-thailand.mjs` (reused) · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-571-coordinates-inside-thailand/tech.md` · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-562-backfill-subdistricts/tech.md` · `story.md`

## Changelog
- v1 (2026-07-27) — created
- v2 (2026-07-27) — real dry-run + real run completed on both dev and staging (moved/refused/verified counts, Chiang Mai canary, Google-call ledger all independently re-queried); found and fixed a host-entered-data-safety bug in `identifyProvinceMismatches` (was a live re-scan, now a pure frozen-cache scan) before shipping, with a regression test; flagged a pre-existing, unrelated staging CampSite/Location drift (16 rows) found during independent verification
