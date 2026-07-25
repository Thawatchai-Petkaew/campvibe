# CAM-495 — Loader persists CampSite/Spot detail fields (spec-lite)

version: 1

## Story

As an Admin (data operator running the staging seed load), I want
`scripts/load-mock-staging.mjs` to upsert `cancellationPolicy`, `extraFeeAmount`,
`extraFeeLabel` (CampSite) and `pricePerSite` (Spot) from `mock-staging-all.json`,
so that these atomic Pixels — already populated in the mock data by CAM-492 —
actually land in the DB instead of silently sitting unused in the JSON.

Scope: `scripts/load-mock-staging.mjs` only. No schema, generator, data JSON, or
UI/query changes.

## Gap

CAM-492 added `cancellationPolicy`, `extraFeeAmount`+`extraFeeLabel` (CampSite) and
`pricePerSite` (Spot) to the mock JSON, but the loader's `prisma.campSite.upsert`
(create+update) and `prisma.spot.create` payloads never read them — a full staging
reload never writes these fields to the DB.

## AC

| # | Given | When | Then | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camp object in the JSON has `cancellationPolicy`/`extraFeeAmount`/`extraFeeLabel` set | Loader runs (create OR update path) | — (backend/data loader, no user-facing copy) | `CampSite` row on DB has matching values | EC-1 |
| AC-2 | A spot object in the JSON has `pricePerSite` set | Loader creates the spot (create-if-not-exists) | — | `Spot` row on DB has matching `pricePerSite` | EC-2 |
| AC-3 | Loader re-run (idempotent reload) on a camp whose fields changed in the JSON | Loader runs the `update` branch of `campSite.upsert` | — | Existing CampSite row's fields refresh to the new JSON values (not stuck at first-load) | — |

## Rules

- BR-1: A camp/spot missing the field in the JSON → write `null` (never crash, never guess/infer a value — matches the existing `?? null` pattern used for every other optional field in the loader).
- BR-2: `cancellationPolicy` is a closed enum (`FLEXIBLE`/`MODERATE`/`STRICT`/`NON_REFUNDABLE` per `prisma/schema.prisma`); the loader passes the JSON string through as-is (already validated at JSON-generation time by CAM-492) — no re-validation added here (spec-lite, backend-only scope).
- BR-3: `extraFeeAmount`/`pricePerSite` are Prisma `Decimal?` columns; passed through directly as the loader already does for `priceLow`/`priceHigh`/`pricePerNight` (no special Decimal wrapping needed — Prisma accepts a plain number).

## Edge cases

- EC-1: IF a camp object has no `cancellationPolicy`/`extraFeeAmount`/`extraFeeLabel` key THEN the corresponding DB column stays/becomes `null` (no crash).
- EC-2: IF a spot object has no `pricePerSite` key THEN the DB column stays/becomes `null` (no crash).

## Data

- `CampSite.cancellationPolicy` (`CancellationPolicy?` enum), `CampSite.extraFeeAmount` (`Decimal(12,2)?`), `CampSite.extraFeeLabel` (`VarChar(100)?`) — both create + update branches of `prisma.campSite.upsert`.
- `Spot.pricePerSite` (`Decimal(12,2)?`) — `prisma.spot.create` (spots are create-if-not-exists, no update branch in this loader).
- No schema/migration change — fields already exist (added by the architect/CAM-492 lineage); this story only wires the loader to read them.

## Seams & refs

- Loader: `scripts/load-mock-staging.mjs` (`prisma.campSite.upsert` create/update blocks; `prisma.spot.create` block inside the per-camp spot loop).
- Schema: `prisma/schema.prisma` lines ~300-319 (CampSite Pixels), ~444-445 (Spot).
- Data source: `prisma/data/mock-staging-all.json` (populated by CAM-492; not touched by this story).

## Out of scope

- Validating/backfilling the JSON data itself (CAM-492's responsibility).
- Any UI or query-layer consumption of these fields (separate stories).
- A migration — none needed, fields pre-exist.

## Self-verify

- `grep -nE "cancellationPolicy|extraFeeAmount|extraFeeLabel|pricePerSite" scripts/load-mock-staging.mjs` → present in CampSite create+update and Spot create.
- `node --check scripts/load-mock-staging.mjs` → syntax OK.
- `npx eslint scripts/load-mock-staging.mjs` → 0 errors (1 pre-existing unrelated warning: unused `hashKey`).
- Confirmed via `node -e` against the real JSON that camps/spots carry populated values for all four fields (e.g. `cancellationPolicy: "FLEXIBLE"`, `extraFeeAmount: 52`, `extraFeeLabel: "ค่าทำความสะอาดพื้นที่"`, `pricePerSite: 850`) — so the loader has real data to read once run.
- Not run against any DB (per dispatch instruction — no live load in this story; QA/DevOps run the actual staging load + DB verify).
