---
linear: CAM-193
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
persona: platform
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-06-26
---
# Test — PERF-5 DB rating sort + avgRating column (CAM-193)

## AC→test matrix

| AC | test-id | layer | file | pass/fail |
|---|---|---|---|---|
| AC-1 campCardSelect: avgRating true, reviewCount true, reviews absent, PERF-1 intact | `section--camp-card-select-shape` | unit (direct import) | `__tests__/cam-193-perf5-db-rating-sort.test.ts` | PASS |
| AC-2 app/page.tsx: single findMany, orderBy avgRating desc nulls last, take:40, no sortByRating | `section--page-db-sort` | source-inspect | `__tests__/cam-193-perf5-db-rating-sort.test.ts` | PASS |
| AC-3 migration: single CREATE INDEX on (isPublished, deletedAt, avgRating, id), additive only | `section--perf5-migration` | source-inspect | `__tests__/cam-193-perf5-db-rating-sort.test.ts` | PASS |
| AC-4 serializeDecimals: Prisma.Decimal → number; null preserved; nested/array shapes | `section--serialize-decimals` | unit (real Prisma.Decimal) | `__tests__/cam-193-perf5-db-rating-sort.test.ts` | PASS |
| AC-5 null handling: CampSiteCardData.avgRating typed number\|null; card guards null display | `section--null-handling` | source-inspect | `__tests__/cam-193-perf5-db-rating-sort.test.ts` | PASS |
| AC-6 helpers retained: sortByRating/computeAvgRating exported; wishlist page out of scope | `section--helpers-retained` | unit + source-inspect | `__tests__/cam-193-perf5-db-rating-sort.test.ts` | PASS |

## Validation cases per AC

AC-1 (campCardSelect shape):
- normal: avgRating === true, reviewCount === true
- absent: `'reviews' in campCardSelect` === false
- regression: images.take === 5, images.orderBy.sortOrder === 'asc', location.select.province === true (PERF-1 intact)

AC-2 (page.tsx DB-sort path):
- normal: exactly 1 campSite.findMany, orderBy shape `{ avgRating: { sort: 'desc', nulls: 'last' } }`, take: 40
- removed: .slice(0, 40) absent; sortByRating absent; sort-utils import absent
- sanitize: VALID_SORT includes 'rating'; select: campCardSelect appears exactly once

AC-3 (migration):
- additive: CREATE INDEX present; no DROP, no ALTER TABLE, no ADD COLUMN, no TRUNCATE, no DELETE FROM
- index-name: exact `CampSite_isPublished_deletedAt_avgRating_id_idx`
- column-order: isPublished < deletedAt < avgRating < id in the index tuple
- single: exactly one SQL statement (no extra operations)

AC-4 (serializeDecimals unit tests with real Prisma.Decimal):
- normal: Decimal('4.3') → number 4.3
- boundary: Decimal('5.0') → 5; Decimal('1.0') → 1
- null/empty: null → null; undefined → undefined
- nested object: { avgRating: Decimal('4.3') } → { avgRating: 4.3 }
- null in object: { avgRating: null } → { avgRating: null }
- array: each Decimal converted; null items preserved

AC-5 (null handling contract):
- type guard: CampSiteCardData.avgRating typed as `number | null`
- card guard: `reviewCount > 0 && avgRating != null` before star render
- fallback: empty-rating slot present (`data-testid="empty--card-rating"`)
- grid wiring: avgRating and reviewCount forwarded from camp object

AC-6 (helpers retained):
- sortByRating importable, descending nulls-last behavior confirmed
- computeAvgRating importable, returns null for empty, correct average
- app/wishlist/page.tsx does NOT import campCardSelect (out-of-scope scope guard)
- wishlist page still has its own `deletedAt: null` reviews select

## Coverage

Real run from `npx vitest run --coverage __tests__/cam-193-perf5-db-rating-sort.test.ts`:

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| lib/serialize.ts | 93.33% | 90% | 100% | 100% |
| lib/sort-utils.ts | 86.66% | 70% | 100% | 100% |
| All measured files | 90.32% | 80% | 100% | 100% |

Full suite (3011 tests, 58 files): all PASS.
New file adds 47 tests; no pre-existing tests broken.

## Staging-verify note (non-automated)

After merge to staging, verify on the real Staging URL (campvibe-staging.vercel.app):
- `?sort=rating` returns camps ordered by descending avgRating (highest first, 0-review camps last).
- JSON response for `/api/campsites` and `/api/campgrounds` has `avgRating` as a number (not string), `reviewCount` as an integer, and no `reviews` array (smaller payload).

## Links

`story.md` (AC/BR) · `tech.md` · `.claude/rules/qa.md` · `__tests__/cam-193-perf5-db-rating-sort.test.ts`

## Changelog

- v1 (2026-06-26) — created: 47 tests across AC-1 to AC-6; all green; coverage ≥80% on all measured files
