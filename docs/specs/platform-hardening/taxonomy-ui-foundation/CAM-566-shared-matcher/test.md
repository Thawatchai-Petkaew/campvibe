---
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: platform
artifact: test
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-26
---
# Test — One shared AdminArea matcher (CAM-566)

## AC→test matrix
| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 (one module, both/all callers) | H | unit + integ | `__tests__/cam-566-admin-area-match.test.ts` (new) + `npm run typecheck` (unresolved-reference guard, EC-1) | ✅ |
| AC-2 (existing suites pass unedited) | H | integ | `__tests__/cam-554-geocode-routes.test.ts`, `__tests__/cam-563-location-admin-area-backfill.test.ts`, `__tests__/cam-563-location-route-admin-area.test.ts` (all run unedited) | ✅ 86/86 |
| AC-3 (bilingual, same node) | H | unit | `__tests__/cam-566-admin-area-match.test.ts` "(b) bilingual match resolves the SAME node" | ✅ |
| AC-4 (CAM-562 path/signature unchanged) | H | source-inspection + reasoning (PR #646 lives on an unmerged branch, not runnable here) | `tech.md` "Coordination with CAM-562" section; verified by reading `origin/feat/cam-562-backfill-subdistricts`'s actual import statement and confirming the target file/export/signature are all unchanged | ✅ |
| AC-5 (union of edge cases preserved) | H | unit | `__tests__/cam-566-admin-area-match.test.ts` (all describe blocks — each pins one row of `tech.md`'s enumerated-diff table) | ✅ 24/24 |

## Validation cases (per BR-n)
- BR-1 (internal normalize + empty-name short-circuit): "matchAdminArea: null/empty + the empty-name short-circuit" — proves zero DB round-trips on an empty-after-strip name (`findFirstSpy` call-count assertion).
- BR-2 (full node return): "matchAdminArea: returns the FULL node" — exact-shape `toEqual` assertion.
- BR-3 (null/undefined-safe normalizeAdminName): "(a) normalizeAdminName" null/undefined cases.
- BR-4 (backfill script re-export names/signature unchanged): existing `__tests__/cam-563-location-admin-area-backfill.test.ts` imports `normalizeAdminAreaName`/`matchAdminAreaByName`/`resolveLocationAdminAreaId` from the SAME path with the SAME signature, unedited, still green.
- BR-5 (route never calls level PROVINCE): existing `__tests__/cam-563-location-route-admin-area.test.ts`'s `[regression]`/`[null/empty]` cases assert `mockAdminAreaFindFirst` is NOT called when there's no district/subDistrict to resolve — unedited, still green.

## Coverage
`lib/geo/admin-area-match.ts` is entirely new code, exercised directly by 24 unit tests (every exported function, every branch: prefix/suffix strip × null/undefined/empty/boundary, matchAdminArea × bilingual/hierarchical/parent-scoping/empty-short-circuit/exact-match/concurrent) plus indirectly by the 86 existing integration tests through its 3 callers. Not run through the coverage tool in this session (`npm test -- --coverage` not invoked); every branch in the module is visibly hit by an explicit assertion above — visual/manual coverage is complete, tool-measured % is "not measured".

## Links
`story.md` (AC/BR) · `tech.md` (the enumerated diff each test pins) · `.claude/rules/qa.md`

## Changelog
- v1 (2026-07-26) — created.
