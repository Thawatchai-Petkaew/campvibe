---
linear: CAM-192
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
artifact: tech
status: In Progress
version: v1
updated: 2026-06-26
---
# Technical Design — PERF-1 List Buffet: `campCardSelect` (CAM-192)

## Purpose

This document is the G2 technical hand-off for CAM-192. It defines the exact
`campCardSelect` Prisma `select` object for the catalog listing, where it lives,
how both API routes and the home page adopt it, and how the existing rating/sort
pipeline stays intact. No migration. No schema change.

---

## 1. Card render contract (grounded in the real files)

Everything in `campCardSelect` traces back to a field actually consumed by the
card or its post-render pipeline. The table below maps every consumed field to
its source.

### 1a. Fields `CampgroundCard.tsx` directly reads from `campground.*`

| Field | Used at (line ref) | Classification |
|---|---|---|
| `id` | wishlist API call `wishlistAPI.save(campground.id)` — line 78 | Public |
| `nameTh` | `name` display: `language === 'en' ? (campground.nameEn \|\| campground.nameTh) : campground.nameTh` — line 100 | Public |
| `nameEn` | same branch — line 100 | Public |
| `nameThSlug` | Link href: `campground.nameThSlug` — line 101 | Public |
| `nameEnSlug` | Link href: `campground.nameEnSlug \|\| campground.nameThSlug` — line 101 | Public |
| `priceLow` | `formatCurrency(Number(campground.priceLow))` — line 186 | Financial/Public |
| `createdAt` | "New" badge: `new Date(campground.createdAt).getTime() > Date.now() - 14*24*60*60*1000` — line 110 | Public |
| `images` (relation) | `campground.images?.map(img => img.url)` — line 42; dots sliced at 5 — line 150 | Public |
| `location.province` | `campground.location.province` — line 184 | Public/Geo |

### 1b. Fields passed as separate props (computed server-side before the card)

These are stripped from the Prisma row before serialization and passed as
explicit props `avgRating` / `reviewCount` on `CampgroundCard`. They are NOT
part of the `campground` object the card receives:

| Field | Source | Required in select? |
|---|---|---|
| `avgRating` | computed from `reviews: { rating }[]` via `computeAvgRating` + `roundAvgRating` | Yes — `reviews` must remain in select |
| `reviewCount` | `_reviews.length` after the post-map in `app/page.tsx` lines 118–122 | Derived from `reviews` array length |

### 1c. Fields in `CampSiteCardData` interface (`CampgroundGrid.tsx` lines 15–34) NOT directly rendered by the card

| Field | Status |
|---|---|
| `priceHigh` | In the interface but the card never reads it (only `priceLow` rendered) |
| `isVerified` | In interface; card does NOT render a verified badge — not needed in select |
| `isPublished` | In interface; card does NOT render it — not needed in select |
| `latitude` | In interface; card does NOT render it — not needed in select |
| `longitude` | In interface; card does NOT render it — not needed in select |

**Ruling:** `CampSiteCardData` is an over-wide interface inherited from before this
refactor. The card (`CampgroundCard.tsx`) is the ground truth. Only fields the
card actually renders enter `campCardSelect`. The interface will be narrowed by
the `frontend` agent as part of implementing this story.

### 1d. Operator name — keyword search vs select

`buildCampSiteWhere` (`lib/campsite-filters.ts` line 59) uses
`operator: { name: { contains: keyword } }` **in the WHERE clause only**. The
card never renders `operator.name` on screen (confirmed: no reference to
`campground.operator` in `CampgroundCard.tsx`). Therefore `operator` is
**excluded from select entirely**. Keyword search continues to work because the
filter lives in the `where`, not the `select`.

---

## 2. The `campCardSelect` object

**File:** `lib/read-models/camp-card.ts` (new file — directory `lib/read-models/`
does not exist yet, must be created).

```typescript
// lib/read-models/camp-card.ts
import { Prisma } from '@prisma/client';

/**
 * Prisma select for the catalog card listing (PERF-1 / CAM-192).
 *
 * Includes ONLY what CampgroundCard renders:
 *   - scalar card fields (id, name/slug, priceLow, createdAt)
 *   - location: only province (the string the card renders)
 *   - images: first 5 by sortOrder (carousel shows ≤5 dots, line 150 CampgroundCard.tsx)
 *   - reviews: rating only, deletedAt:null (avgRating computed server-side; AGG-1 removes this later)
 *
 * Explicitly dropped (over-fetch culprits):
 *   - spots        (availability sub-tree — not rendered on the card)
 *   - options      (full MasterData taxonomy — not rendered on the card)
 *   - operator     (full User record — name used in WHERE only, not SELECT)
 *   - _count       (not needed; reviewCount derived from reviews.length)
 *   - full location (only province is read; district/subDistrict/lat/lon etc. not rendered)
 *   - all images   (unbounded — capped at take:5)
 *   - priceHigh, isVerified, isPublished, latitude, longitude
 *     (in CampSiteCardData interface but not rendered by CampgroundCard)
 */
export const campCardSelect = {
  id: true,
  nameTh: true,
  nameEn: true,
  nameThSlug: true,
  nameEnSlug: true,
  priceLow: true,
  createdAt: true,
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
  reviews: {
    where: { deletedAt: null },
    select: { rating: true },
  },
} satisfies Prisma.CampSiteSelect;

/** Inferred TypeScript type — consumers derive their type from this, never re-declare. */
export type CampCardPayload = Prisma.CampSiteGetPayload<{
  select: typeof campCardSelect;
}>;
```

### Why `take: 5`

`CampgroundCard.tsx` line 150: `imageUrls.slice(0, 5).map(...)` renders at most
5 dot indicators. The carousel arrow buttons cycle through `imageUrls.length`
which equals the full images array. The card will show all images for navigation
but renders only 5 dots. Capping the DB fetch at 5 aligns with the visible dots
and eliminates the bulk of image rows from the payload. The carousel is
**fully intact**: with `take:5` the user still sees up to 5 images with working
prev/next arrows and 5 dots.

If a camp has more than 5 images the excess are silently excluded from the
listing card (they remain visible on the detail page which uses its own query).
This is the correct behaviour for a listing context.

### Why `reviews` stays

`computeAvgRating` (`lib/sort-utils.ts`) and `roundAvgRating`
(`lib/review-summary.ts`) are called in `app/page.tsx` lines 118–122 and
141–144. Until AGG-1 (a future story that stores a denormalized `avgRating`
column on `CampSite`), the rating must be derived from the review ratings array.
Removing `reviews` now would break the rating display and the `sort=rating`
branch. It stays.

---

## 3. Fields explicitly dropped and why

| Dropped | Current include | Why dropped |
|---|---|---|
| `spots` | `include: { spots: true }` | Not referenced anywhere in card or grid; availability filter in WHERE uses `spots.bookings` subquery, not in select |
| `options` | `include: { options: true }` | MasterData taxonomy (facilities, activities, terrain, etc.) — used only in filter WHERE, never rendered on card |
| `operator` (full row) | `operator: { select: { name: true } }` | `operator.name` in keyword WHERE only; card never shows it |
| `_count` | `_count: { select: { reviews: true } }` | `reviewCount` is derived from `reviews.length` in the post-map; `_count` is redundant |
| `location.*` excess fields | `location: true` (all 10+ Location fields) | Card reads only `location.province` (line 184 CampgroundCard.tsx); all other Location fields excluded |
| `images` (unbounded) | `images: { orderBy: { sortOrder: 'asc' } }` (no take) | Replaced by `take: 5` — largest single contributor to 902 KB payload for camps with many images |

---

## 4. How home and both API routes adopt `campCardSelect`

### 4a. `app/page.tsx`

Both query branches (rating sort and all other sorts) must replace their
`include` with `select: campCardSelect`. The post-map pipeline stays identical
because `reviews: { rating }[]` remains in the select.

```typescript
// BEFORE (both branches in app/page.tsx, ~lines 98–145):
include: {
  location: true,
  operator: { select: { name: true } },
  images: { orderBy: { sortOrder: 'asc' } },
  _count: { select: { reviews: true } },
  reviews: { where: { deletedAt: null }, select: { rating: true } },
},

// AFTER — replace with:
select: campCardSelect,
```

The `orderBy` and `take` clauses remain unchanged at the `findMany` call level.
The post-map (lines 118–122, 141–144) is unaffected: `_reviews` is still
`{ rating: number }[]`; `computeAvgRating`, `roundAvgRating`, and the review
strip still work.

`sortByRating` (`lib/sort-utils.ts`) uses `WithReviewRatings` interface which
requires only `reviews: { rating: number }[]` — satisfied by `campCardSelect`.

**`serializeDecimals`** (`lib/serialize.ts`) is called on the result in line 192
of `app/page.tsx`. It must handle `CampCardPayload` (which includes `priceLow`
as `Decimal | null`). No change needed to `serializeDecimals` itself.

### 4b. `app/api/campsites/route.ts` (GET handler)

```typescript
// BEFORE (~line 34–44):
include: {
  location: true,
  spots: true,
  reviews: { select: { rating: true } },
  options: true,
  images: { orderBy: { sortOrder: 'asc' } }
},

// AFTER:
select: campCardSelect,
```

No `orderBy` or `take` is currently applied in this route. The `select`
replacement is the only change.

### 4c. `app/api/campgrounds/route.ts` (GET handler)

Identical to `app/api/campsites/route.ts` — same `include` block, same
replacement.

```typescript
// BEFORE (~line 34–44):
include: {
  location: true,
  spots: true,
  reviews: { select: { rating: true } },
  options: true,
  images: { orderBy: { sortOrder: 'asc' } }
},

// AFTER:
select: campCardSelect,
```

`withTiming` wrappers (`withTiming('catalog_list', ...)` and
`withTiming('campground_list', ...)`) stay in place — no change.

---

## 5. Traceability map (AC → select field → no orphan)

| AC | API field / behaviour | `campCardSelect` element | Card line |
|---|---|---|---|
| AC-1: card renders name | `nameTh`, `nameEn` | `nameTh: true`, `nameEn: true` | CampgroundCard.tsx:100 |
| AC-1: card renders slug (nav link) | `nameThSlug`, `nameEnSlug` | `nameThSlug: true`, `nameEnSlug: true` | CampgroundCard.tsx:101 |
| AC-1: card renders price | `priceLow` | `priceLow: true` | CampgroundCard.tsx:186 |
| AC-1: card renders province | `location.province` | `location: { select: { province: true } }` | CampgroundCard.tsx:184 |
| AC-1: card renders image carousel | `images[].url`, `images[].sortOrder` | `images: { select: { url, sortOrder }, orderBy, take: 5 }` | CampgroundCard.tsx:42,150 |
| AC-1: card renders rating | `avgRating` prop (from `reviews[].rating`) | `reviews: { where: { deletedAt: null }, select: { rating: true } }` | CampgroundCard.tsx:165 |
| AC-1: "New" badge | `createdAt` | `createdAt: true` | CampgroundCard.tsx:110 |
| AC-1: wishlist heart | `id` | `id: true` | CampgroundCard.tsx:78 |
| AC-2: payload shrinks | no `spots`, `options`, unbounded `images` | all three explicitly excluded | — |
| AC-3: keyword search intact | `operator.name` in WHERE | not in select (WHERE only) | campsite-filters.ts:59 |

No orphan fields in select. No AC without a select element.

---

## 6. Component boundary

```
Client (CampgroundCard, CampgroundGrid)
  |
  | (serialized props — no DB access)
  v
Server Component (app/page.tsx)
  |
  | prisma.campSite.findMany({ select: campCardSelect, ... })
  v
Prisma / PostgreSQL

Client (/api/campsites, /api/campgrounds callers)
  |
  | HTTP GET
  v
Route Handler (app/api/campsites/route.ts, app/api/campgrounds/route.ts)
  |
  | prisma.campSite.findMany({ select: campCardSelect, ... })
  v
Prisma / PostgreSQL
```

`campCardSelect` is the single select definition shared across all three query
sites. It lives in `lib/read-models/camp-card.ts` — a server-only file, never
imported from client components.

---

## 7. Migration assessment

**No migration.** This change is entirely at the Prisma query layer (`select`
vs `include`). The schema (`prisma/schema.prisma`) is unchanged. No
`prisma migrate` is required. `npx prisma validate` passes without modification.

Reversibility: trivially reversible — revert the `select` back to `include`
if needed.

---

## 8. API contract update

The two GET routes (`/api/campsites` and `/api/campgrounds`) narrow their
response shape. The existing `schema/api-schema.json` `Campground` definition
was already a broad catalogue; the narrowed output is a subset of what callers
currently receive. Per `.claude/rules/api.md` §12 (backward-compatible by
addition / no removal without a deprecation plan), this is a **breaking narrowing**
for external callers that read `spots` or `options` from these routes.

**Known callers audit:**

- `app/page.tsx` (home listing) — consumes only `CampSiteCardData` fields;
  unaffected.
- The admin panel / host dashboard pages do NOT call `/api/campsites` GET for
  listing (they have their own queries). Confirm with `frontend` agent before
  ship.
- `schema/api-schema.json` — the existing listing endpoint contract does not
  enumerate `spots` or `options` in the documented response shape; the schema
  JSON is already aligned.

**Action for `frontend` agent:** grep for any client-side call to
`/api/campsites` or `/api/campgrounds` (GET) that reads `.spots` or `.options`
from the response and verify none exist. If a caller relies on those fields,
it must use a dedicated detail endpoint, not the listing route.

The `schema/api-schema.json` listing response description should be updated to
note the `campCardSelect` shape. This is a documentation update only — no
structural change to the JSON schema file is required for this story because
the existing schema does not enumerate the removed fields.

---

## 9. QA assertion targets

The `backend`/`frontend` implementation must pass these assertions (for `qa`
to write as unit tests against the query output):

1. **Shape: no `spots` field** — `CampCardPayload` type (derived from
   `campCardSelect`) has no `.spots` key. TypeScript compile-time assertion.
2. **Shape: no `options` field** — same; `CampCardPayload` has no `.options`.
3. **Shape: images bounded** — `campCardSelect.images.take === 5`. Assert the
   constant directly.
4. **Rating pipeline intact** — given `reviews: [{ rating: 4 }, { rating: 2 }]`,
   `computeAvgRating` returns `3`, `roundAvgRating(3)` returns `3`. Already
   unit-tested in `lib/sort-utils.ts`; no new test needed for the pipeline
   itself.
5. **Keyword search intact** — `buildCampSiteWhere({ keyword: 'test' })` returns
   a `where` that includes `operator: { name: { contains: 'test' } }` in the
   `OR` clause. Existing test coverage; confirm it still passes.

**Staging payload re-measure target:** after deploy, fetch `/api/campsites` on
the staging URL and record the response `Content-Length` (gzipped) vs the
baseline 902 KB. Expected: materially smaller. The exact reduction is
`not measured` pre-deploy; record the before/after pair in `baseline.md`
(CAM-187 artefact).

---

## 10. Surprising findings — what build must not break

1. **`isVerified`, `isPublished`, `latitude`, `longitude` are in `CampSiteCardData`
   but not in `campCardSelect`.** The `frontend` agent must narrow the
   `CampSiteCardData` interface to match the new payload, OR type the grid props
   as `CampCardPayload` directly. If these fields are left in the interface with
   no corresponding select they will be `undefined` at runtime — not a render
   break for the current card (none of them are rendered) but a TypeScript error
   if strict. Recommend: replace `CampSiteCardData` with `CampCardPayload &
   { avgRating?: number | null; reviewCount?: number }` in `CampgroundGrid.tsx`.

2. **`priceHigh` is in `CampSiteCardData` but not rendered.** Same as above —
   drop from the interface or accept it as optional/undefined.

3. **`createdAt` comes through `serializeDecimals` as an ISO string** in
   `app/page.tsx` line 194. `CampgroundCard.tsx` line 110 uses
   `new Date(campground.createdAt).getTime()` — works for both `Date` and
   ISO string. No break.

4. **`operator` relation is no longer loaded.** The card and grid never read it,
   but if any downstream serializer or `serializeDecimals` call walks all keys
   and expects a nested `operator` object, it will find `undefined`. Confirm
   `serializeDecimals` does not walk relation keys.

5. **`_count` is no longer loaded.** The current `app/page.tsx` post-map strips
   `reviews` and replaces with `avgRating`/`reviewCount`. It does NOT use
   `_count.reviews`. Drop is safe.

---

## 11. Open questions for the owner

None. All design decisions are deterministic from the card source files. No
trade-off requires a human call at G2 for this story.

---

## 12. Checks run before this handoff

- [x] Compared design against `prisma/schema.prisma` — no schema conflict; Image fields `url`, `sortOrder` exist (lines 677–678); Location field `province` exists (line 214); Review field `rating` exists (line 412); `deletedAt` on Review exists (line 428).
- [x] Every field in `campCardSelect` maps to a card-consumed field (traceability map §5).
- [x] No orphan AC (every AC in the story ticket has a design element).
- [x] No orphan select field (every select field maps to a rendered element or the rating pipeline).
- [x] Migration: none required; trivially reversible.
- [x] Keyword search: `operator.name` in WHERE only — confirmed `lib/campsite-filters.ts:59`.
- [x] `reviews` kept: required for `computeAvgRating` / `sortByRating` pipeline until AGG-1.
- [x] `take: 5` grounded in `CampgroundCard.tsx:150` (`imageUrls.slice(0, 5)`).
- [x] `lib/read-models/` does not yet exist — backend must create the directory.
- [x] No ADR required: this is a query-layer optimisation with no hard-to-reverse decision.
