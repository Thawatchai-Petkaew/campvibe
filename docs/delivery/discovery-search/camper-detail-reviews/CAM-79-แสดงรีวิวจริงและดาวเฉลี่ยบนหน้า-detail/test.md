---
linear: CAM-79
feature: discovery-search
epic: camper-detail-reviews (CAM-34)
persona: camper
artifact: test
owner: qa
status: In Progress
version: v1
updated: 2026-06-23
---
# Test — แสดงรีวิวจริงและดาวเฉลี่ยบนหน้า detail (CAM-79)

## Test file

`__tests__/review-summary.test.ts`

## Run results (real run, 2026-06-23)

```
Test Files  1 passed (1)
Tests       51 passed (51)
Duration    85ms
```

Full suite (regression guard): 35 files, 1979 tests, 0 failures.

## Coverage — lib/review-summary.ts

Real run via `npx vitest run --coverage --coverage.include="lib/review-summary.ts"`:

| Metric | % | Covered / Total |
|--------|---|-----------------|
| Statements | 100% | 6/6 |
| Branches   | 100% | 8/8 |
| Functions  | 100% | 3/3 |
| Lines      | 100% | 5/5 |

New-code coverage: **100%** (target ≥80%).

## AC → test matrix

| AC# | Test case | Test ID / describe label | Layer | Pass/Fail |
|-----|-----------|--------------------------|-------|-----------|
| AC-1 (rating display) | `roundAvgRating(4.16667)` → 4.2 | `[normal] rounds 4.16667 to 4.2` | unit | PASS |
| AC-1 | `buildReviewSummary({avg:4.16667, count:5})` → hasReviews:true, avgRating:4.2 | `[normal] count=5, avg=4.16667` | unit | PASS |
| AC-1 | Whole number `roundAvgRating(4)` → 4 | `[boundary] whole number 4 returns 4` | unit | PASS |
| AC-1 | Exact .5 boundary `roundAvgRating(4.5)` → 4.5 | `[boundary] 4.5 rounds to 4.5` | unit | PASS |
| AC-1 | Min rating 1, max rating 5 round-trip | `[boundary] minimum/maximum rating` | unit | PASS |
| AC-2 (no reviews) | `buildReviewSummary({avg:null, count:0})` → hasReviews:false, avgRating:null | `[null/empty] count=0 → hasReviews:false, avgRating:null` | unit | PASS |
| AC-2 | count=0 with non-null avg still nulls avgRating | `[null/empty] count=0 even with non-null avg` | unit | PASS |
| AC-2 | `roundAvgRating(null)` → null | `[null/empty] null avg returns null` | unit | PASS |
| AC-2 | `th.reviews.noReviews` === "ยังไม่มีรีวิว" (verbatim) | Thai copy verbatim group | unit | PASS |
| AC-3 (review list item) | author.name present → used | `[normal] author.name present → used as name` | unit | PASS |
| AC-3 | author.name null → 'ผู้ใช้งาน' | `[null/empty] author.name is null` | unit | PASS |
| AC-3 | author null → 'ผู้ใช้งาน' | `[null/empty] author itself is null` | unit | PASS |
| AC-3 | content null preserved as null (no empty box) | `[null/empty] content null is preserved as null` | unit | PASS |
| AC-3 | createdAt preserved by mapper (ordering is DB query's job) | `[normal] createdAt is preserved exactly` | unit | PASS |
| AC-3 | `th.reviews.authorFallback` === "ผู้ใช้งาน" (verbatim) | Thai copy verbatim group | unit | PASS |
| AC-4 (empty section) | `th.reviews.noReviewsSection` === "ยังไม่มีรีวิวสำหรับแคมป์นี้" (verbatim) | Thai copy verbatim group | unit | PASS |
| AC-4 | `th.reviews.sectionHeading` === "รีวิว" (verbatim) | Thai copy verbatim group | unit | PASS |
| AC-4 | CampgroundDetailClient has data-testid="empty--reviews" | source-inspection (AC-6 group) | source-inspect | PASS |
| AC-5 (view all) | count=10 → >10 is false (no button) | `[logic] count=10 → does NOT satisfy >10` | unit | PASS |
| AC-5 | count=11 → >10 is true (button shown) | `[logic] count=11 → satisfies >10` | unit | PASS |
| AC-5 | source uses `reviewCount > 10` (strict, not >=10) | `[source] "ดูรีวิวทั้งหมด" button is rendered when reviewCount > 10` | source-inspect | PASS |
| AC-5 | btn--reviews-view-all testid present in source | `[source] btn--reviews-view-all testid present` | source-inspect | PASS |
| AC-5 | `th.reviews.viewAll` === "ดูรีวิวทั้งหมด" (verbatim) | Thai copy verbatim group | unit | PASS |
| AC-6 (error isolation) | page.tsx sets reviewsError=true, does NOT call notFound() in review catch | `[source] review try/catch sets reviewsError=true` | source-inspect | PASS |
| AC-6 | page.tsx has ≥3 isolated try blocks | `[source] review query in own isolated try block` | source-inspect | PASS |
| AC-6 | both review queries use deletedAt:null | `[source] both review queries use deletedAt:null` | source-inspect | PASS |
| AC-6 | CampgroundDetailClient renders data-testid="error--reviews" | `[source] renders error--reviews when reviewsError` | source-inspect | PASS |
| AC-6 | error branch uses t.reviews.loadError | `[source] reviewsError branch shows t.reviews.loadError` | source-inspect | PASS |
| AC-6 | `th.reviews.loadError` === "ไม่สามารถโหลดรีวิวได้ในขณะนี้" (verbatim) | Thai copy verbatim group | unit | PASS |
| Security | DTO has no authorId key | `[security] returned DTO has NO authorId key` | unit | PASS |
| Security | DTO has no author key (no author.id leak) | `[security] returned DTO has NO author.id key` | unit | PASS |
| Security | DTO shape is exactly {name, rating, content, createdAt} | `[security] DTO shape has exactly the four expected keys` | unit | PASS |
| Security | no hardcoded "4.8" or "12 รีวิว" in CampgroundDetailClient | `[source] no hardcoded "4.8" or "12 รีวิว"` | source-inspect | PASS |

Total tests in file: **51** (9 pure-logic coverage cases not itemised above complete boundary/null/error matrix for roundAvgRating and buildReviewSummary).

## Layer rationale for source-inspection tests

**AC-5 ("ดูรีวิวทั้งหมด" boundary) and AC-6 (error isolation)** use source-inspection rather than component rendering. `CampgroundDetailClient.tsx` is a `"use client"` component that imports lucide-react, next/dynamic, date-fns, shadcn/ui, LanguageContext, and multiple API clients. Rendering it in vitest/jsdom would require mocking >15 module boundaries; the test would then validate the mocks, not the real component logic. Per the CAM-58 precedent and `.claude/rules/qa.md §6` ("mock only the external boundary"), source-inspection is the correct layer: it asserts the exact JSX conditional (`reviewCount > 10`), the data-testid values, and the i18n key wiring — the same things a render test would assert, without invalidating the assertion by over-mocking.

The `app/campgrounds/[slug]/page.tsx` error-isolation pattern (AC-6) is also source-inspected: it is a Next.js Server Component calling `prisma` and `notFound()`, neither of which can be exercised in vitest without mocking the entire Next.js runtime and a Prisma client. The source-inspection confirms the structural guarantee: review try/catch is separate from the campsite try/catch, sets `reviewsError = true`, and never calls `notFound()`.

## Defects found

None. No defect sub-tickets raised.

## Quality gate

- `npm test` — 51/51 tests pass (35 files, 1979 total, 0 failures)
- `npm run typecheck` — passes (0 errors)
- `npm run lint` — 0 new warnings in `__tests__/review-summary.test.ts` (pre-existing repo warnings untouched)
- Coverage on `lib/review-summary.ts` — **100%** statements / branches / functions / lines (target >=80%)

## Limitations / not measured

- E2e Playwright test against the Staging URL is NOT included in this artifact. Per `.claude/rules/ops.md`, Done = AC verified on the real Staging URL after merge — that verification is a human step post-merge, not a local automated test.
- Component render test for `CampgroundDetailClient.tsx` is not feasible in vitest/jsdom without mocking the Next.js client boundary and 15+ dependencies (documented above). Source-inspection covers the conditional logic at the correct fidelity.
