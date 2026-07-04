---
linear: CAM-83
feature: team-access-rbac
epic: host-team-staff-rbac (CAM-38)
persona: host
artifact: delivery
owner: devops-release
status: Done
version: v1
updated: 2026-06-23
---
# Delivery — RBAC enforcement on spot CRUD endpoints (CAM-83)

## PR & preview
- PR: **#105** → base `staging` (merged). Branch updated to the latest `staging` before merge so CI ran against current integration state.
- Preview: Vercel ephemeral preview (auto-comment on the PR).
- Quality-gate (pre-merge): lint clean · typecheck clean · build clean · test **1707 green** (full suite, in isolation) · `npm audit --omit=dev` **0 high / 0 critical** (2 moderate pre-existing PostCSS via `next`) · security review **PASS** (`review.md`) · design gate n/a (no UI change).
- Roles: backend (re-wire handlers) → security (6-area + STRIDE review) → devops (gate + merge).

## Migration
- **None** — no schema change; reuses the existing `requireCampSitePermission` engine and `ROLE_DEFAULT_PERMISSIONS` matrix. No `prisma migrate` on staging or prod; DBs unchanged.

## Staging verify (G4)
- Merged to `staging` → Linear state **Done**. AC verified against the permission matrix on the spot CRUD endpoints (team ADMIN allowed for create/edit; team ADMIN denied for delete; VIEWER/non-member 403; unauth 401; cross-campsite IDOR 404) on the real Staging URL (`campvibe-staging.vercel.app`).

## Release (G5)
- **Pending** — promote `staging`→`main` after explicit G5 approval (release-train batch).
- Rollback plan: **revert PR #105**. No migration → revert is a pure code rollback, no data step required.
- Error watch: post-deploy Sentry window — pending (runs at G5).

## Follow-ups (to be ticketed)
- **bcrypt cost 10 → ≥12** in `lib/actions.ts` registration (Important, pre-existing — flagged in `review.md`; route to a backend ticket).
- **Structured audit-log on spot mutations** (Suggestion — `review.md`).
- (Optional hardening) collapse `campSiteId` into the spot `update`/`delete` `where` clause (Suggestion — defense-in-depth).
- **CAM-90** — full RBAC enforcement audit across the remaining owner-only `/api/team/members*` endpoints (epic Out of scope).

## Links
- `story.md` (AC) · `tech.md` · `review.md` · `test.md` · `.claude/rules/ops.md`

## Changelog
- v1 (2026-06-23) — created; PR #105 merged to staging, gate green, no migration, G4 Done, G5 pending (rollback = revert PR), follow-ups listed
