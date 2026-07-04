---
artifact: epic
feature: team-access-rbac
epic: host-team-staff-rbac (CAM-38)
status: Done
version: v2
updated: 2026-06-23
---
# Host: team & staff (RBAC) (CAM-38)

## Why
A Host should be able to delegate camp operations to teammates by role instead of sharing the owner login. The 5-role permission model existed in `lib/team-permissions.ts`, but several camp-scoped endpoints still gated on owner-only, so the matrix was not actually enforced. · **KPI:** a team member holding the right permission (`CAMPSITE_UPDATE` / `CAMPSITE_DELETE`) can perform the corresponding spot operation via the API (verified with team ADMIN), and 0 spot CRUD endpoints remain on owner-only checks.

## Scope
- In: enforce the existing 5-role RBAC matrix on the spot CRUD surface — swap owner-only `requireCampSiteOwnership` for permission-based `requireCampSitePermission(id, code)` on `POST`/`PUT`/`DELETE` of spots, preserving owner + platform-ADMIN access, default-deny, and the existing spot↔campsite IDOR scoping (CAM-83).
- Out:
  - Full RBAC enforcement audit across the remaining endpoints — the team-member management routes (`GET`/`POST` `/api/team/members`, `PATCH`/`DELETE` `/api/team/members/[id]`) still use owner-only checks with a "will add permission check later" TODO → **CAM-90**.
  - Invite a not-yet-registered user by email → product-plan **H-7.3** (separate story).
  - Granting `CAMPSITE_DELETE` to role ADMIN in the default matrix — a business-rule change requiring a product decision.
  - UI that shows/hides spot and booking controls by permission → UX/Frontend follow-up.

## Stories
| CAM | Story | Role rotation | Status |
|---|---|---|---|
| CAM-83 | RBAC enforcement on spot CRUD endpoints (owner-only → permission-based) | backend → security → devops | Done |

## Links
`../feature.md` · Master-Plan item H-7 (`docs/project/product-plan.md`) · ADRs (`docs/adr/*`)

## Changelog
- v2 (2026-06-23) — populated Why/KPI, Scope (in/out + follow-up routing), Stories rollup; CAM-83 Done
- v1 (2026-06-22) — epic scoped
