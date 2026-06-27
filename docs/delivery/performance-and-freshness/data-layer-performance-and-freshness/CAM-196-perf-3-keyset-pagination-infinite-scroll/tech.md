---
linear: CAM-196
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
persona: platform
artifact: tech
owner: architect
status: In Progress
version: v1
updated: 2026-06-26
---
# Tech — PERF-3 Keyset Pagination + Infinite Scroll (CAM-196)

## Data model

No schema migration required. All columns and indexes land from prior stories:

- `CampSite.createdAt` + `CampSite.id` — covered by `@@index([isPublished, deletedAt, createdAt, id])` (PERF-2 / CAM-188)
- `CampSite.priceLow` + `CampSite.id` — covered by `@@index([isPublished, deletedAt, priceLow, id])` (PERF-2 / CAM-188)
- `CampSite.avgRating` + `CampSite.id` — covered by `@@index([isPublished, deletedAt, avgRating, id])` (PERF-5 / CAM-193, schema.prisma line 349)
- `CampSite.avgRating` is `Decimal(2,1)?` — nullable when `reviewCount = 0` (AGG-1 / CAM-189, schema.prisma lines 323–324)
- `CampSite.priceLow` is `Decimal(12,2)?` — nullable for free camps (`isFree = true`, schema.prisma line 287)

`story.md ## Data` records: "ไม่มี migration (index keyset มาจาก PERF-2 แล้ว)." — confirmed correct.

---

## API contract

### `GET /api/campsites?sort=&cursor=&<filters>`

**Auth:** public (same visibility gate as the existing GET: `isActive=true, isPublished=true, deletedAt=null`; no session required)

**Input (query params — zod-validated at boundary):**

| param | type | constraint |
|---|---|---|
| `sort` | `enum: related \| price_asc \| price_desc \| rating` | optional; default `related` |
| `cursor` | `string` (opaque, base64) | optional; absent = first page |
| `type`, `keyword`, `province`, `district`, `startDate`, `endDate`, `guests`, `min`, `max`, `access`, `facilities`, `external`, `equipment`, `activities`, `terrain` | same as today | forwarded unchanged to `buildCampSiteWhere` |

**Output:**

```ts
{
  items: CampCardPayload[],   // serialised: priceLow→number, avgRating→number|null, createdAt→ISO string
  nextCursor: string | null   // null when items.length < take (end of result set)
}
```

`take = 24` per page. `nextCursor` is the encoded cursor of the **last item** returned, or `null` if fewer than 24 items came back.

**Error codes:**

| code | condition |
|---|---|
| `400` | zod validation failed (invalid sort value, cursor decode failure, malformed filter param) — `{ error: { code: "VALIDATION_ERROR", message: string } }` |
| `401` | N/A — public endpoint |
| `403` | N/A — public endpoint |
| `404` | N/A — returns empty `items: []` with `nextCursor: null` rather than 404 |
| `409` | N/A — read-only |
| `500` | internal — generic message, detail logged server-side — `{ error: { code: "INTERNAL_ERROR", message: string } }` |

**Error shape (consistent):** `{ error: { code: string, message: string } }`

**Query strategy:** single `prisma.campSite.findMany` — `where: { ...buildCampSiteWhere(filters), ...keysetPredicate }`, `select: campCardSelect`, `orderBy`, `take: 24 + 1` (fetch one extra to detect if there is a next page — drop the extra item before returning; this avoids a `count` query). No N+1: `campCardSelect` already caps `images` at `take:5`.

---

## Cursor contract

### Encoding

An opaque cursor is `base64url(JSON.stringify({ k: <sortKeyValue>, id: <string> }))`.

- `k` holds the sort key value of the last item on the page:
  - `sort=related` (createdAt desc): `k` = ISO string of `CampSite.createdAt`
  - `sort=price_asc` / `sort=price_desc`: `k` = serialised `priceLow` value as a **number or null** (the null case = free camp)
  - `sort=rating`: `k` = serialised `avgRating` as a **number or null** (null = no reviews yet)
- `id` = `CampSite.id` of the last item (UUID string — the stable tiebreaker in all indexes)

Decode on the server: `JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))`. A decode error returns `400`.

---

### Keyset WHERE per sort

Prisma does not support native tuple comparison (`(a, b) < (x, y)`). Use the OR-decomposition equivalent:

```
(a < x) OR (a = x AND b < y)
```

This is logically identical to a tuple `<` and is supported by the composite index in both directions.

#### `sort=related` (createdAt DESC, id DESC)

Next page means: earlier createdAt, **or** same createdAt with smaller id (id is a UUID — comparison is lexicographic, consistent because id is also indexed as tiebreaker):

```ts
// cursor = { k: "2026-05-01T00:00:00.000Z", id: "abc123" }
const keysetWhere = {
  OR: [
    { createdAt: { lt: new Date(cursor.k) } },
    { createdAt: new Date(cursor.k), id: { lt: cursor.id } },
  ],
};
```

Merged with `buildCampSiteWhere` result via `AND`:

```ts
where = { AND: [buildCampSiteWhere(filters), keysetWhere] }
```

`orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]`

Index used: `[isPublished, deletedAt, createdAt, id]` — all four columns are in the leading predicate.

#### `sort=price_asc` (priceLow ASC, id ASC)

```ts
// cursor = { k: 500, id: "abc123" }   (k is null for free camps, see NULL section below)
const keysetWhere = {
  OR: [
    { priceLow: { gt: cursor.k } },                                // strictly after
    { priceLow: cursor.k, id: { gt: cursor.id } },                  // same price, next id
  ],
};
```

`orderBy: [{ priceLow: 'asc' }, { id: 'asc' }]`

Index used: `[isPublished, deletedAt, priceLow, id]`

#### `sort=price_desc` (priceLow DESC, id DESC)

```ts
// cursor = { k: 1200, id: "abc123" }
const keysetWhere = {
  OR: [
    { priceLow: { lt: cursor.k } },
    { priceLow: cursor.k, id: { lt: cursor.id } },
  ],
};
```

`orderBy: [{ priceLow: 'desc' }, { id: 'desc' }]`

Index used: `[isPublished, deletedAt, priceLow, id]`

#### `sort=rating` (avgRating DESC NULLS LAST, id DESC)

The Prisma ordering is `orderBy: [{ avgRating: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }]` — this matches the existing `app/page.tsx` line 120. The PERF-5 index is `[isPublished, deletedAt, avgRating, id]`.

**NULL boundary handling:**

`avgRating = null` means the camp has no reviews and sorts last (after all rated camps). The result set splits into two segments:

- Segment A: camps with `avgRating IS NOT NULL`, ordered `avgRating DESC, id DESC`
- Segment B: camps with `avgRating IS NULL`, ordered `id DESC` (tiebreaker only)

There is a single boundary between the two segments. The keyset WHERE must handle three cases depending on which segment the cursor's last item was in:

**Case 1 — cursor is in Segment A (`cursor.k != null`):**

```ts
// still delivering rated camps AND will eventually deliver null-rating camps
const keysetWhere = {
  OR: [
    { avgRating: { lt: cursor.k } },                                     // lower rating
    { avgRating: cursor.k, id: { lt: cursor.id } },                       // same rating, next id
    { avgRating: null },                                                   // all null-rating camps come after
  ],
};
```

**Case 2 — cursor is at the NULL boundary (last item had `avgRating = null`):**

```ts
// cursor = { k: null, id: "abc123" }
const keysetWhere = {
  AND: [
    { avgRating: null },                // stay in the null segment
    { id: { lt: cursor.id } },          // id DESC tiebreaker within null segment
  ],
};
```

The client-side representation of the cursor encodes `k: null` for null-avgRating items. The server distinguishes the two cases with `if (cursor.k === null)`.

**Important:** Prisma does support `orderBy: { avgRating: { sort: 'desc', nulls: 'last' } }` (confirmed in `app/page.tsx:120`). The keyset WHERE above is the explicit decomposition that Prisma's `cursor` API would not handle correctly because `avgRating` is non-unique — which is precisely why we implement keyset manually instead of using Prisma's built-in `cursor` option.

---

### NULL handling for priceLow (free camps)

`priceLow` is nullable — free camps have `priceLow = null` and `isFree = true`. Prisma sorts `null` values first for `ASC` and last for `DESC` in PostgreSQL (PostgreSQL default: `NULLS LAST` for `DESC`, `NULLS FIRST` for `ASC`).

For `price_asc`, free (null priceLow) camps appear first in Postgres default ordering. To keep the behavior consistent and predictable, apply `{ nulls: 'first' }` explicitly for `price_asc` and `{ nulls: 'last' }` for `price_desc`:

- `price_asc`: `orderBy: [{ priceLow: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }]`
- `price_desc`: `orderBy: [{ priceLow: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }]`

For `price_asc` the null segment is at the **start** (opposite of avgRating). The cursor for a null-priceLow item encodes `k: null`. The keyset WHERE:

**Case: cursor is in the null-priceLow segment (`cursor.k === null`, price_asc):**

```ts
const keysetWhere = {
  AND: [
    { priceLow: null },
    { id: { gt: cursor.id } },  // ASC tiebreaker within null segment
  ],
};
```

**Case: cursor crossed into priced camps (`cursor.k !== null`, price_asc):**

```ts
const keysetWhere = {
  AND: [
    { priceLow: { not: null } },              // exclude free camps (already delivered)
    {
      OR: [
        { priceLow: { gt: cursor.k } },
        { priceLow: cursor.k, id: { gt: cursor.id } },
      ],
    },
  ],
};
```

For `price_desc` the null-priceLow segment appears **last** (same structure as avgRating NULLS LAST above) — the same two-case pattern applies.

---

## SSR + CACHE-1 integration

### Page size decision

**Recommendation: standardise both `getDefaultCatalog` and the cursor API on `take: 24`.**

Current state: `getDefaultCatalog` uses `take: 40` (catalog-cache.ts line 113) and `app/page.tsx` live path uses `take: 40` (app/page.tsx line 129).

Rationale for `take: 24`:
- 24 divides evenly across the responsive grid (5 cols on xl, 4 on lg, 3 on md, 2 on sm, 1 on mobile) — no orphan partial rows at most breakpoints.
- 40 was an arbitrary cap before pagination existed; 24 is a deliberate first-page size.
- Smaller first page = faster SSR TTI + less DB load per warm cache miss.

**Trade-off (open for owner to decide):** Changing `getDefaultCatalog` from `take:40` to `take:24` means the cached first page shrinks. Users who had 40 cards on the initial load will see 24. This is a visible UX change. Option A: change both to 24. Option B: keep first page at 40 and the cursor API at 24 (first page is 40, subsequent pages are 24 — a slight inconsistency). Option C: keep `take:40` for CACHE-1 first page and emit a first `nextCursor` from SSR pointing at item #24 (discards items 25-40 from the cache — wasteful). **Recommendation: Option A.** See Open Trade-offs below.

### SSR → client handoff flow

```
app/page.tsx (Server Component)
  ├── default path  → getDefaultCatalog() → first 24 items (cached, CACHE-1)
  ├── filtered path → prisma.findMany with buildCampSiteWhere, take:24 (live)
  └── computes initialCursor = encodeCursor(lastItem) or null if < 24

  ↓ passes to:

<InfiniteScrollGrid
  initialItems={serialisedItems}     // CampSiteCardData[] (priceLow/avgRating/createdAt serialised)
  initialCursor={initialCursor}      // string | null
  sort={sanitizedSort}               // "related" | "price_asc" | "price_desc" | "rating"
  filters={activeFilters}            // the raw query-param object passed through
  savedIds={savedCampSiteIds}
  isLoggedIn={isLoggedIn}
/>
```

`InfiniteScrollGrid` is a `"use client"` component that:
1. Holds `items` state (starts with `initialItems`) and `cursor` state (starts with `initialCursor`).
2. Attaches an `IntersectionObserver` to a sentinel `<div>` at the bottom of the grid.
3. When the sentinel enters the viewport AND `cursor !== null` AND `loading === false`: fetches `GET /api/campsites?sort=&cursor=&<filters>`, appends `items` to state, sets `cursor` to `nextCursor`.
4. When `cursor === null` after a fetch: renders the end-of-list message.
5. When `sort` or `filters` props change (parent re-renders from Next.js navigation): resets `items = initialItems`, `cursor = initialCursor` — no extra fetch needed on first change since the server re-renders the page with the new first page.

**SEO / no-JS:** the SSR-rendered first page (24 items) is fully in HTML for crawlers and for users with JS disabled. Subsequent pages are client-only (acceptable for pagination).

**CACHE-1 reconciliation:** `getDefaultCatalog` serves the first page from `unstable_cache` (revalidate: 60s, tag: `catalog`). The client fetches page 2+ live from `/api/campsites`. This is consistent — the cache covers only the warm default first page; cursor pages are always fresh.

---

## Component boundaries

| Concern | Location | Type |
|---|---|---|
| First page fetch | `app/page.tsx` | Server Component |
| `buildCampSiteWhere` | `lib/campsite-filters.ts` | shared server lib |
| `campCardSelect` + `CampCardPayload` | `lib/read-models/camp-card.ts` | shared server lib |
| `encodeCursor` / `decodeCursor` | `lib/keyset-cursor.ts` (new) | server + client (pure, no Prisma) |
| Cursor API route | `app/api/campsites/route.ts` (extend GET) | Route Handler (server) |
| `InfiniteScrollGrid` | `components/InfiniteScrollGrid.tsx` (new) | `"use client"` |
| Loading skeleton | `components/ui/skeleton.tsx` (existing) | `"use client"` island |
| End-of-list message | inside `InfiniteScrollGrid` | `"use client"` |

`CampgroundGrid` is **replaced** by `InfiniteScrollGrid` on the home page. `CampgroundGrid` can remain for other contexts (e.g. operator dashboard) or be deprecated separately.

---

## DESIGN.md states + a11y

### Loading state (AC-4)

While fetching the next page, render a row of `<Skeleton>` cards below the existing grid (same number of columns as the grid, count = `take`). Use `components/ui/skeleton.tsx` with `rounded-3xl` (card radius per DESIGN.md §2) and `bg-muted` token. Do not use a spinner in place of skeletons — skeletons preserve layout stability (CLS = 0).

### End-of-list state (AC-2)

When `cursor === null` after at least one fetch, render a centred message below the grid. Thai copy (verbatim): `"ดูลานครบทั้งหมดแล้ว"`. Use `text-muted-foreground` token, `text-sm`, no border or card chrome.

### Loading indicator (lucide icon)

If a spinner is used alongside the skeleton (e.g. inside the sentinel div), use `<Loader2 className="animate-spin" />` from `lucide-react`. No emoji, no `@tabler/icons-react` (DESIGN.md §7).

### `aria-live` polite announce

Add an `aria-live="polite"` region (visually hidden via `sr-only`) that announces state changes:
- While loading: `"กำลังโหลดลานเพิ่มเติม"` (loading more camps)
- When end-of-list: `"แสดงลานครบทั้งหมดแล้ว"` (all camps shown)

### Focus and keyboard

- `IntersectionObserver` trigger is automatic — it does not take focus away from wherever the user is.
- The infinite scroll does not trap focus (no modal, no dialog).
- Keyboard users who tab through cards will eventually reach the sentinel `<div>` (which is `aria-hidden`). The `<div>` must be `tabindex="-1"` so keyboard users do not land on it and get no feedback.
- All cards rendered via `CampgroundCard` remain keyboard-reachable in DOM order — each new page of cards is appended to the DOM and focus is not moved.

### Reduced motion

Wrap any entrance animation for newly appended cards in `@media (prefers-reduced-motion: no-preference)`. If reduced motion is active, cards appear instantly with no translate/fade. DESIGN.md §2 motion tokens: `transition: transform opacity`, `120–250ms`, `cubic-bezier(0.23,1,0.32,1)` — apply these only if entrance animation is added.

### i18n copy (in `locales/translations.ts`)

| key | Thai | English |
|---|---|---|
| `catalog.loading_more` | `กำลังโหลดลานเพิ่มเติม` | Loading more camps |
| `catalog.end_of_list` | `ดูลานครบทั้งหมดแล้ว` | You've seen all camps |

---

## SEC-1 + filters intact

`buildCampSiteWhere` is called unchanged on every cursor page fetch — the base gate (`isActive: true, isPublished: true, deletedAt: null`) is always present in the `where` clause. The keyset predicate is merged via `AND: [buildCampSiteWhere(filters), keysetWhere]` and never replaces it. The SEC-1 ownership / visibility check is unaffected.

---

## QA targets

| test | what to assert |
|---|---|
| Cursor encode / decode round-trip | `decodeCursor(encodeCursor({ k, id }))` equals `{ k, id }` for each sort type, including `k: null` |
| Keyset WHERE per sort | For each of the 4 sort values: given a cursor, the Prisma `where` built by the handler yields only rows that come after the cursor row (assert on a seeded test DB or mock Prisma) |
| `nextCursor` null at end | When `items.length < take`, `nextCursor` is `null` |
| `nextCursor` present when full page | When `items.length === take`, `nextCursor` is a non-null string |
| Sort-change reset | Changing `sort` from `related` to `rating` on the client resets the cursor and item list |
| SSR first page present | `app/page.tsx` renders the first 24 items in HTML (no client-only blank) |
| SEC-1 gate on cursor pages | A cursor page fetch always includes the base `buildCampSiteWhere` predicates (unit test on the route handler) |
| NULL avgRating boundary | A cursor at the last non-null avgRating item returns the null-avgRating camps on the next page |
| NULL priceLow boundary (price_asc) | A cursor at the last null-priceLow item (free camp, price_asc) returns the priced camps on the next page |

---

## Risks

| risk | severity | mitigation |
|---|---|---|
| NULL avgRating keyset boundary — camps with `avgRating = null` must appear on the correct page after all rated camps | **Critical** | Explicit two-case cursor logic (Case 1 / Case 2 above); unit test asserting the null boundary crosses correctly |
| NULL priceLow keyset for free camps (price_asc) | **Important** | Explicit null-segment cursor logic; unit test |
| Cursor tampering (malformed base64) | **Important** | `decodeCursor` wrapped in try/catch → returns `400`; never passed to Prisma raw |
| CACHE-1 first page size divergence (40 vs 24) | **Important** | Standardise to 24 (see Open Trade-offs); if left as 40, the initial cursor encodes item #24 of 40 — items 25–40 are a "pre-loaded bonus" not paginated through again |
| CLS from skeleton height mismatch | Suggestion | Skeletons use the same card aspect ratio as `CampgroundCard`; height must match to prevent layout shift |

---

## PR split

**Recommended two-PR delivery:**

| PR | scope | dependency |
|---|---|---|
| PR A (backend) | `lib/keyset-cursor.ts` + extend `GET /api/campsites` with cursor + zod validation + unit tests for keyset WHERE + null boundary | none |
| PR B (frontend) | `components/InfiniteScrollGrid.tsx` + update `app/page.tsx` to pass `initialCursor` + integration test | PR A merged |

Both PRs base into `staging`. PR A is independently testable via `curl`.

---

## ADRs

ADR-011 (keyset-vs-offset pagination) is referenced in `story.md ## Links`. The decision is recorded here rather than as a full ADR file because the architectural rationale is straightforward and the decision is not cross-module:

- **Keyset chosen over offset** because: offset `SKIP N` scans `N` rows on every subsequent page — O(N) at the DB; keyset uses the index to seek directly to the next row — O(log n). At 140+ camps today and unbounded growth, offset drift (duplicate/skipped items on concurrent inserts) is also a risk.
- **Prisma `cursor` API not used** because `cursor` requires a unique column and the sort columns (`createdAt`, `priceLow`, `avgRating`) are non-unique — Prisma's cursor would produce incorrect results on ties.
- **OR-decomposition chosen over raw SQL** to avoid `$queryRawUnsafe` (security boundary per `.claude/rules/api.md`).

If the owner judges this decision warrants a standalone ADR file, the slug would be `docs/adr/ADR-011-keyset-cursor-pagination.md`.

---

## Open trade-offs for the owner (G2)

### OT-1 — Page size: 24 vs 40 (Important)

The current `getDefaultCatalog` first page is `take:40`. The cursor API is designed for `take:24`.

Options:

| option | behaviour | impact |
|---|---|---|
| A (recommended) | Change both to `take:24` | Visible change: first page shrinks from 40 to 24 cards. Simpler: uniform page size across SSR and cursor pages. Cache entry smaller. |
| B | Keep first page at `take:40`, cursor pages at `take:24` | No visible change to warm users. Inconsistent page sizes (annoying for testing). Need to handle the "first cursor" pointing to position 24 within the 40-item first page, or re-fetch from position 24 on first scroll. |
| C | Keep first page at `take:40`, emit first cursor at item 24 | Serves 40 SSR; cursor starts at #25. Items 25–40 from SSR are surfaced again as cursor page 2 starts from #25 — acceptable if client dedupes by id. |

**Owner decision needed before backend begins.** If no answer, default = Option A.

### OT-2 — Entrance animation for appended cards (Suggestion)

Appended cards can fade/slide in per DESIGN.md motion tokens, or appear instantly. Instant appearance is simpler and avoids any CLS risk. An entrance animation must be reduced-motion safe. **Default: no animation (instant append).** Raise as a separate design task if desired.

---

## Links

- `story.md` — CAM-196 AC and rules
- `prisma/schema.prisma` — CampSite model, lines 237–351 (indexes at lines 344–350)
- `lib/catalog-cache.ts` — `getDefaultCatalog` (CACHE-1, `take:40` to update)
- `lib/read-models/camp-card.ts` — `campCardSelect` + `CampCardPayload`
- `lib/campsite-filters.ts` — `buildCampSiteWhere` (unchanged)
- `app/api/campsites/route.ts` — GET to extend with cursor + orderBy
- `app/page.tsx` — SSR first page + `initialCursor` computation
- `components/CampgroundGrid.tsx` — replaced by `InfiniteScrollGrid` on home page
- `schema/api-schema.json` — updated with `GET /api/campsites` cursor contract
- `docs/adr/ADR-000-index.md` — ADR-011 slot (keyset pagination)

## Changelog

- v1 (2026-06-26) — G2 technical design authored by architect
