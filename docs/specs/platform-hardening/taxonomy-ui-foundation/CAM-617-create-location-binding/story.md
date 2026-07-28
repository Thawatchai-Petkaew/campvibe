## Story
As a **Host**, I want a brand-new camp I create to always get its own Location, so that another host's location can never end up coupled to my camp (or vice versa).
Why: CAM-613's authz sweep fixed the sibling defect on `PUT /api/campsites/[id]` and, while sweeping, found a related-but-separate gap it deliberately did not fix (out of that story's file surface): `POST /api/campsites` (create) accepts a body-supplied `locationId` with no exclusivity check, and `Location.campSites` is a 1:many relation. Established from the code (not assumed — see tech.md's evidence walk) that nothing in the seed, the CAM-575 backfill, or the host-onboarding form ever intends two camps to share one Location row. Left open, a host can read another camp's `locationId` (exposed by `GET /api/campsites/[id]`) and hand it to this route as their own new camp's `locationId`, silently coupling the two camps.
Scope: reject a create whose `locationId` already references an existing (non-deleted) `CampSite` row, before any write happens. Unlike CAM-613's UPDATE-path fix (which safely ignored a foreign body id because the authorised camp's own `locationId` was always a valid fallback target), a CREATE has no prior authorised Location to fall back to — so the rule here is reject (409), not ignore.
Depends on: CAM-613 (found this gap during its sweep; isolated fix here, single file surface).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camp A (owned by Host A) already exists with `locationId = L` | Host B sends `POST /api/campsites` with `locationId: L` (read off `GET /api/campsites/{A}`) plus their own new camp's fields | Create fails; `ไม่สามารถสร้างแคมป์ได้ เนื่องจากตำแหน่งนี้ถูกใช้งานโดยแคมป์อื่นอยู่แล้ว` | No new `CampSite` row is created; `Location` row `L` is untouched (still carries only Camp A's coordinates/admin-area) | EC-1 |
| AC-2 | A host owns another camp of their own, already attached to `locationId = L` | The SAME host sends `POST /api/campsites` with `locationId: L` for a second new camp | Create fails; same Thai copy as AC-1 | No new `CampSite` row is created — exclusivity is enforced regardless of who owns the existing camp (see tech.md's Q1 evidence: nothing ever intends sharing, same-host included) | EC-2 |
| AC-3 | A host has just created a fresh Location via the normal two-step flow (`POST /api/location` returns a brand-new, unattached row) | The host's client then sends `POST /api/campsites` with that fresh `locationId` (the existing, legitimate flow — unchanged) | Create succeeds, 201, camp appears as usual | New `CampSite` row created, `locationId` set to the fresh row; the `campsite_coords_sync` trigger syncs `Location.lat/lon` to the new camp's own coordinates, exactly as before this story | EC-3 |

## Rules
- BR-1 `POST /api/campsites` rejects the request (409) when `data.locationId` already references any existing `CampSite` row with `deletedAt: null` — checked before any Prisma write, same "fail closed before any side effect" placement as the existing `isPriceOrderValid` check on this route (proves AC-1/AC-2).
- BR-2 The check is exclusivity-based, not ownership-based — it does not read `operatorId` and does not special-case "the caller's own other camp" (proves AC-2; see tech.md Q1 for why no legitimate case, same-host or cross-host, was ever found).
- BR-3 The legitimate create flow (client always creates a brand-new `Location` via `POST /api/location` first, per `components/CampgroundForm.tsx`) is unaffected — a fresh, never-attached `locationId` passes the check exactly as before (proves AC-3).

## Edge cases
- EC-1 IF the body's `locationId` already has a live `CampSite` attached (any operator) THEN the create is rejected with 409 and no row is written (BR-1)
- EC-2 IF the body's `locationId` already has a live `CampSite` attached that belongs to the SAME requesting host THEN the create is still rejected (BR-2) — no legitimate use case exists either way
- EC-3 IF the body's `locationId` has zero live `CampSite` rows attached (the normal case) THEN the create proceeds exactly as before, including the coordinate trigger (BR-3)

## Data
- No schema/migration change. The check is a single `prisma.campSite.findFirst({ where: { locationId, deletedAt: null }, select: { id: true } })` — one extra indexed read (`CampSite.locationId` is already `@@index`ed) before the existing create call, no new column, no new relation.

## Seams & refs
- Reuse: the existing `apiError(message, 409)` helper (`lib/api-utils.ts`) and the same "fail closed before any write" placement pattern the price-order check on this same route already uses.
- Refs: no new ADR — a straightforward exclusivity guard, not a new architectural decision. See CAM-613's tech.md "Related-but-separate finding" for the origin of this ticket, and CAM-575's `campsite_coords_sync` trigger migration for why coordinate-sharing is the sharpest symptom (tech.md walks this in full).

## Out of scope
- Removing `locationId` from `campSiteSchema` / changing the two-step client create flow (`POST /api/location` then `POST /api/campsites`) — would require touching `components/CampgroundForm.tsx`, out of this dispatch's allowed surface, and the two-step contract is unchanged by this fix (tech.md explains why deleting the parameter isn't the available simplification here).
- Any change to `app/api/campsites/[id]/route.ts` (PUT) — CAM-613 owns that route and is already Done.
- Soft-delete semantics for `CampSite.deletedAt` beyond mirroring the existing `deletedAt: null` convention already used throughout `app/api/campsites/route.ts` GET (`lib/campsite-filters.ts`) — no new soft-delete behavior introduced here.

## Self-verify
- AC-1 → `__tests__/cam-617-location-exclusivity.test.ts` (mocked, teeth) + `__tests__/cam-617-location-exclusivity-real-db.test.ts` (real DB, end-to-end: proves the shared Location's coordinates are never touched by the blocked attempt).
- AC-2 → `__tests__/cam-617-location-exclusivity.test.ts` ("same operator" case).
- AC-3 → `__tests__/cam-617-location-exclusivity-real-db.test.ts` (control case: legitimate create through the REAL route, including the coordinate trigger actually syncing a fresh Location) + the mocked "no existing CampSite" case.
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-28) — created; fixes the CAM-613-sweep-flagged create-path Location-exclusivity gap.
