---
linear: CAM-83
feature: team-access-rbac
epic: host-team-staff-rbac (CAM-38)
persona: host
artifact: tech
owner: architect
status: Done
version: v1
updated: 2026-06-23
---
# Tech — RBAC enforcement on spot CRUD endpoints (CAM-83)

## Data model
No schema change, no migration. The story re-wires existing handlers onto the existing authorization engine. Entities involved (read-only to this story):

- `Spot` — `id`, `campSiteId` (FK → `CampSite`). The `campSiteId` scope is the IDOR anchor.
- `CampSite` — `id`, `operatorId` (FK → `User`, the owner).
- `CampSiteTeamMember` — `userId`, `campSiteId`, `role: TeamRole`, `permissions: string[]` (explicit override; empty = use role default), `isActive`.

## API contract (per handler)

The gate is `requireCampSitePermission(campSiteId, code)` from `lib/auth-utils.ts`, replacing the previous owner-only `requireCampSiteOwnership(campSiteId)`. Pattern mirrors the campsite route handlers.

| Method / Path | Permission code | authz call | Error codes | Satisfies |
|---|---|---|---|---|
| `POST /api/campsites/[id]/spots` | `CAMPSITE_UPDATE` | `requireCampSitePermission(id, 'CAMPSITE_UPDATE')` | 401 · 403 · 400 (zod) · 201 · 500 | AC-1, AC-4, AC-7, AC-9 |
| `PUT /api/campsites/[id]/spots/[spotId]` | `CAMPSITE_UPDATE` | `requireCampSitePermission(id, 'CAMPSITE_UPDATE')` | 401 · 403 · 400 (zod) · 404 (IDOR) · 200 · 500 | AC-2, AC-6, AC-7, AC-8, AC-9 |
| `DELETE /api/campsites/[id]/spots/[spotId]` | `CAMPSITE_DELETE` | `requireCampSitePermission(id, 'CAMPSITE_DELETE')` | 401 · 403 · 404 (IDOR) · 200 · 500 | AC-3, AC-6, AC-7, AC-8, AC-9 |
| `GET /api/campsites/[id]/spots`, `GET …/[spotId]` | — (public read by design) | none | 200 · 404 · 500 | out of scope (unchanged) |

Response shape unchanged: `apiSuccess(data, status)` / `apiError(message, status)`; on 5xx, `details` is suppressed (no stack/secret leak).

## Three-tier precedence (inside `requireCampSitePermission`)

The gate decides allow/deny in this fixed order; first match wins:

1. **Authn** — no session → `401 Unauthorized` (before any DB read of the campsite for the member path).
2. **Campsite exists** — `campSite.findUnique({ where: { id } })` null → `404 Camp site not found`.
3. **Platform ADMIN** — `session.user.role === 'ADMIN'` → allow (cross-camp platform admin).
4. **Owner** — `campSite.operatorId === session.user.id` → allow (owner always passes).
5. **Team member** — `campSiteTeamMember.findFirst({ userId, campSiteId, isActive: true })`; if no active membership → `403`. Otherwise compute `getEffectivePermissions({ role, permissions })` (explicit non-empty `permissions` override the role default) and require `hasPermission(eff, code)`; missing → `403 Forbidden` (default-deny).

## Role → permission matrix (`ROLE_DEFAULT_PERMISSIONS`, `lib/team-permissions.ts`)

| Role | `CAMPSITE_UPDATE` (create/edit spot) | `CAMPSITE_DELETE` (delete spot) | Net effect on spots |
|---|---|---|---|
| OWNER | ✓ (all permissions) | ✓ | create / edit / delete |
| ADMIN | ✓ | ✗ | create / edit, **cannot delete** (by design) |
| MANAGER | ✗ | ✗ | none (403) |
| STAFF | ✗ | ✗ | none (403) |
| VIEWER | ✗ | ✗ | none (403) |

Platform ADMIN (account `role`, not a team role) and the camp owner bypass the matrix and always pass. The ADMIN-no-delete asymmetry is intentional: deleting spots is destructive and reserved for OWNER + platform ADMIN; granting `CAMPSITE_DELETE` to team ADMIN would be a business-rule change requiring a product decision (epic Out of scope).

## IDOR scoping (preserved, not removed)
After the permission gate passes, PUT/DELETE re-verify the spot belongs to the campsite in the URL before mutating: `prisma.spot.findFirst({ where: { id: spotId, campSiteId: id }, select: { id: true } })` → null returns `404` and the `update`/`delete` is never reached. This blocks an authorized member of campsite A from mutating a spot of campsite B by ID. GET uses the same `{ id: spotId, campSiteId: id }` scope.

## ADRs
— (no hard-to-reverse decision; reuses the existing engine and matrix)

## Links
`../../feature.md` (## Architecture overview) · `prisma/schema.prisma` · `lib/auth-utils.ts` · `lib/team-permissions.ts` · `story.md`

## Changelog
- v1 (2026-06-23) — created; per-handler permission mapping, three-tier precedence, role matrix, IDOR scoping
