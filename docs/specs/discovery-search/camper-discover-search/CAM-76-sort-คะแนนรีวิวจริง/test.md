---
linear: CAM-76
feature: discovery-search
epic: camper-discover-search (CAM-33)
persona: camper
artifact: test
owner: qa
status: In Progress
version: v1
updated: 2026-06-23
---
# Test Artifact — Sort คะแนนรีวิวจริง (CAM-76)

## Test file

`__tests__/sort-utils.test.ts`

## Run result (real, 2026-06-23)

```
Tests  37 passed (37)
Test Files  1 passed (1)
```

## Coverage on new code (`lib/sort-utils.ts`)

| Dimension  | % coverage |
|------------|-----------|
| Statements | 100%      |
| Branches   | 100%      |
| Functions  | 100%      |
| Lines      | 100%      |

Command: `npx vitest run __tests__/sort-utils.test.ts --coverage --coverage.include='lib/sort-utils.ts'`

Coverage target >=80% — **met (100%)**.

## AC → test matrix

| AC# | Case | Test name (excerpt) | Layer | Pass/Fail |
|-----|------|---------------------|-------|-----------|
| AC-1 | normal — higher avg first | `higher avg appears before lower avg` | unit | PASS |
| AC-1 | normal — single-rating ordering | `avg 5 before avg 4` | unit | PASS |
| AC-1 | normal — all 5-star first, then 1-star | `all 5-star campsites first` | unit | PASS |
| AC-1 | boundary — avg 1.0 (reviewed) beats no-review | `avg 1.0 still ranks above a no-review campsite` | unit | PASS |
| AC-1 | source — rating branch reuses buildCampSiteWhere | `[source] rating branch uses buildCampSiteWhere result` | source-inspection | PASS |
| AC-2 | normal — one no-review + one reviewed → reviewed first | `one no-review camp, one reviewed → reviewed first` | unit | PASS |
| AC-2 | null/empty — two no-review camps come after any reviewed | `two no-review camps both come after any reviewed` | unit | PASS |
| AC-2 | null/empty — all no-review → stable order preserved | `all campsites have no reviews → all returned, stable` | unit | PASS |
| AC-2 | null/empty — empty input → empty result | `empty input → returns empty array` | unit | PASS |
| AC-3 | source — allowlist contains 4 documented values | `VALID_SORT allowlist contains exactly 4 values` | source-inspection | PASS |
| AC-3 | source — unknown sort → 'related' fallback | `unknown sort value falls back to 'related'` | source-inspection | PASS |
| AC-3 | source — sanitize via includes() before any branch | `sort param sanitized via VALID_SORT.includes()` | source-inspection | PASS |
| AC-4 | source — DB error → silent empty list, no error message | `DB error falls back to empty array, no new user-facing error message` | source-inspection | PASS |
| AC-5 | source — sanitizedSort === 'rating' triggers sort path | `sanitizedSort === 'rating' triggers in-memory sort path` | source-inspection | PASS |
| Rule | unit — computeAvgRating normal average | `returns average of multiple ratings` | unit | PASS |
| Rule | unit — computeAvgRating single review | `single review returns that rating unchanged` | unit | PASS |
| Rule | unit — computeAvgRating empty → null | `empty array → null` | unit | PASS |
| Rule | boundary — min rating 1 | `single rating = 1 (minimum) returns 1` | unit | PASS |
| Rule | boundary — max rating 5 | `single rating = 5 (maximum) returns 5` | unit | PASS |
| Rule | unit — stable tie-break, two equal-avg | `two campsites with identical avg preserve input order` | unit | PASS |
| Rule | unit — stable tie-break, three equal-avg | `three equal-avg campsites preserve input order` | unit | PASS |
| Rule | boundary — 40-cap: exactly 40 → all 40 returned | `40 campsites → all 40 returned` | unit | PASS |
| Rule | boundary — 40-cap: 41 → exactly 40 returned | `41 campsites → exactly 40 returned` | unit | PASS |
| Rule | boundary — 40-cap: top 40 kept (not random slice) | `the TOP 40 by rating are kept` | unit | PASS |
| Rule | boundary — 39 → all 39 returned (no under-slice) | `39 campsites → all 39 returned` | unit | PASS |
| Rule | unit — does not mutate input array | `original array order preserved after sort (non-destructive)` | unit | PASS |
| Rule | unit — input length unchanged after sort | `input length is unchanged after sort` | unit | PASS |
| Rule | source — reviews include uses deletedAt: null | `reviews include uses deletedAt: null` | source-inspection | PASS |
| Rule | source — reviews stripped before grid | `reviews array stripped before forwarding to CampgroundGrid` | source-inspection | PASS |
| Rule | source — sortByRating imported from lib/sort-utils | `sortByRating imported from @/lib/sort-utils` | source-inspection | PASS |

## Coverage matrix per AC

| AC# | normal | null/empty | boundary | error/validation | concurrent/ordering |
|-----|--------|------------|----------|-----------------|---------------------|
| AC-1 | covered | — | avg 1.0 beats null | — | stable tie-break |
| AC-2 | covered | all-null, empty input | — | — | null-last among themselves stable |
| AC-3 | source-inspected | unknown/undefined→related | — | injected value sanitized | — |
| AC-4 | source-inspected | — | — | DB error → silent [] | — |
| AC-5 | source-inspected | — | — | — | — |

## Source-inspection limitation note

`app/page.tsx` is an `async` Next.js Server Component that calls `prisma`, `auth()`, and returns JSX. Rendering it inside vitest/jsdom would require mocking Next.js server internals, prisma, next-auth, and 10+ shadcn/UI components — that would validate the mocks, not the real code. This precedent is established by CAM-79 (`review-summary.test.ts` §AC-5/AC-6 source-inspection sections). For all page.tsx AC assertions, **source-inspection tests** read the real source file and assert the exact conditional expressions, import names, and structural patterns that implement each AC. These tests will fail if the implementation is removed or structurally changed.

The pure helpers `computeAvgRating` and `sortByRating` in `lib/sort-utils.ts` are fully unit-tested (100% branch/line/statement/function coverage) with no mocking needed.

## Defects

None. All 37 tests pass. No defect sub-tickets opened.

## Prove-It notes

Key tests verified to go RED before passing with real implementation:

- `empty array → null` — fails if `computeAvgRating` returns `0` for empty arrays (NULLS-LAST comparator uses `=== null`)
- `41 campsites → exactly 40 returned` — fails without `.slice(0, 40)` (returns 41)
- `the TOP 40 by rating are kept` — fails if cap is applied before sorting
- `original array order preserved after sort` — fails if implementation uses `input.sort()` instead of `[...input].sort()`
- `higher avg appears before lower avg` — fails if `avgB - avgA` comparator is reversed or removed
