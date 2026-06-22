---
linear: CAM-83
feature: team-access-rbac
epic: host-team-staff-rbac (CAM-38)
persona: host
artifact: test
owner: qa-engineer
status: Done
version: v1
updated: 2026-06-23
---
# Test — RBAC enforcement on spot CRUD endpoints (CAM-83)

## AC→test matrix
The spot CRUD RBAC ACs are covered by integration tests of the route handlers in `__tests__/spot-rbac.test.ts`. The handler delegates the allow/deny decision to `requireCampSitePermission`, which is mocked to return the three outcomes (allowed / 401 / 403) so the tests assert the **handler wiring** (correct permission code requested, mutation gated, DB not touched on denial). The engine's internal role→permission mapping is covered by its own `team-permissions` unit tests.

| AC | What it asserts | type | file | status |
|---|---|---|---|---|
| AC-1 — team ADMIN with `CAMPSITE_UPDATE` can create a spot | POST allowed → 201, `spot.create` called once | integ | `__tests__/spot-rbac.test.ts` | PASS |
| AC-2 — team ADMIN can update a spot | PUT allowed → 200, `spot.update` called once | integ | `__tests__/spot-rbac.test.ts` | PASS |
| AC-3 — owner can delete a spot | DELETE allowed → 200 `{success:true}`, `spot.delete` called once | integ | `__tests__/spot-rbac.test.ts` | PASS |
| AC-4 — MANAGER (no `CAMPSITE_UPDATE`) cannot create | POST denied → 403, `spot.create` NOT called | integ | `__tests__/spot-rbac.test.ts` | PASS |
| AC-6 — VIEWER/STAFF/MANAGER cannot edit; team ADMIN cannot delete | PUT 403 (no `CAMPSITE_UPDATE`); DELETE 403 for team ADMIN (has `CAMPSITE_UPDATE`, lacks `CAMPSITE_DELETE`) | integ | `__tests__/spot-rbac.test.ts` | PASS |
| AC-7 — unauthenticated is rejected | POST/PUT/DELETE → 401, no DB access | integ | `__tests__/spot-rbac.test.ts` | PASS |
| AC-8 — cross-campsite IDOR blocked | PUT/DELETE with spot not in this campsite → 404, mutation NOT called (`security-hotfix.test.ts` also asserts `findFirst({ id, campSiteId })`) | integ | `__tests__/spot-rbac.test.ts`, `__tests__/security-hotfix.test.ts` | PASS |
| AC-9 — owner always passes | allowed path → 201/200/200 | integ | `__tests__/spot-rbac.test.ts` | PASS |

AC-5 (booking `BOOKING_UPDATE` host path) is out of this story's diff scope; the booking PATCH handler already delegates to the team-permission logic and is covered by existing booking tests.

## Error-code completeness (per handler)
Each spot mutation handler fires its full contract set in `spot-rbac.test.ts`:

| Handler | 401 | 403 | 400 | 404 | success | 500 |
|---|---|---|---|---|---|---|
| `POST /spots` | ✓ | ✓ (non-member, VIEWER) | ✓ (bad body) | — | 201 ✓ | ✓ (no `details` leak) |
| `PUT /spots/[spotId]` | ✓ | ✓ (non-member, VIEWER/STAFF/MANAGER) | ✓ (bad body) | ✓ (IDOR mismatch) | 200 ✓ | ✓ (no `details` leak) |
| `DELETE /spots/[spotId]` | ✓ | ✓ (non-member, team ADMIN no `CAMPSITE_DELETE`) | — | ✓ (IDOR mismatch) | 200 ✓ | ✓ (no `details` leak) |
| `GET /spots` (public) | n/a | n/a | — | — | 200 ✓ (no permission check called) | — |

Each handler also asserts `requireCampSitePermission` was called with the **exact** expected code (`CAMPSITE_UPDATE` for POST/PUT, `CAMPSITE_DELETE` for DELETE) — proving the owner-only `requireCampSiteOwnership` is no longer used. The 500 cases assert the response body has no `details` key (no internal/secret leak).

## Validation cases
- Happy: valid body + permission → create/update/delete succeeds.
- Boundary / denial: each role lacking the required permission → 403, DB mutation never invoked (asserted via `not.toHaveBeenCalled()`).
- Error: invalid body (e.g. `pricePerNight: 'not-a-number'`) → 400 before any DB access; DB throw → 500 with suppressed details.
- IDOR: spot not belonging to the URL campsite → 404 before mutation.

## Coverage
Full suite reported **1707 tests green** in isolation. lint / typecheck / build clean. New code (the two re-wired spot handlers) is exercised across allow/401/403/400/404/201/200/500 by `spot-rbac.test.ts` plus the IDOR scope tests in `security-hotfix.test.ts` → ≥80% on new code gate: **MET** (handler branches all hit). Exact per-file coverage percentages: see the quality-gate run in `delivery.md`.

## Defects found
None. No defect sub-ticket opened.

## Links
`story.md` (AC) · `tech.md` · `.claude/rules/qa.md` · `__tests__/spot-rbac.test.ts` · `__tests__/security-hotfix.test.ts`

## Changelog
- v1 (2026-06-23) — created; AC→test map + per-handler error-code completeness; full suite 1707 green
