---
linear: CAM-76
feature: discovery-search
epic: camper-discover-search (CAM-33)
persona: camper
artifact: tech
owner: architect
status: Backlog
version: v1
updated: 2026-06-23
---
# Tech — Sort คะแนนรีวิวจริง (CAM-76)

## Chosen approach: (a) in-memory sort after `findMany`

### Decision

Use approach (a): call `prisma.campSite.findMany` with the existing `buildCampSiteWhere` where-clause, select `reviews: { where: { deletedAt: null }, select: { rating: true } }` alongside the fields already fetched, compute `avgRating` per campsite in JS, sort descending with `null` last, then slice to 40.

### Why (a) over (b) and (c)

**(b) `groupBy _avg` is eliminated first.** `prisma.review.groupBy` operates on the `Review` table — it cannot apply the `CampSite` where-clause built by `buildCampSiteWhere` (province, keyword, capacity, facilities, etc.). Zero-review campsites are also absent from a `groupBy` result, so you would still need a second query for them and an in-app merge + sort. Net result: more queries and more code than (a), with no benefit at current scale.

**(c) raw SQL is eliminated second.** A `LEFT JOIN + AVG + ORDER BY … DESC NULLS LAST` raw query must re-express the entire `buildCampSiteWhere` filter in SQL. `buildCampSiteWhere` is maintained TypeScript; duplicating it in SQL creates two sources of truth that will drift. The risk of silent filter divergence is higher than the marginal query-plan benefit at ~12 campsites.

**(a) is correct for the current dataset.** At the current catalog size (confirmed ~12 published campsites), fetching all matching campsites with their non-deleted review ratings in one round-trip is not an unbounded fetch. The `take: 40` cap on the final result applies after the in-memory sort. No existing index is wasted, `buildCampSiteWhere` is reused exactly, and the sort logic is a pure JS function — independently testable by QA without a DB.

**Scale guard (mandatory):** This approach is bounded by the number of published campsites matching the filter, not by the total review count (only `rating` is selected, not full Review rows). If the catalog grows beyond ~200 published campsites, the correct follow-up is to add a stored `CampSite.avgRating Float?` column updated by a trigger or background job — that path is already flagged in the story's `## Out of scope` as a separate ticket (C-2.5). The backend engineer must add a code comment at the sort site naming this threshold and pointing to C-2.5 so it is never silently bypassed.

---

## Query pseudo-code (backend implements this exactly)

```ts
// lib/campsite-filters.ts — UNCHANGED. buildCampSiteWhere is reused verbatim.

// app/page.tsx — replace the `sort === 'rating'` block:

// 1. Sanitize the sort param before any use
const VALID_SORT = ['related', 'price_asc', 'price_desc', 'rating'] as const;
type SortParam = typeof VALID_SORT[number];
const sanitizedSort: SortParam = VALID_SORT.includes(sort as SortParam)
  ? (sort as SortParam)
  : 'related';

// 2. For all sorts except 'rating', build the Prisma orderBy as today
let orderBy: Prisma.CampSiteOrderByWithRelationInput =
  sanitizedSort === 'price_asc'  ? { priceLow: 'asc' }  :
  sanitizedSort === 'price_desc' ? { priceLow: 'desc' } :
  { createdAt: 'desc' }; // 'related' default

// 3. Fetch — for 'rating', include review ratings; for all others, omit (no extra payload)
let campSites: CampSiteWithReviews[] = [];
try {
  if (sanitizedSort === 'rating') {
    // SCALE GUARD: in-memory sort is valid up to ~200 published campsites.
    // When the catalog exceeds that threshold, replace with stored CampSite.avgRating (C-2.5).
    const rows = await prisma.campSite.findMany({
      where,                     // buildCampSiteWhere result — unchanged
      include: {
        location: true,
        operator: { select: { name: true } },
        images:   { orderBy: { sortOrder: 'asc' } },
        _count:   { select: { reviews: true } },
        reviews:  {
          where:  { deletedAt: null },   // exclude soft-deleted reviews
          select: { rating: true },      // only the Pixel we need; no N+1
        },
      },
      // No orderBy — JS sort below takes over
    });

    // Pure helper — extract so QA can unit-test without a DB
    campSites = sortByRating(rows);  // see helper below
  } else {
    campSites = await prisma.campSite.findMany({
      where,
      include: {
        location: true,
        operator: { select: { name: true } },
        images:   { orderBy: { sortOrder: 'asc' } },
        _count:   { select: { reviews: true } },
      },
      orderBy,
      take: 40,
    });
  }
} catch (error) {
  console.error('Database connection error:', error);
  campSites = []; // AC#4: DB error → silent empty list
}
```

---

## Pure helper `sortByRating` (extract to `lib/sort-utils.ts`)

Extracting this function makes it independently unit-testable by QA without a DB fixture.

```ts
// lib/sort-utils.ts

export interface WithReviewRatings {
  reviews: { rating: number }[];
  [key: string]: unknown;
}

/**
 * Compute AVG(Review.rating) per campsite, sort descending, campsites with no
 * non-deleted reviews last (NULLS LAST), cap at 40.
 *
 * Source Pixels: Review.rating (Int 1-5), Review.deletedAt (already filtered
 * in the Prisma query — rows passed here have deletedAt: null only).
 *
 * SCALE GUARD: valid for catalogs up to ~200 published campsites.
 * When the catalog exceeds that threshold, replace with a stored
 * CampSite.avgRating column updated by a background job (C-2.5).
 */
export function computeAvgRating(reviews: { rating: number }[]): number | null {
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return sum / reviews.length;
}

export function sortByRating<T extends WithReviewRatings>(campsites: T[]): T[] {
  return [...campsites]
    .sort((a, b) => {
      const avgA = computeAvgRating(a.reviews);
      const avgB = computeAvgRating(b.reviews);
      // NULLS LAST: null always goes after a real number
      if (avgA === null && avgB === null) return 0;
      if (avgA === null) return 1;
      if (avgB === null) return -1;
      return avgB - avgA; // descending
    })
    .slice(0, 40); // cap matches all other sort modes (Rules §4)
}
```

**Why a pure function:** `computeAvgRating` and `sortByRating` have no I/O — QA can write unit tests that pass arrays of objects with review ratings and assert order, null-last placement, and the 40-cap without any Prisma mock or DB seed. This directly satisfies the story's `## Self-verify` test requirement.

---

## Sort param sanitization (AC#5 + Rules §5)

The raw `sort` value from `searchParams` is an untrusted string from the URL. Sanitize it before any branch:

```ts
// Runs once at the top of the Server Component, before orderBy or query
const VALID_SORT = ['related', 'price_asc', 'price_desc', 'rating'] as const;
type SortParam = typeof VALID_SORT[number];

const sanitizedSort: SortParam =
  typeof sort === 'string' && (VALID_SORT as readonly string[]).includes(sort)
    ? (sort as SortParam)
    : 'related'; // anything outside the allowlist → default
```

This ensures:
- `?sort=rating` deep-links work correctly from SSR (AC#5) because `sanitizedSort === 'rating'` triggers the in-memory sort path.
- `?sort=<injected>` or `?sort=` never reaches `buildCampSiteWhere` or any Prisma field.
- SortDropdown already marks "คะแนนรีวิว" active when `sort === 'rating'` from the URL — no change needed there.

---

## Data model

No schema change. This story is a query-layer change only.

Fields touched (existing Pixels, no migration):
- `Review.rating: Int` — source Pixel, classification: Public
- `Review.deletedAt: DateTime?` — soft-delete guard, classification: Public
- `Review.campSiteId: String` — join key (already indexed: `@@index([campSiteId])`)
- `CampSite.id: String` — join key

No new fields. No migration. `npx prisma validate` passes unchanged.

---

## API contract

This story modifies the Server Component data-fetch in `app/page.tsx` (SSR, not an `/api/*` route). There is no REST endpoint change. The rendered HTML output for `?sort=rating` is the "contract" — the CampgroundGrid receives the same serialized shape as today (`serializeDecimals` call is unchanged), the `reviews` array is NOT passed to the grid (it is dropped after sorting; the card component does not consume it).

Boundary clarification: `reviews` is selected only for the sort computation and must not be forwarded to the client component. The backend engineer must ensure `campSites` passed to `<CampgroundGrid>` does not include the raw `reviews` array (strip it before `serializeDecimals`, or use a mapped type).

```ts
// After sortByRating, strip reviews before passing to the grid
const campSitesForGrid = campSites.map(({ reviews: _reviews, ...rest }) => rest);
```

---

## Files backend must touch

1. `app/page.tsx` — replace the `sort === 'rating'` fallback block; add sort-param sanitization; add the `reviews: { where: { deletedAt: null }, select: { rating: true } }` include branch; strip reviews before forwarding to grid.
2. `lib/sort-utils.ts` — create new file with `computeAvgRating` and `sortByRating` (pure helpers for QA).

No other files need changing. `lib/campsite-filters.ts` is untouched.

---

## Performance note

- Single Prisma query for the rating path: `findMany` with `include: { reviews: { where: { deletedAt: null }, select: { rating: true } } }`. This is one round-trip, not N+1 (the `include` uses a subquery per Prisma's relation-load strategy, not a loop).
- Only `rating` is selected from `Review` — no full Review row payload.
- `@@index([campSiteId])` on `Review` is already present in `prisma/schema.prisma` (line 432) — the subquery is indexed.
- In-memory sort: O(n log n) on the filtered result set. At ~12 campsites this is negligible. At 40 campsites (the take cap after sort) it is still negligible.
- Performance metrics: not measured (current catalog scale; baseline measurement is not applicable before the bug fix ships).

---

## ADRs

No ADR needed. Rationale: the chosen approach (a) is a query-layer computation change with no schema migration, no new entity, no cross-module boundary change, and no hard-to-reverse decision. The only viable trade-off (stored `avgRating` column) is already documented in the story's `## Out of scope` as a future ticket (C-2.5) and in the scale guard comment in the code. An ADR would add overhead without adding clarity beyond what is already in this tech artifact and the story's `## Data` section.

---

## Links

`story.md` · `lib/campsite-filters.ts` · `lib/sort-utils.ts` (new) · `app/page.tsx` · `prisma/schema.prisma` (unchanged)

## Changelog
- v1 (2026-06-23) — created; approach (a) chosen with scale guard; `sortByRating` helper extracted; sanitize contract specified
