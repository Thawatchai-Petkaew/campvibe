# ADR-004 — Multi-country location: Country + self-referencing AdminArea

**Status:** Proposed (G2 pending) · **Epic:** Atomic Schema (CAM-96) · **Story:** S5 (CAM-102)

## Context
Location is Thailand-only: `ThailandLocation` flattens province+district into one row (nullable district) and `Location` carries `country @default("Thailand")` + free-string `province/district/subDistrict/village` + Float lat/lon. This bakes Thailand's 2-level admin shape into columns and cannot hold other countries. The owner wants real multi-region.

## Decision
- **`Country`** `@id` ISO-3166-1 alpha-2 (`"TH"`), with region defaults: `defaultCurrency` (ISO-4217), `defaultLocale` (BCP-47), `defaultTimezone` (IANA), `vatRate Decimal?`, `vatInclusive`, `callingCode`, `isActive`.
- **`AdminArea`** self-referencing adjacency-list tree: `id, countryCode (FK), level (enum PROVINCE_STATE|DISTRICT_COUNTY|SUBDISTRICT), code (national code), parentId (self-FK)`. `@@unique([countryCode, level, code])`, `@@index([parentId])`, `@@index([countryCode, level])`. Holds any country's hierarchy without per-country tables.
- **`Location`** keeps geo Pixels: `latitude/longitude Decimal(9,6)` (~0.11 m, exact; [Geo]) + `adminAreaId` FK + `addressDetail` free-text. `@@index([latitude, longitude])` for bbox/map queries.
- Names live in `Translation` (ADR-001). **Drop `ThailandLocation` and `Location` free-string admin columns.** Thai data re-seeds from `prisma/data/thailand-locations.json` into the tree (TH = one Country instance).

## Alternatives
- **Per-country tables** (`ThailandLocation`, `JapanLocation`…): sprawl, no shared queries. Rejected.
- **Nested-set / materialized-path tree:** faster subtree reads, heavier writes — over-engineered for a shallow 3-level hierarchy. Rejected (revisit if needed).
- **PostGIS `geography(Point)` + GiST:** the right tool for radius search; deferred until a radius-search AC exists (Lean). Decimal lat/lon + composite index is enough now.

## Consequences
- ✅ Multi-country ready, de-duplicated names, atomic Geo Pixels, removes a per-campsite `Location` indirection row.
- ⚠️ Recursive queries for deep subtrees (mitigated by shallow depth + `parentId` index).
- High blast radius: `app/api/location*`, `lib/thailand-data.ts`, filters, map/picker components. Pre-launch → clean reset + tree re-seed.
