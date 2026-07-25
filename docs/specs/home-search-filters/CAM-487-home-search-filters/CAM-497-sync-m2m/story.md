# CAM-497 — db:sync-from-staging copies the CampSite<->MasterData m2m join table (spec-lite)

version: 1

## Story

As an Admin (data operator refreshing the local dev DB), I want
`npm run db:sync-from-staging` to copy the implicit `_CampSiteToMasterData`
join table alongside every model table, so that every camp keeps its
terrain/facility/activity/access options after a sync instead of silently
losing all of them.

Why: verified in production this session — after a sync, every camp had zero
`options`, so every terrain/facility/activity/access filter and the AI
terrain search returned 0 results; the only workaround was re-running the
mock loader directly.

Scope: `scripts/db-sync-from-staging.mjs` only. No schema/migration change,
no change to the loader or the filter/search read paths.

## Gap

`Prisma.dmmf.datamodel.models` (the list the script iterates to build the
`TRUNCATE` table list and the per-model `findMany`/`createMany` copy loop)
only contains explicit models. `CampSite.options MasterData[]` /
`MasterData.campSites CampSite[]` is an IMPLICIT many-to-many relation
(neither side declares `@relation(fields: ...)`), so Prisma generates a
hidden join table with no delegate — invisible to the loop. `TRUNCATE ...
CASCADE` on the target still empties that join table (it carries FKs onto
`CampSite`/`MasterData`), so after a sync the join table was wiped and never
refilled: every `CampSite.options` relation resolved to zero rows.

## AC

| # | Given | When | Then | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Staging `_CampSiteToMasterData` has N join rows for a camp | `npm run db:sync-from-staging` runs to completion | — (backend/data script, no user-facing copy) | Target (local dev) `_CampSiteToMasterData` has the same N rows for that camp; `CampSite.options` resolves non-empty | EC-1 |
| AC-2 | Sync runs twice in a row (re-run / idempotency) | Second run's `TRUNCATE ... CASCADE` empties the target join table before the second copy | — | Row count matches source exactly both times (no duplicate-key error, no drift) | EC-2 |
| AC-3 | Source `_CampSiteToMasterData` is empty (no options set on any camp on staging) | Sync runs | — | Target join table ends empty too (0 rows copied, no crash) | — |

## Rules

- BR-1: The join table is copied via raw SQL (`$queryRawUnsafe`/`$executeRaw` with `Prisma.sql`/`Prisma.join` parameterized values) because it has no Prisma model/delegate — `findMany`/`createMany` cannot target it.
- BR-2: Table/column identifiers (`_CampSiteToMasterData`, `"A"`, `"B"`) are hardcoded constants in the script, never derived from request/user input — no injection surface; only the row VALUES (the `A`/`B` id pairs) are parameterized, matching the existing pattern already used for the `TRUNCATE` table list built from `dbName`s.
- BR-3: Copy order — join-table copy runs after the full model loop (so both `CampSite` and `MasterData` rows already exist in the target); `session_replication_role=replica` is already active for the whole sync so FK enforcement doesn't block either order, but the explicit ordering keeps the script correct even if that session setting is ever removed.
- BR-4: Batch size matches the existing model-copy loop (`BATCH = 500`) — no new tuning constant introduced.

## Edge cases

- EC-1: IF the source join table has 0 rows for a given camp THEN the target also has 0 rows for that camp after sync (no error, no stale leftover row — the earlier `TRUNCATE CASCADE` already cleared it).
- EC-2: IF the sync is re-run against a target that already has join rows from a prior run THEN the `TRUNCATE ... CASCADE` step (already covers the join table, since it FKs onto the truncated `CampSite`/`MasterData` tables) clears them before the fresh copy — no unique-constraint violation on `("A","B")`.

## Data

- No schema/migration change. Table touched: `_CampSiteToMasterData` (Prisma-generated implicit join table for `CampSite.options MasterData[]` <-> `MasterData.campSites CampSite[]`), columns `A` (-> `CampSite.id`) and `B` (-> `MasterData.code`), confirmed against `prisma/migrations/20260620112306_init/migration.sql` lines 206-209, 248-251, 287-290.
- Audit method (documented in-script): grepped every `Model[]` field pair in `prisma/schema.prisma` against every `CREATE TABLE "_..."` in `prisma/migrations/*/migration.sql`. `_CampSiteToMasterData` is the only implicit m2m join table in the schema — every other `Model[]` field is a normal one-to-many already covered by the existing model loop (has an explicit FK scalar on the "many" side).

## Seams & refs

- `scripts/db-sync-from-staging.mjs` — `IMPLICIT_M2M_TABLES` constant + the truncate-list append + the post-model-loop raw-SQL copy loop.
- `prisma/schema.prisma` lines ~373 (`CampSite.options`), ~417-425 (`MasterData` model).
- `prisma/migrations/20260620112306_init/migration.sql` lines 206-209, 248-251, 287-290 (join-table DDL + FK constraints, the source of truth for the `A`/`B` column mapping).

## Out of scope

- A generalized "discover implicit m2m tables at runtime via `information_schema`" mechanism — the schema has exactly one implicit m2m table today; a hardcoded, documented, audited list is simpler and safer than runtime introspection for a script only the team runs. If a second implicit m2m relation is ever added, extend `IMPLICIT_M2M_TABLES` (same audit method, noted in-script).
- Any change to `scripts/load-mock-staging.mjs` or the filter/search read paths that consume `CampSite.options` (already correct — CAM-497 is purely the sync script).
- Running the sync against a live DB in this story (backend has no DB in this worktree) — QA/the owner verify the real row counts on a live sync.

## Self-verify

- `node --check scripts/db-sync-from-staging.mjs` → syntax OK.
- `npx eslint scripts/db-sync-from-staging.mjs` → 0 errors.
- Reasoned (no live DB available in this worktree): `IMPLICIT_M2M_TABLES` is appended to the truncate list; the join-table copy loop runs after the full model loop so `CampSite`/`MasterData` target rows exist first; `A`/`B` column mapping matches the migration SQL FK constraints exactly (`A` -> `CampSite.id`, `B` -> `MasterData.code`).
- `git diff origin/dev --stat` → only `scripts/db-sync-from-staging.mjs` + this `story.md`.
- Not run against a live DB (no DB in this worktree per dispatch instructions) — QA/the owner must run a real `npm run db:sync-from-staging` and confirm `CampSite.options` is non-empty post-sync before closing the ticket.
