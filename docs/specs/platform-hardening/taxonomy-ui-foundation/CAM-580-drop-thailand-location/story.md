---
feature: Platform hardening
epic: taxonomy-ui-foundation
persona: Host
artifact: story
owner: backend-engineer
status: done
version: v1
updated: 2026-07-27
---

## Story
As a **Host**, I want the location system to have exactly ONE administrative-area source (`AdminArea`), so that a future change to province/district/sub-district data can never drift between two competing tables.
Why: `ThailandLocation` was reduced to a flat legacy table by CAM-553..576, but its last two direct readers were left out of CAM-574's surface deliberately (that story stopped short rather than guess) — this story is the named follow-up that completes the retirement.
Scope: move the two remaining direct readers of `ThailandLocation` onto `AdminArea`, drop the model+table by a reversible migration, and stop `prisma/seed.ts` from populating it. Does not touch the free-text `Location.province`/`district`/`subDistrict` columns (CAM-573/574 already decided those stay, unrelated to this table).
Depends on: CAM-574 (retire-thailand-location, phase B — retired the `Location.thaiLocationId` FK)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A host drops a map pin in Chiang Mai | The reverse-geocode lookup resolves province/district | Location card fills in `เชียงใหม่` / `เมืองเชียงใหม่` exactly as before | `resolveFromComponents` derives the row from the matched `AdminArea` node directly — no `ThailandLocation` query | EC-1 |
| AC-2 | A camper views a camp's card | The card renders its location line | Card shows the Thai province name (e.g. `เชียงใหม่`), never a blank/English-only fallback | `getProvinceThaiNameMap()` sources `AdminArea` PROVINCE rows instead of `ThailandLocation` | EC-2 |
| AC-3 | The dev DB has the migration applied | An operator runs `npx prisma db seed` | Seed completes with no error, all 12 mock camps + AdminArea tree populated | `prisma/seed.ts` no longer upserts `ThailandLocation`; camp→province linking resolves via an in-memory map built during the AdminArea seed loop | EC-3 |
| AC-4 | The migration is applied | An operator queries the dev DB schema | `ThailandLocation` table does not exist | `DROP TABLE "ThailandLocation"` | EC-4 |

## Rules
- BR-1 The two direct (non-FK) readers of `ThailandLocation` identified by CAM-574 (`app/api/geocode/_shared.ts`, `lib/read-models/camp-card.ts`) must both be moved onto `AdminArea` before the table is dropped — dropping first would 500 both surfaces.
- BR-2 `prisma/seed.ts` must resolve each mock camp's province `AdminArea` id from data already available in-memory during the AdminArea seed loop (no DB read needed) — never re-introduce a `ThailandLocation` read to bridge it.
- BR-3 The migration must be reversible (up/down), proven up→down→up on the local dev DB before merge, with real command output in the PR body.
- BR-4 No backfill of `ThailandLocation`'s data on `down` — every row is fully superseded by `AdminArea` (same source JSON, already seeded), and nothing reads the table by the time this ships (BR-1).
- BR-5 The Chiang Mai canary (18 camps) must return the same NUMBER before and after this story, at every layer touched (DB, `AdminArea`-resolve, camp-card province map, reverse-geocode) — a silent zero-result regression is the named failure mode this story exists to prevent.

## Edge cases
- EC-1 IF the matched `AdminArea` province node has no live camp/data drift THEN the response reports that level `null` (never fabricates a row) — same contract as before, now impossible to hit as a false-negative since the row is derived from the node itself, not a second join.
- EC-2 IF a `Location.adminArea` did not resolve at all (the 2 orphan rows, pre-existing) THEN the camp-card falls back to the pre-existing name-based match against `Location.province`, unaffected by this story's table drop.
- EC-3 IF the seed is re-run repeatedly (idempotent upserts) THEN no duplicate `AdminArea` rows are created and every mock camp's `adminAreaId` resolves the same way each time.
- EC-4 IF a rollback is needed after promote THEN `down.sql` recreates the table+indexes (structure only, no data) so the schema returns to its pre-migration shape.

## Data
- Entities touched: `ThailandLocation` (model + table dropped) · `Location` (unchanged by this story — its `adminAreaId`/`adminArea` relation already carries the id post-CAM-574) · `AdminArea` (unchanged relation, now the sole admin-hierarchy source for every reader).
- Migration: reversible — `prisma/migrations/20260727050000_cam580_drop_thailand_location_table/` (`migration.sql` = `DROP TABLE`, `down.sql` = recreate table + 2 indexes, structure only). Proven up→down→up on the local dev DB; see tech.md + PR body for the real command output.

## Seams & refs
- Reuse: `lib/geo/admin-area-match.ts`'s `matchAdminArea`/`AdminAreaNode` (CAM-566, unchanged) — both moved readers build their response row from the SAME `AdminAreaNode` shape `/api/locations/search` already uses post-CAM-574, no new derivation invented.
- Refs: CAM-574 tech.md ("Why the ThailandLocation MODEL is not dropped" — the two-reader gap this story closes) · CAM-573 tech.md (`adminAreaChainSelect`/`resolveLocationDisplayNames`, unchanged) · CAM-566 tech.md (the shared matcher).

## Out of scope
- The free-text `Location.province`/`district`/`subDistrict` columns and `lib/campsite-filters.ts`'s exact-string province filter — CAM-573/574 already decided these stay; unrelated to the `ThailandLocation` table. No follow-up needed (unrelated system).
- Any further consolidation of `AdminArea` itself (e.g. dropping the free-text columns in favor of a full id-only model) — a much larger cross-cutting change, not raised by this ticket.

## Self-verify
- AC-1 → integration (mocked, `__tests__/cam-580-drop-thailand-location.test.ts` Section C) + behavioral against the real dev DB (`__tests__/cam-580-chiang-mai-canary.test.ts`, gated on `DATABASE_URL`)
- AC-2 → integration (mocked, updated `__tests__/cam-545/548/573/576-*.test.ts`) + behavioral (`cam-580-chiang-mai-canary.test.ts`)
- AC-3 → real run: `npx prisma db seed` against the local dev DB (see PR body for output)
- AC-4 → real run: `prisma migrate deploy` + `information_schema` query (see PR body for output)
- Story-specific: exhaustive reader/writer inventory (grep-backed, method stated in tech.md) · migration up→down→up proven for real · seed idempotency preserved
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-27) — created
