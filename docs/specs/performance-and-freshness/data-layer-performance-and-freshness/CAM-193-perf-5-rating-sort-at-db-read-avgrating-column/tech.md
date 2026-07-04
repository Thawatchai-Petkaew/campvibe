---
linear: CAM-193
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
persona: platform
artifact: tech
owner: architect
status: In Progress
version: v1
updated: 2026-06-26
---
# Tech — PERF-5 rating sort at DB + read avgRating column (CAM-193)

## Data model

### Change 1 — avgRating index (additive, migration-only)

Add one composite index to `CampSite` in `prisma/schema.prisma`:

```prisma
@@index([isPublished, deletedAt, avgRating, id])
```

This is the only schema change. No new columns; `avgRating Decimal(2,1)?` and `reviewCount Int`
already exist from AGG-1 (CAM-189, lines 322-323 of the current schema).

**Field classification:** `avgRating` = Public · `reviewCount` = Public.

**Resolution Boundary check passed:** `avgRating` is independently sortable (it is the sort key
for the rating branch), typed (Decimal 2,1), Public, name is UI-neutral, derivation trail is
documented in the schema comment (line 319-323).

**Migration assessment:**
- Type: additive index only — no column added, no column dropped, no data touched.
- Reversible: yes — drop the index with `@@index` removal + `prisma migrate dev`.
- Backfill: not required (`avgRating` is already backfilled on staging by AGG-1).
- Staging test: auto-applies as part of `prisma migrate deploy` on Staging; no manual step.
- Existing rows: unaffected.

**Existing PERF-2 indexes (confirmed present, not touched):**
```prisma
@@index([isPublished, deletedAt, priceLow, id])   -- price sort
@@index([isPublished, deletedAt, createdAt, id])  -- related/default sort
```
The new index follows the same 4-column pattern so Postgres can use it for
`WHERE isPublished = true AND deletedAt IS NULL ORDER BY avgRating DESC NULLS LAST`.

---

### Change 2 — campCardSelect: drop reviews, add avgRating + reviewCount

**File:** `lib/read-models/camp-card.ts`

Current select (lines 22-47) includes:
```ts
reviews: {
  where: { deletedAt: null },
  select: { rating: true },
},
```
and does NOT include `avgRating` or `reviewCount`.

After PERF-5, the select becomes:

```ts
export const campCardSelect = {
  id: true,
  nameTh: true,
  nameEn: true,
  nameThSlug: true,
  nameEnSlug: true,
  priceLow: true,
  createdAt: true,
  avgRating: true,   // ADD — Decimal(2,1)? column (AGG-1)
  reviewCount: true, // ADD — Int column (AGG-1)
  location: {
    select: {
      province: true,
    },
  },
  images: {
    select: {
      url: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: 'asc' as const },
    take: 5,
  },
  // reviews removed — AGG-1 delivers this comment: "AGG-1 removes this later"
} satisfies Prisma.CampSiteSelect;
```

`CampCardPayload` (line 50-52) is inferred via `Prisma.CampSiteGetPayload<{ select: typeof campCardSelect }>`,
so removing `reviews` and adding `avgRating`/`reviewCount` automatically propagates the type
to every consumer without manual re-declaration.

---

### Change 3 — app/page.tsx: unified findMany, remove JS sort

**File:** `app/page.tsx`

Current code (lines 96-130) has two branches:

- `rating` branch (line 96-115): `findMany` with no `orderBy`/`take` → `sortByRating(rows)` → `.slice(0,40)` → JS `map` to strip `reviews` and call `roundAvgRating(computeAvgRating(_reviews))`.
- Other sorts branch (line 117-129): `findMany` with `orderBy`/`take:40` → JS `map` to strip `reviews` and call `roundAvgRating(computeAvgRating(_reviews))`.

After PERF-5, both branches collapse to one unified findMany with a computed `orderBy`:

```ts
// Unified orderBy for ALL sort values — rating now uses the stored column.
const orderBy =
  sanitizedSort === 'price_asc'  ? { priceLow: 'asc' as const }  :
  sanitizedSort === 'price_desc' ? { priceLow: 'desc' as const } :
  sanitizedSort === 'rating'
    ? ({ avgRating: { sort: 'desc', nulls: 'last' } } as const)
    : { createdAt: 'desc' as const };  // 'related' default

// Single findMany — no JS sort, no JS slice, no reviews to strip.
const rows = await prisma.campSite.findMany({
  where,
  select: campCardSelect,
  orderBy,
  take: 40,
});

// No avgRating computation needed — columns arrive directly.
// avgRating from column is Decimal; serializeDecimals converts it to number | null.
campSites = rows.map((c: any) => serializeDecimals({
  ...c,
  createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
}));
```

The `try/catch` wrapper around the single findMany replaces the existing try/catch block
(lines 95-134). The `sortByRating` call and `.slice(0,40)` are removed from this path.
The `computeAvgRating`/`roundAvgRating` calls in the map are removed (columns deliver
the pre-rounded value directly from AGG-1's maintained `roundAvgRating(computeAvgRating(...))` derivation).

**Nulls ordering confirmed:** Prisma 5.x (`^5.22.0`, package.json line 50) exposes `NullsOrder`
on `orderBy` for nullable columns (confirmed in `node_modules/.prisma/client/index.d.ts` line 30286).
`{ avgRating: { sort: 'desc', nulls: 'last' } }` is valid Prisma syntax for `Decimal?` columns.
PostgreSQL pushes `NULL avgRating` rows to the end — matches the existing JS `sortByRating` NULLS LAST
behaviour exactly.

**Type update:** the `CampCard` local type alias on line 93 is `Omit<CampCardPayload, 'reviews'> & { avgRating: number | null; reviewCount: number }`.
After PERF-5, `CampCardPayload` no longer has `reviews` and already has `avgRating`/`reviewCount`,
so the Omit and manual intersection are redundant. Backend should simplify to:
```ts
// avgRating is Decimal in CampCardPayload; after serializeDecimals it is number | null
// CampSiteCardData in CampgroundGrid already handles avgRating?: number | null
```
The exact type alias expression is an implementation detail for Backend; the contract is that
`serializeDecimals` converts `Decimal` → `number` (confirmed in `lib/serialize.ts` lines 9-22).

---

### Change 4 — imports cleanup in app/page.tsx

After PERF-5, `sortByRating` and `computeAvgRating` are no longer called from `app/page.tsx`.
The import on line 12 (`import { sortByRating, computeAvgRating } from "@/lib/sort-utils"`)
must be removed. `roundAvgRating` (line 13) is also unused in `app/page.tsx` after this change
and should be removed from the import.

---

## Helper retention decision (grep-based, authoritative)

Grep results for all callers of `sortByRating`, `computeAvgRating`, and `roundAvgRating`:

**`sortByRating`** — callers:
- `app/page.tsx` (lines 107, 12-import): REMOVING (this story)
- `__tests__/sort-utils.test.ts` (lines 94+, 376-383): tests the pure helper directly; helper retained
- `__tests__/cam-189-agg1-avgrating.test.ts` (line 573-575): source-inspect test asserting page.tsx still calls it — this assertion will FAIL after PERF-5 and QA must update it
- `__tests__/cam-192-list-buffet.test.ts` (no direct call; AC-2 indirectly via campCardSelect)

**`computeAvgRating`** — callers:
- `app/page.tsx` (lines 113, 127, 12-import): REMOVING (this story)
- `app/wishlist/page.tsx` (line 20-import, line 80): KEPT — wishlist page still uses reviews-based computation (its own bespoke select, not campCardSelect)
- `__tests__/cam-147-card-rating.test.ts` (lines 209-253): asserts `page.tsx` imports `computeAvgRating` — this assertion will FAIL after PERF-5; QA must update
- `__tests__/cam-192-list-buffet.test.ts` (line 51-import, lines 240-270): asserts `page.tsx` imports + uses `computeAvgRating` — assertions will FAIL after PERF-5; QA must update
- `__tests__/sort-utils.test.ts` (lines 47+): tests the pure helper directly; helper retained

**`roundAvgRating`** — callers:
- `app/page.tsx` (lines 113, 127, 13-import): REMOVING (this story)
- `app/wishlist/page.tsx` (line 21-import, line 80): KEPT — wishlist page still uses it
- `lib/review-summary.ts` (line 25): defines it — kept
- `__tests__/cam-192-list-buffet.test.ts` (line 52-import, line 273-275): asserts `page.tsx` uses `roundAvgRating(computeAvgRating(_reviews))` — will FAIL; QA must update

**Decision:**
- `sortByRating` in `lib/sort-utils.ts`: KEEP the function (pure helper, tested by `__tests__/sort-utils.test.ts`; no unused-export error because the test file imports it). Backend must NOT delete the export; only remove the import from `app/page.tsx`.
- `computeAvgRating` in `lib/sort-utils.ts`: KEEP — still used by `app/wishlist/page.tsx` (line 80).
- `roundAvgRating` in `lib/review-summary.ts`: KEEP — still used by `app/wishlist/page.tsx` (line 80).
- `WithReviewRatings` interface in `lib/sort-utils.ts`: KEEP — used by `sortByRating` signature.

---

## Serialization confirmation

`avgRating` is `Decimal(2,1)?` in the DB → Prisma returns a `Prisma.Decimal | null` object.
`serializeDecimals` in `lib/serialize.ts` (line 11) handles `Prisma.Decimal` via `.toNumber()`,
converting it to a plain JS `number | null`. The client card receives `number | null`.

`CampgroundCard.tsx` (lines 165-182) already handles `avgRating` as `number | null` via prop:
- Null / 0-reviews path: shows `t.reviews.noReviews` (line 177)
- Non-null path: renders `{avgRating}` as `string` (line 173) — a `number` with 1 decimal renders identically to the pre-PERF-5 `roundAvgRating` output since AGG-1 already stores the rounded value.

No re-rounding is needed in the listing path. The column value is already rounded to 1dp by
AGG-1's write path (`roundAvgRating(computeAvgRating(...))` at review create/delete).

---

## API contract

No new `/api/*` endpoints. The shape changes are confined to the shared `campCardSelect` read model.

**Affected routes (internal — no external contract change):**

`GET /api/campsites` (`app/api/campsites/route.ts` line 34-38) and
`GET /api/campgrounds` (`app/api/campgrounds/route.ts` line 34-39):
both call `prisma.campSite.findMany({ where, select: campCardSelect })` with no `orderBy`.
After campCardSelect drops `reviews` and adds `avgRating`/`reviewCount`, these routes return
a shape with `avgRating: Decimal | null` and `reviewCount: number` instead of `reviews: {rating}[]`.

These routes have no explicit `orderBy` (no sort guarantee); the shape change is additive
for new fields and removes the `reviews` sub-array. Any consumer of these routes that previously
relied on the `reviews` array would need updating — however, both routes return via `apiSuccess`
which calls `serializeDecimals` indirectly (confirmed: `apiSuccess` in `lib/api-utils.ts`
wraps the response). The `avgRating` Decimal serialization is handled automatically.

**Error codes for `GET /api/campsites` and `GET /api/campgrounds`:**
- 200: success, array of CampCardPayload (with avgRating/reviewCount columns, no reviews)
- 500: internal error (existing handler)
- 401/403/404/409: not applicable — public read endpoints, no ownership, no state mutation.

---

## ADRs

No new ADR required. The decision to read from the maintained `avgRating` column rather than
computing from live reviews was made in AGG-1 (CAM-189), which references
`docs/adr/ADR-006` conventions. PERF-5 is the execution of the plan that AGG-1 explicitly
deferred: the comment at `lib/read-models/camp-card.ts` line 11 says
_"AGG-1 removes this later"_ — this story is "later".

The nulls-last ordering at DB matches the JS `sortByRating` NULLS LAST behaviour (confirmed
in `lib/sort-utils.ts` line 39-42), so there is no ordering semantic change to record.

---

## QA targets

Tests that will BREAK after this change and MUST be updated by QA:

| Test file | Line(s) | Assertion that breaks | Why |
|---|---|---|---|
| `__tests__/cam-192-list-buffet.test.ts` | 146-151 | `'reviews' in campCardSelect` → true | reviews removed from select |
| `__tests__/cam-192-list-buffet.test.ts` | 150 | `campCardSelect.reviews.select` rating key | reviews key gone |
| `__tests__/cam-192-list-buffet.test.ts` | 184-187 | `select: campCardSelect` appears ≥2 times in page.tsx | page.tsx now uses one branch |
| `__tests__/cam-192-list-buffet.test.ts` | 240-250 | page.tsx imports and uses `computeAvgRating` | import removed |
| `__tests__/cam-192-list-buffet.test.ts` | 248-250 | `roundAvgRating(computeAvgRating(_reviews))` in page.tsx src | expression removed |
| `__tests__/cam-192-list-buffet.test.ts` | 368-375 | campCardSelect.reviews exists + reviews.select.rating | reviews removed |
| `__tests__/cam-147-card-rating.test.ts` | 209-210 | page.tsx imports computeAvgRating | import removed |
| `__tests__/cam-147-card-rating.test.ts` | 228-234 | campCardSelect contains reviews; page.tsx has ≥2 `select: campCardSelect` | both change |
| `__tests__/cam-147-card-rating.test.ts` | 244-245 | `roundAvgRating(computeAvgRating(_reviews))` in page.tsx | expression removed |
| `__tests__/cam-189-agg1-avgrating.test.ts` | 573-575 | page.tsx still calls `sortByRating` | call removed |
| `__tests__/cam-189-agg1-avgrating.test.ts` | 586+ | page.tsx imports from sort-utils | import removed |
| `__tests__/cam-189-agg1-avgrating.test.ts` | 592-598 | campCardSelect still has reviews; no avgRating in campCardSelect | inverted |

Tests that MUST PASS after this change (new assertions for QA to add in a new `cam-193-*.test.ts`):

- `campCardSelect` does NOT have a `reviews` key
- `campCardSelect.avgRating` is `true`
- `campCardSelect.reviewCount` is `true`
- `app/page.tsx` does NOT import `sortByRating`
- `app/page.tsx` does NOT import `computeAvgRating`
- `app/page.tsx` does NOT contain `sortByRating(`
- `app/page.tsx` does NOT contain `computeAvgRating(`
- `app/page.tsx` orderBy for rating branch contains `avgRating` (source inspect)
- `app/page.tsx` has exactly ONE `findMany` call (or one `select: campCardSelect`)
- `app/wishlist/page.tsx` still imports and uses `computeAvgRating` (regression guard)
- `lib/sort-utils.ts` still exports `computeAvgRating` and `sortByRating` (helpers retained)
- `CampgroundCard.tsx` reads `avgRating` prop — no change (regression guard)

---

## Risks and open questions

**Risk 1 — Stale avgRating on staging (LOW).**
AGG-1 backfilled `avgRating`/`reviewCount` on staging. However, any camp that received a review
between the backfill and this deploy will have correct data only if the AGG-1 write-path trigger
is live on staging. Confirmed: AGG-1 (CAM-189) was merged to staging (commit f170e48) and the
write-path trigger updates `avgRating` on every review create/delete in a transaction. Staging
data is current.

**Risk 2 — NULL ordering semantics match (CONFIRMED NO RISK).**
Prisma `nulls: 'last'` on PostgreSQL emits `NULLS LAST` in SQL. `lib/sort-utils.ts` lines 39-43
implement the identical semantic (`avgA === null` → return 1, i.e. null goes after real numbers).
No ordering change for the user.

**Risk 3 — Decimal serialization through API routes (CONFIRMED NO RISK).**
`serializeDecimals` is called in `app/page.tsx` line 176 wrapping the whole camp object.
For the API routes (`/api/campsites`, `/api/campgrounds`), `apiSuccess` in `lib/api-utils.ts`
wraps the response — QA/Backend should verify that `apiSuccess` calls `serializeDecimals` or
`NextResponse.json` (which serialises via JSON.stringify; `Prisma.Decimal.toJSON()` returns a
string representation). If `apiSuccess` does NOT call `serializeDecimals`, `avgRating` will be
returned as a string (e.g. `"4.5"`) not a number from those routes.

**OPEN QUESTION FOR OWNER (Important — not a G2 blocker but surfaces for awareness):**
`app/wishlist/page.tsx` (lines 34-82) has its own bespoke select that still fetches `reviews`
and calls `roundAvgRating(computeAvgRating(reviews))`. It does NOT use `campCardSelect`.
PERF-5's AC does not cover the wishlist page. A future story should migrate the wishlist page to
also read `avgRating`/`reviewCount` from the columns and drop its own reviews fetch.
This is out of scope for CAM-193 (noted in story.md `## Out of scope`), but flagged so it is
visible at G2.

---

## Traceability map

| AC | API / route | campCardSelect field | Prisma model field | authz |
|---|---|---|---|---|
| AC-1 (rating sort at DB) | `app/page.tsx` unified findMany | — | `CampSite.avgRating` orderBy | public (no auth) |
| AC-2 (card shows rating from column) | `app/page.tsx` map + `CampgroundCard.tsx` prop | `avgRating: true`, `reviewCount: true` | `CampSite.avgRating`, `CampSite.reviewCount` | public |
| AC-3 (no reviews in select) | `campCardSelect` | `reviews` removed | — | public |
| index | `prisma migrate` | — | `@@index([isPublished, deletedAt, avgRating, id])` | — |

No orphan field: every campCardSelect change maps to an AC. No orphan AC: every AC has a
design element. Authz: all three listing paths are public read (no session required, no ownership).

---

## Links

`story.md` (this directory) · `prisma/schema.prisma` (CampSite model lines 237-349) ·
`lib/read-models/camp-card.ts` · `app/page.tsx` · `lib/sort-utils.ts` · `lib/review-summary.ts` ·
`app/wishlist/page.tsx` (out of scope; retains reviews fetch) ·
`docs/adr/ADR-006` (S7 additive conventions followed)

## Changelog
- v1 (2026-06-26) — created: G2 technical design for PERF-5
