---
artifact: feature
feature: team-access-rbac (Team & Access (RBAC))
personas: [host]
status: active
version: v2
updated: 2026-06-23
---
# Team & Access (RBAC)

## Overview
Lets a Host invite teammates and assign them roles so day-to-day camp operations (managing spots, handling bookings) can be delegated through the system instead of sharing the owner account. Serves the **host** persona. · ↑ Master-Plan: `docs/project/master-plan.md` · product-plan item: **H-7 Team & staff (RBAC)** (`docs/project/product-plan.md`).

## Architecture overview
- Entities:
  - `CampSiteTeamMember` — links a `User` to a `CampSite` by ID, with `role` (one of 5), an optional explicit `permissions` string array (overrides the role default when non-empty), and `isActive`. Linked by ID to both `User` and `CampSite`; no nested embedding.
  - `Permission` model — permission codes are stored as plain string codes (`TEXT[]`) and mirrored as a TS union (`PermissionCode`) in `lib/team-permissions.ts`, deliberately decoupled from the Prisma runtime enum so a stale dev client cannot 500 the API.
- Authorization engine (`lib/auth-utils.ts` + `lib/team-permissions.ts`):
  - `requireCampSitePermission(campSiteId, code)` — the single server-side gate for camp-scoped mutations. Three-tier precedence: (1) platform `ADMIN` always allowed → (2) camp site operator (owner) always allowed → (3) team member must hold `code` in their effective permissions; otherwise default-deny (`403`). Unauthenticated → `401`; unknown campsite → `404`.
  - `getEffectivePermissions({ role, permissions })` — returns the explicit `permissions` array if non-empty (filtered to valid codes), else the `ROLE_DEFAULT_PERMISSIONS[role]` default.
  - `hasPermission(perms, code)` — membership check.
  - `ROLE_DEFAULT_PERMISSIONS` — server-authoritative defaults per role (OWNER = all; ADMIN = `CAMPSITE_UPDATE` + booking/team/analytics/financial but **not** `CAMPSITE_DELETE`; MANAGER/STAFF/VIEWER = booking-scoped only).
- API surface (camp-scoped, gated by the engine above):
  - `POST /api/campsites/[id]/spots` → `CAMPSITE_UPDATE`
  - `PUT /api/campsites/[id]/spots/[spotId]` → `CAMPSITE_UPDATE`
  - `DELETE /api/campsites/[id]/spots/[spotId]` → `CAMPSITE_DELETE`
  - `GET /api/campsites/[id]/spots`, `GET /api/campsites/[id]/spots/[spotId]` — public read by design (no gate)
  - `PATCH /api/bookings/[id]` — host path gated on `BOOKING_UPDATE` (camper-cancel path separate)
  - Team-member management routes (`/api/team/members*`) remain owner-only → deferred (see Epics & Stories).
- ADRs: — · schema: `prisma/schema.prisma`

## Design overview
Team management surfaces in host settings via `components/settings/TeamManagement.tsx` (add/edit/remove members, assign role). Shared shadcn/ui primitives + tokens per `DESIGN.md`. The RBAC enforcement work in CAM-83 is API-only (no UI change); the UI that shows/hides spot and booking controls by permission is a separate follow-up.

## Epics & Stories
| Epic | Story | CAM | Role rotation | Status |
|---|---|---|---|---|
| host-team-staff-rbac (CAM-38) | RBAC enforcement on spot CRUD endpoints | CAM-83 | backend → security → devops | Done |
| host-team-staff-rbac (CAM-38) | Full RBAC enforcement audit across remaining endpoints (`/api/team/members*`) | CAM-90 | — | Planned |

## Key decisions
- **Permission-based gate over owner-only.** Camp-scoped mutations use `requireCampSitePermission(id, code)` (three-tier precedence) rather than `requireCampSiteOwnership(id)`, so the 5-role matrix is actually enforced and a Host can delegate work. Owner-only was the regression CAM-83 fixed.
- **ADMIN can edit but not delete spots — by design.** Team `ADMIN` holds `CAMPSITE_UPDATE` but not `CAMPSITE_DELETE` in `ROLE_DEFAULT_PERMISSIONS`. So a team admin can create/edit spots but cannot delete them; only OWNER (and platform ADMIN) can delete. Granting `CAMPSITE_DELETE` to ADMIN would be a business-rule change requiring a product decision.
- **Permission codes as strings, not the Prisma enum.** `lib/team-permissions.ts` stays independent of `@prisma/client` runtime enums to avoid stale-client 500s in dev; codes are validated against `ALL_PERMISSIONS`.

## Changelog
- v2 (2026-06-23) — populated all sections; recorded CAM-83 (spot CRUD RBAC) as Done; added architecture/design/decisions
- v1 (2026-06-22) — feature created
