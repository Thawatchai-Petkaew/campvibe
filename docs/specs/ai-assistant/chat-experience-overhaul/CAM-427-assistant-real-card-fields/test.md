---
linear: CAM-427
feature: ai-assistant
epic: chat-experience-overhaul
persona: Camper
artifact: test
owner: qa-engineer
status: Done
version: v1
updated: 2026-07-19
---
# Test — Assistant real card fields (CAM-427)

## AC→test matrix

| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 (real price/tag/rating on the card) | H | unit | `__tests__/cam-427-ai-camp-card.test.ts` | ✅ pass |
| AC-1 (search returns real fields end-to-end) | H | integ | `__tests__/cam-270-search-campsites.test.ts` (re-pinned to `aiCampCardSelect`) | ✅ pass |
| AC-1 (options[] survives to the wire, code/group stripped) | H | integ | `__tests__/cam-427-wire-options-trim.test.ts` (QA-authored gap fix) | ✅ pass |
| AC-2 (live remaining count when dates given) | H | unit | `__tests__/cam-427-search-campsites-availability.test.ts` | ✅ pass |
| AC-2 (batched core math: partial/full/blocked) | H | unit | `__tests__/cam-427-remaining-capacity-batched.test.ts` | ✅ pass |
| AC-3 (no dates → remaining null, no query) | M | unit | `__tests__/cam-427-search-campsites-availability.test.ts` | ✅ pass |
| AC-4 (getCampDetail: amenities/reviews/reviewSummary/weekend dates) | H | unit | `__tests__/cam-427-get-camp-detail.test.ts` | ✅ pass |
| AC-5 (zero reviews → hasReviews false, never 0.0) | M | unit | `__tests__/cam-427-ai-camp-card.test.ts`, `__tests__/cam-427-get-camp-detail.test.ts` | ✅ pass |
| AC-6 (null province kept, not dropped) | M | unit | `__tests__/cam-427-ai-camp-card.test.ts`, `__tests__/cam-427-api-client-card-fields.test.ts` | ✅ pass |
| AC-7 (no altitude/distance/weather fabricated) | L | source-inspection | manual grep (see below) | ✅ pass |
| BR-1 (`aiCampCardSelect` extends, never regresses `campCardSelect`) | H | unit | `__tests__/cam-427-ai-camp-card.test.ts` (identity + regression describe blocks) | ✅ pass |
| BR-3/BR-5 (batched, never per-card; shares core w/ status fn) | H | unit | `__tests__/cam-427-remaining-capacity-batched.test.ts` (perf/N+1 guard: 5 calls total for N camps) | ✅ pass |
| BR-5 (getCampDetail: 1 availability + 1 capacity call, not per-Saturday) | H | unit | `__tests__/cam-427-get-camp-detail.test.ts` (perf/N+1 guard) | ✅ pass |
| BR-9 (additive, backward-compatible wire fields) | M | unit | `__tests__/cam-427-api-client-card-fields.test.ts` | ✅ pass |
| Regression (full pre-existing availability suite, byte-identical refactor) | H | unit | `__tests__/cam-344-availability-badge.test.ts` + full suite (unmodified, still green) | ✅ pass |

## Validation cases

- BR-1: every `campCardSelect` key present + value-equal on `aiCampCardSelect`; `campCardSelect` itself never gains `options` (regression guard).
- BR-2: `aiCampCardSelect.options` = `{where:{group:'Terrain'}, take:1}` (bounded, deterministic).
- BR-4: `remaining` semantics — open camp → `capacity`; partial → `capacity - occupied`; full → `0` (floored, never negative); host-blocked → `0` regardless of numeric headroom; unbounded capacity (`null`) → `remaining: null`.
- BR-6: `getCampDetail.reviewSummary.count` reflects the FULL `reviewCount` aggregate even when `reviews[]` (verified-only, capped) is shorter.
- BR-7: `hasReviews` derives from `reviewCount > 0` only (canonical) — a stale non-null `avgRating` alongside `reviewCount: 0` still reads `hasReviews: false` (boundary case, both card and detail).
- BR-8: a null `Location.province` coerces to `''` and never throws (defensive optional-chaining on a missing `location` object tested too); the coerced `''` value passes `isAiChatCardResponse`'s guard (not treated as malformed).
- Error/validation: `getCampDetailArgsSchema` rejects a non-UUID `campSiteId` before the tool ever runs; an unknown/not-found/unpublished/soft-deleted camp → `{ok:false, code:'not_found'}`, no partial data, no availability call made.
- Thai copy: no new user-facing Thai string was introduced by this story (data-only backend change) — the existing glossary strings this data feeds (`ยังไม่มีรีวิว`, `เต็ม`, `เหลือ {N} ที่`) are asserted by the Expression Layer (CAM-426) frontend story that consumes this data, out of this story's surface.

## Coverage

Measured via `npx vitest run --coverage` scoped to the story's touched files (real run, 2026-07-19):

| File | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| `app/api/ai/chat/route.ts` | 97.5% | 89.06% | 100% | 98.71% |
| `lib/api-client.ts` | 81.98% | 93.9% | 38.46%* | 79.12%* |
| `lib/campsite-availability.ts` | 98.19% | 88.97% | 100% | 99.5% |
| `lib/ai/tools/get-camp-detail.ts` | 95% | 91.66% | 75% | 97.36% |
| `lib/ai/tools/search-campsites.ts` | 96.77% | 100% | 83.33% | 96.55% |
| **All touched files combined** | **94.03%** | **91.17%** | 71.42%* | **94.79%** |

\* `lib/api-client.ts`'s low function/line % is pre-existing, unrelated surface in the same file (`wishlistAPI`, `operatorAPI` — untouched by this story, no new callers added here) diluting the file-level average; the CAM-427 additions in that file (`isCardTag`, the additive-field branch in `isAiChatCardResponse`) are covered by `__tests__/cam-427-api-client-card-fields.test.ts`. All new-code paths introduced by this story are ≥80%; the >80% overall combined figure is the real, measured number — not estimated.

Full suite: **221 test files / 7337 tests, all green** (was 220/7334 before this QA pass added 1 file / 3 tests to close a real gap — see Defects below).

## Defects found during independent QA verification

1. **Gap (not a production bug) — Important, closed within this QA pass.** `app/api/ai/chat/route.ts`'s `toWireCards` `options[]` trim branch (the CAM-427 code that strips `code`/`group` before the taxonomy tag reaches the client) shipped with **zero direct test** — every existing route-level fixture omitted `options`, so the branch was 100% uncovered (confirmed via `vitest --coverage`, lines 120-126). QA authored `__tests__/cam-427-wire-options-trim.test.ts` (3 cases: normal trim, empty-array EC-1, regression alongside existing CAM-272 trimming), Prove-It verified — reverted the trim branch to the pre-CAM-427 code, confirmed the new test goes **red** (`AssertionError: … + "code": "RIVE"` leaking), restored the real code, confirmed **green**. `route.ts` coverage rose from 82.81%→89.06% branch / 90.9%→100% funcs as a result. No production code was changed (route.ts diff is identical to the original PR — verified via `git diff --stat` matching before/after).

## Links

`story.md` (AC/BR) · `.claude/rules/qa.md`

## Changelog

- v1 (2026-07-19) — created; independent QA verification pass on PR #495 (branch `feature/cam-427-real-card-fields`): full suite green (221/7337), typecheck clean, lint 0 errors/255 warnings (baseline, no new debt), 1 real test-coverage gap found and closed (see Defects).
