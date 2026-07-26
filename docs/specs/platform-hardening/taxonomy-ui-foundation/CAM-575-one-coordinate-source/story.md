## Story
As a **Camper**, I want a camp's map pin to always come from one authoritative place, so that the pin I see can never silently disagree with what the system itself thinks the camp's coordinates are.
Why: `CampSite.latitude/longitude` and `Location.lat/lon` store the same fact twice with nothing keeping them equal. CAM-571 found this by accident (its own dispatch told the agent to fix only `Location.lat/lon`; had it not run a reader/writer sweep, the 18 relocated pins would have stayed exactly where they were). A direct measurement across all 650 camps with coordinates found 4 that ALREADY disagree today, with no error anywhere pointing at it.
Scope: inventory every reader and writer of both column pairs (grep-backed, listed in tech.md with search terms). Make `CampSite.latitude/longitude` canonical (owner decision, 2026-07-26) and `Location.lat/lon` a DERIVED value, enforced by a database trigger — not a comment, not a convention every future writer has to remember. Reconcile the 4 currently-divergent camps, per-camp, using reverse-geocode verification against each camp's claimed province (never a blanket column preference — one of the 4 diverged in the OTHER direction, where `Location`'s value was the one that actually verified). Invert CAM-571's backfill write order (CampSite first, Location second) to match the new rule; confirm CAM-562's backfill was investigated and needs no change (it never wrote coordinates). Add a behavioral test that fails if the two columns CAN disagree, not merely a test that fixes today's four. Does not touch `app/api/locations/search/**`, `lib/read-models/camp-card.ts`, `components/CampgroundCard.tsx`, `components/CatalogResults.tsx`, `app/wishlist/page.tsx`, `lib/catalog-cache.ts` (PR #649/CAM-573 open on those; CAM-576 follows on the last one).
Depends on: CAM-571 (found the second column + the near-miss that motivated this story) · CAM-562/CAM-563 (the geo backfill scripts whose write order this story touches) · PR #649/CAM-573 (the catalog-read-path stories this story must not edit around)

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A host (or any server-side writer) sets a camp's coordinates through `CampSite.latitude/longitude` | The write completes (create or update, any code path: API route, script, seed) | No user-visible change (a data-consistency guarantee, not a screen) | `Location.lat/lon` on the camp's linked Location row is derived to the SAME value automatically, inside the same transaction — never left stale | EC-1 |
| AC-2 | A write touches ONLY `CampSite.latitude/longitude`, with no explicit `Location.lat/lon` write anywhere in the same code path | The write completes | No user-visible change | `Location.lat/lon` still matches — proven by re-reading the row after the write, not by inspecting the writer's source code | EC-1 |
| AC-3 | The 4 camps whose `CampSite`/`Location` coordinates disagree today | The reconciliation script runs for real | No user-visible change (a data migration; camper-facing readers already use `CampSite`, so the visible pin only moves for the 1 camp whose `CampSite` value was itself wrong) | Each camp is resolved to whichever point reverse-geocodes into its OWN claimed province; `CampSite.latitude/longitude` is written with that value, and `Location.lat/lon` derives to match via the trigger | EC-2 |
| AC-4 | Neither a camp's `CampSite` point nor its `Location` point reverse-geocodes into its claimed province | The reconciliation script runs (dry or real) | No user-visible change | The camp is reported as `unresolved` and nothing is written — never a guessed value | EC-3 |
| AC-5 | The reconciliation script has already run once and every camp agrees | The script runs again | No user-visible change | Zero divergent pairs are found; zero writes happen | EC-4 |
| AC-6 | CAM-571's backfill moves a camp's coordinates outside the cached 18 candidates | The backfill writes | No user-visible change beyond CAM-571's own AC (the pin moves) | `CampSite.latitude/longitude` is written before `Location`'s non-coordinate fields in the same `$transaction` (inverted from the original Location-first order) | EC-5 |
| AC-7 | The reconciliation + trigger have run | A camper filters the camp catalog by province "Chiang Mai" | Results are unchanged (same non-zero count) | `prisma.campSite.count({where:{location:{province:'Chiang Mai'}}})` returns 18 before AND after — verified by a real count query | EC-6 |

## Rules
- BR-1 `CampSite.latitude/longitude` is the single source of truth for a camp's coordinates (owner decision, 2026-07-26) — every writer writes it; `Location.lat/lon` is never treated as authoritative by any reader added or changed in this story (proves AC-1).
- BR-2 Consistency is enforced by a database trigger (`campsite_coords_sync`, fires `AFTER INSERT OR UPDATE OF latitude, longitude, locationId ON "CampSite"`), not by a code convention or a comment — any write path that touches `CampSite.latitude/longitude`, present or future, is covered without needing to remember to also write `Location` (proves AC-2).
- BR-3 The trigger direction is one-way only: `CampSite` → `Location`. `Location.lat/lon` is never read back to change `CampSite` — that would hand `CampSite`'s canonical status to whatever touches `Location` last, the exact bug this story closes.
- BR-4 Reconciling an already-divergent pair decides PER CAMP which value is correct — by reverse-geocoding both candidate points and checking which one's province matches the row's OWN claimed province (via `Location.adminAreaId`, walked to its PROVINCE ancestor when it sits below that level) using the SAME bilingual, hierarchical AdminArea matcher this codebase already trusts. A camp whose `CampSite` point verifies keeps `CampSite`'s value; a camp whose `CampSite` point does NOT verify but whose `Location` point DOES is corrected FROM `Location` (proves AC-3).
- BR-5 A camp where NEITHER point verifies its claimed province is left untouched and reported — never guessed (proves AC-4).
- BR-6 The reconciliation write goes through `CampSite` only, never through a direct `Location.lat/lon` write — `Location` is derived by the trigger in every case, including the one camp corrected FROM `Location`'s value (proves AC-3/BR-2).
- BR-7 CAM-571's backfill writes `CampSite` before `Location` in its `$transaction` (inverted from the original order); CAM-562's backfill was investigated and confirmed to never write `lat`/`lon` at all (it only ever wrote `district`/`subDistrict`/`adminAreaId`), so it needs no write-order change (proves AC-6).
- BR-8 A second reconciliation run finds zero divergent pairs and performs zero writes (proves AC-5).
- BR-9 The Chiang Mai province-filter count is unaffected — this story never writes `province`/`adminAreaId` (proves AC-7).

## Edge cases
- EC-1 IF a write touches `CampSite.latitude/longitude` through ANY code path (API route, script, seed, a future one not yet written) THEN `Location.lat/lon` still matches after the write, proven by re-reading the row — not by inspecting the writer's source (BR-1/BR-2)
- EC-2 IF a divergent camp's `CampSite` point verifies its claimed province THEN `CampSite`'s value is kept (a "touch" write forces the trigger to resync `Location`); IF it does NOT verify but `Location`'s point does THEN `CampSite` is corrected to `Location`'s value (BR-4)
- EC-3 IF neither candidate point verifies the claimed province THEN the camp is reported `unresolved` and nothing is written (BR-5)
- EC-4 IF the reconciliation script runs a second time after a successful run THEN zero pairs are found and zero writes occur (BR-8)
- EC-5 IF CAM-571's backfill moves a camp THEN the write order inside its `$transaction` is `CampSite` first, `Location` second (BR-7)
- EC-6 IF the Chiang Mai province-filter count differs before vs. after ANY write this story performs THEN it is treated as a regression, never shipped silently (BR-9)

## Data
- `CampSite.latitude`/`CampSite.longitude` (existing non-null Float) — canonical; the 1 genuinely-wrong-value camp of the 4 is corrected.
- `Location.lat`/`Location.lon` (existing nullable Float) — no longer written directly by any writer this story touches; derived by the `campsite_coords_sync` trigger.
- Migration: reversible (`CREATE OR REPLACE FUNCTION` + `CREATE TRIGGER`, down = `DROP TRIGGER`/`DROP FUNCTION`, both `IF EXISTS`) — proven up→down→up on the local dev DB (behavioral proof: the trigger fires on INSERT/UPDATE when up, divergence reproduces when down, both re-confirmed after re-applying).

## Seams & refs
- Reuse: `scripts/backfill-cam-562-subdistrict-geocode.mjs`'s `callGoogleGeocode`/`extractComponent` · `scripts/backfill-cam-563-location-admin-area.mjs`'s `matchAdminAreaByName` · `scripts/backfill-cam-571-coordinates-inside-thailand.mjs`'s `getProvinceAncestor`/`getAdminAreaNode` (exported from that file for this story, no third copy) — the full reader/writer inventory + search terms are in `tech.md`.
- Refs: no new ADR (reuses CAM-554's server-side-Google-Geocoding decision and CAM-563's `adminAreaId`-as-anchor decision, same as CAM-571).

## Out of scope
- Removing `Location.lat/lon` entirely — still read directly by CAM-562/571's own scripts and by `app/api/geocode/forward/route.ts`'s peers; removing it is a larger migration than this story's file surface allows. Follow-up: a future ticket if the column is ever proven fully dead.
- Editing `scripts/load-mock-staging.mjs`/`prisma/seed.ts`/`prisma/seed-bookings.ts` — outside this story's allowed file surface; the trigger enforces correctness at their `campSite.create()` call regardless of their internal write order (documented in tech.md, no code change needed).
- The catalog-read-path files under PR #649/CAM-573 — explicitly out of bounds; CAM-576 follows on the last of them.

## Self-verify
- AC-1/AC-2 → `__tests__/cam-575-coordinate-sync-invariant.test.ts` (real dev-DB integration test — INSERT sync, UPDATE-only sync, sequential updates, unrelated-field no-op) — behavioral, not source-inspection; skips gracefully when no `DATABASE_URL` is set (CI's `quality-gate` job has no Postgres service)
- AC-3/AC-4/AC-5 → `__tests__/cam-575-reconcile-coordinates.test.ts` (fake-Prisma unit tests using the REAL 4 camps' fixture shape) + a real dry-run then real run against the dev DB (measured: 3 kept, 1 corrected, 0 unresolved) + a real second run (measured: 0 divergent, 0 writes)
- AC-6 → source read of the inverted `$transaction` order in `scripts/backfill-cam-571-coordinates-inside-thailand.mjs`; CAM-571's own existing test suite (`__tests__/cam-571-coordinates-inside-thailand.test.ts`, unedited, out of this story's file surface) still asserts the final Location+CampSite values match
- AC-7 → real count query against the dev DB before and after every write this story performs (measured: 18 in all cases)
- Story-specific: migration up→down→up proven behaviorally (not just `prisma migrate status`) · the trigger's one-way direction (CampSite→Location only) is structural, not separately tested for the reverse direction since no code path writes it
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-27) — created
