# ADR-003 — Closed Prisma enum vs open MasterData boundary

**Status:** Proposed (G2 pending) · **Epic:** Atomic Schema (CAM-96) · **Stories:** S1 (CAM-98), S4 (CAM-101)

## Context
Today categorical fields are bare strings: some are fixed domain states (`role`, `status`, `kycStatus`, `bookingMethod`, `ownershipType`, `viewType`), others are extensible taxonomies (facilities, activities, terrain, equipment) stored as CSV and/or referencing `MasterData`. Without a clear rule, S1 (enums) and S4 (CSV→relations) would thrash each other.

## Decision
Split categoricals by **who owns the value set**:
- **Closed → Prisma `enum`** (changes are code + migration, owned by engineering): `UserRole, BusinessType, KycStatus, BookingMethod, OwnershipType, ViewType, BookingStatus (PENDING/CONFIRMED/PAID/CANCELLED/COMPLETED)`, plus `TaxonomyGroup` for MasterData grouping. These are small, stable, and drive logic/permissions.
- **Open → `MasterData` rows + relation** (ops can add without a deploy): facilities, external facilities, equipment, activities, terrain, access types, accommodation types, site types, tags. Consumed via the normalized `CampSiteTaxonomy{campSiteId, masterDataCode, role}` join (S4), where `role` (a Prisma enum) disambiguates which list.

## Alternatives
- **Everything as MasterData:** maximal flexibility, but loses DB-level type safety + exhaustiveness checks on logic-bearing states (a typo'd `role` is a security bug). Rejected for closed sets.
- **Everything as Prisma enum:** every new facility/activity needs a migration — too rigid for ops-managed taxonomies. Rejected for open sets.
- **zod-only (no DB constraint):** current state; app-level only, no DB integrity. Rejected.

## Consequences
- ✅ Type-safe logic states + extensible taxonomies; resolves S1/S4 ordering (enums land first, CSV→relation second).
- ✅ zod enums in `lib/validations/*` align 1:1 with Prisma enums (single source via `z.nativeEnum`).
- ⚠️ Moving a value between "closed" and "open" later is a migration — the boundary above is the commitment.
