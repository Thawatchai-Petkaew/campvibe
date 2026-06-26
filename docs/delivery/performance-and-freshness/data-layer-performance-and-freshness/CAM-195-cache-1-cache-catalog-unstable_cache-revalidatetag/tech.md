---
linear: CAM-195
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
persona: platform
artifact: tech
owner: architect
status: In Progress
version: v1
updated: 2026-06-26
---
# Tech — CACHE-1 + FRESH-1: safe caching via unstable_cache + revalidateTag (CAM-195)

## Summary

No schema migration. This story is purely a caching layer: a new `lib/catalog-cache.ts` wraps two
Prisma reads in `unstable_cache`, and seven write paths call `revalidateTag` after commit. A guard
test asserts the wiring is never accidentally dropped.

---

## 1. Cache targets

### What gets cached

| Target | Cacheable? | Rationale |
|---|---|---|
| Detail read (`prisma.campSite.findFirst` by `nameThSlug`/`nameEnSlug`) | YES | Stable URL, public, slug does not change after publish. Session/owner check (`canViewCampSite`) happens OUTSIDE the wrapper and is never cached. |
| Default/unfiltered catalog listing (`buildCampSiteWhere` with all params `undefined`, sort `related`) | YES | The zero-filter page is by far the most common anonymous view. Cached as a discrete entry; does not overlap with filtered views. |
| Filtered/search catalog (any `searchParam` present: `keyword`, `province`, `district`, dates, `min`/`max`, `sort != related`, facets) | NO — stays dynamic | Combinatorial param space; a stale filter result is wrong for the user. |
| Session wishlist lookup (`prisma.wishlist.findMany`) | NO | Session-scoped, per-user — must be live. |
| `canViewCampSite(campSite, session)` | NO | Session-dependent; calling this inside a cache would leak unpublished camp data to strangers. |
| Availability calendar (`app/api/campgrounds/[id]/availability/route.ts`, `app/api/campgrounds/[id]/availability`) | NO — already `force-dynamic` + `no-store` (CAM-190 / AVAIL-1) | Must reflect live blocked-date writes. |
| Host dashboard (`app/host/page.tsx`), host new camp (`app/host/new/page.tsx`) | NO — already `force-dynamic` | Operator views their own unpublished content; must be live. |
| Detail preview (unpublished, operator-only view) | NO | `canViewCampSite` gate is session-dependent. |

### Dropping `force-dynamic` on `app/page.tsx`

`app/page.tsx` currently carries `export const dynamic = 'force-dynamic'` (line 14). That directive
forces every request through the full server render, including the default-view query.

The design removes that export for the default-view path by calling the cached wrapper from
`lib/catalog-cache.ts`. However, the page still calls `await auth()` (line 40) and the wishlist
lookup (lines 113–124). Both are session-dependent and must NOT be cached.

Strategy: keep the page as a dynamic server component but remove `force-dynamic` only after
wrapping the Prisma read in `unstable_cache`. Next.js will still call the session/wishlist paths
dynamically; the cache wrapper insulates only the DB query for the default catalog read.

For the detail page (`app/campgrounds/[slug]/page.tsx`): no `force-dynamic` is set today. The page
is already static-eligible per Next.js defaults except for the `await auth()` call (line 17), which
makes it dynamic. The `unstable_cache` wrapper for `findFirst` avoids the repeated DB round-trip on
warm requests while the session/wishlist/canViewCampSite checks stay outside the cache.

---

## 2. `lib/catalog-cache.ts` — shape

New file. Single source of truth for all cache wrappers and tag constants.

```ts
// lib/catalog-cache.ts
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { campCardSelect } from '@/lib/read-models/camp-card';
import type { CampCardPayload } from '@/lib/read-models/camp-card';
import type { Prisma } from '@prisma/client';

// ─── Tag constants ────────────────────────────────────────────────────────────
// Single source so callers never type raw strings.

/** Broad tag covering the full public catalog listing. */
export const CATALOG_TAG = 'catalog';

/** Narrow tag for a single campsite by database id. */
export function campTag(id: string): string {
  return `camp:${id}`;
}

/** Narrow tag for a single campsite by slug (either nameThSlug or nameEnSlug). */
export function campSlugTag(slug: string): string {
  return `camp:slug:${slug}`;
}

// ─── TTLs ─────────────────────────────────────────────────────────────────────
const DETAIL_REVALIDATE_S = 300; // 5 min — detail page: slug is stable; revalidateTag is the
                                  // primary freshness mechanism; TTL is a safety net only.
const LISTING_REVALIDATE_S = 60;  // 60 s — default catalog listing: shorter TTL because
                                   // a new publish must appear quickly even if a write path
                                   // misses revalidation (belt-and-suspenders).

// ─── Wrappers ─────────────────────────────────────────────────────────────────

/**
 * getCampBySlug — cached detail read.
 *
 * Returns the full campSite row (same include as app/campgrounds/[slug]/page.tsx) or null.
 * The caller MUST run canViewCampSite(result, session) AFTER this call — session checks
 * are never inside the cache boundary.
 *
 * Pattern mirrors lib/linear.ts:106 (unstable_cache with revalidate + tags).
 */
export const getCampBySlug = unstable_cache(
  async (slug: string) => {
    return prisma.campSite.findFirst({
      where: {
        OR: [{ nameThSlug: slug }, { nameEnSlug: slug }],
      },
      include: {
        location: true,
        operator: { select: { id: true, name: true, image: true, createdAt: true } },
        spots: true,
        options: true,
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });
  },
  ['camp-detail'],         // base cache key prefix
  {
    revalidate: DETAIL_REVALIDATE_S,
    tags: [],              // tags are injected per-call; Next.js merges the array from unstable_cache
                           // options with dynamic tags on revalidateTag calls.
  }
);
// NOTE: because the slug is part of the cache key via the function argument, each slug gets its
// own entry. To also invalidate by campTag(id) the revalidateTag caller uses BOTH campSlugTag and
// campTag after a write (see FRESH-1 map below).

/**
 * getDefaultCatalog — cached default/unfiltered listing.
 *
 * Equivalent to the zero-filter branch of app/page.tsx (all HomeSearchParams undefined,
 * sort = 'related'). Returns CampCardPayload[] capped at take:40.
 *
 * Called ONLY when isSearchActive is false in the page. Filtered views bypass this entirely
 * and query Prisma directly (same as today).
 */
export const getDefaultCatalog = unstable_cache(
  async (): Promise<CampCardPayload[]> => {
    return prisma.campSite.findMany({
      where: {
        isPublished: true,
        isActive: true,
        deletedAt: null,
      },
      select: campCardSelect,
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
  },
  ['catalog-default'],
  {
    revalidate: LISTING_REVALIDATE_S,
    tags: [CATALOG_TAG],
  }
);
```

### Design notes

- **Pattern source:** mirrors `lib/linear.ts:106` exactly — `unstable_cache(asyncFn, [keyParts], { revalidate })`. The linear pattern uses a pulse arg in the key to enable external invalidation; here, revalidateTag provides the same mechanism without an extra arg.
- **`getCampBySlug` tag propagation:** `unstable_cache` resolves tags from the options object at definition time; dynamic per-entry tags (`campTag(id)`, `campSlugTag(slug)`) are invoked via `revalidateTag` from write paths. The slug-keyed cache entry is invalidated by calling `revalidateTag(campSlugTag(slug))` and `revalidateTag(campTag(id))`.
- **`getDefaultCatalog` where clause:** explicitly filters `isPublished: true, isActive: true, deletedAt: null` to match the public-only contract. Today `buildCampSiteWhere` already applies this; the cache wrapper must replicate it so a delete/unpublish is reflected immediately on the next revalidation.
- **No session inside wrappers:** no `auth()`, no `prisma.wishlist`, no `canViewCampSite` inside either wrapper. All session-dependent work remains in the page outside the cache boundary.
- **No PPR / `'use cache'`:** not used; experimental directive deferred per owner decision (CAM-191 incident).

---

## 3. FRESH-1 revalidation map

Every catalog-mutating write path must call `revalidateTag` after a successful DB commit. Calls must
happen after the transaction completes, not inside it (revalidateTag is a Next.js cache side-effect,
not a DB operation).

| Write path | File | Trigger | revalidateTag / revalidatePath calls |
|---|---|---|---|
| **Create campsite** | `app/api/campsites/route.ts` — `POST`, after `prisma.campSite.create` succeeds | New camp created | `revalidateTag(CATALOG_TAG)` |
| **Edit campsite** | `app/api/campsites/[id]/route.ts` — `PUT`, after `prisma.campSite.update` succeeds | Any field edit including isPublished flip (publish/unpublish — same handler, same field) | `revalidateTag(campTag(id))` + `revalidateTag(CATALOG_TAG)` + `revalidatePath('/campgrounds/' + updated.nameThSlug)` + `revalidatePath('/campgrounds/' + updated.nameEnSlug)` |
| **Delete campsite** | `app/api/campsites/[id]/route.ts` — `DELETE`, after `prisma.campSite.delete` succeeds | Camp removed | `revalidateTag(campTag(id))` + `revalidateTag(CATALOG_TAG)` |
| **Create review** | `app/api/reviews/route.ts` — `POST`, after `prisma.$transaction` succeeds | Review added; AGG-1 also updates `avgRating`/`reviewCount` on CampSite in the same tx | `revalidateTag(campTag(data.campSiteId))` + `revalidateTag(CATALOG_TAG)` |
| **Upload image** | `app/api/upload/route.ts` — `POST`, after `put(...)` or local `writeFile` succeeds | Cover image or gallery image uploaded | `revalidateTag(campTag(campSiteId))` — requires the caller to pass `campSiteId` as a query param (see Open question #1) |
| **Seed** | `app/api/seed/route.ts` — GET handler end | Full seed run replaces catalog | `revalidateTag(CATALOG_TAG)` |
| **Bulk-seed** | `app/api/bulk-seed/route.ts` — GET handler end | Bulk synthetic data load | `revalidateTag(CATALOG_TAG)` |
| **Scrape-seed** | `app/api/scrape-seed/route.ts` — GET handler end | Scraper-based seed | `revalidateTag(CATALOG_TAG)` |

### Publish / unpublish note

`isPublished` is a plain field on `CampSite`. There is no separate publish/unpublish route: the PUT
handler at `app/api/campsites/[id]/route.ts` (line 120) already handles `isPublished` as part of a
partial update. No new route is needed. The Edit row above covers publish/unpublish.

### Import for write paths

```ts
import { revalidateTag, revalidatePath } from 'next/cache';
import { CATALOG_TAG, campTag, campSlugTag } from '@/lib/catalog-cache';
```

---

## 4. Guard test — `__tests__/freshness-guard.test.ts`

A static manifest test: for each write handler listed in the revalidation map, assert that the
handler's source file contains a `revalidateTag` (or `revalidatePath`) call. The test fails fast if
a future PR removes or forgets the call.

```ts
// __tests__/freshness-guard.test.ts
import { readFileSync } from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');

const WRITE_PATHS: { file: string; description: string }[] = [
  { file: 'app/api/campsites/route.ts',       description: 'POST /api/campsites (create)' },
  { file: 'app/api/campsites/[id]/route.ts',  description: 'PUT /api/campsites/[id] (edit/publish/delete)' },
  { file: 'app/api/reviews/route.ts',          description: 'POST /api/reviews (create review)' },
  { file: 'app/api/upload/route.ts',           description: 'POST /api/upload (image upload)' },
  { file: 'app/api/seed/route.ts',             description: 'GET /api/seed' },
  { file: 'app/api/bulk-seed/route.ts',        description: 'GET /api/bulk-seed' },
  { file: 'app/api/scrape-seed/route.ts',      description: 'GET /api/scrape-seed' },
];

describe('FRESH-1 freshness guard', () => {
  test.each(WRITE_PATHS)('$description contains a revalidateTag or revalidatePath call', ({ file }) => {
    const src = readFileSync(path.join(root, file), 'utf8');
    const hasRevalidate = src.includes('revalidateTag(') || src.includes('revalidatePath(');
    expect(hasRevalidate).toBe(true);
  });
});
```

The test reads source files at test time (no imports, no runtime execution of the handlers). It is
intentionally coarse: it checks presence, not correctness of the tag string. Correctness is covered
by the integration test in Self-verify (publish → observe detail page update within TTL).

---

## 5. Exclusions — explicitly NOT cached

| Path / concern | Why excluded |
|---|---|
| `app/api/campgrounds/[id]/availability/route.ts` + `app/api/campgrounds/[id]/availability/route.ts` | Already `force-dynamic` + `Cache-Control: no-store` (CAM-190 / AVAIL-1). Must reflect live `BlockedDate` writes immediately. Must not be touched. |
| `lib/campsite-availability.ts` | Read-only helper; called only from the above routes. Excluded by the route-level `force-dynamic`. |
| `app/host/page.tsx` + `app/host/new/page.tsx` | Operator dashboard — always `force-dynamic`. Shows unpublished camps; must be live. |
| `canViewCampSite(campSite, session)` call in `app/campgrounds/[slug]/page.tsx` (line 53) | Session-dependent. Must run outside and after the cached `getCampBySlug` call. Calling it inside the cache would cache an access-control decision keyed to one session for all future callers. |
| Session wishlist lookup (`prisma.wishlist.findMany`, `app/page.tsx` lines 113–124) | Per-user. Must stay dynamic. |
| `app/api/campsites/GET` (catalog API route) | This is the REST catalog endpoint, not the page. It is used by the host edit form and internal tooling. It does not read from the `unstable_cache` wrapper; it remains a live Prisma query. If caching is later needed here it would be a separate story. |
| Review aggregate on detail page (`prisma.review.aggregate`, `app/campgrounds/[slug]/page.tsx` lines 85–96) | The review aggregate section is in a separate `try/catch` (AC-6). It is NOT included in `getCampBySlug`. The cache wrapper covers only the `findFirst` for campsite data. Adding review aggregate to the cache is a separate concern (deferred). |

---

## 6. Measurement plan (ship/no-ship gate)

The ship decision is: if warm-cache TTFB is not clearly lower than the force-dynamic baseline,
do NOT ship — keep `force-dynamic`.

### Baseline commands (before — `force-dynamic`, current staging)

```bash
# Home page — 5 samples, measure TTFB (time_starttransfer)
for i in 1 2 3 4 5; do
  curl -o /dev/null -s -w "TTFB=%{time_starttransfer}s total=%{time_total}s\n" \
    "https://campvibe-staging.vercel.app/"
done

# Detail page — pick a published slug; 5 samples
for i in 1 2 3 4 5; do
  curl -o /dev/null -s -w "TTFB=%{time_starttransfer}s total=%{time_total}s\n" \
    "https://campvibe-staging.vercel.app/campgrounds/<slug>"
done
```

Run baseline BEFORE deploying the cache change. Record the median TTFB for home and detail.

### Post-deploy commands (after — cached, warm)

Same commands on the same staging URL after the PR is deployed. Run the home request twice:
first cold (cache miss, ~1 fresh DB query), then 3–5 warm requests (cache hit).

Interpret the warm-request TTFB to judge the win.

### Ship rule

| Observation | Decision |
|---|---|
| Warm home TTFB clearly lower than baseline (e.g. ≥30% reduction from the 2.4–5.3s range) | Ship (merge to staging → Done) |
| Warm detail TTFB clearly lower than baseline | Ship |
| Improvement is marginal or within noise | Do NOT ship; revert to `force-dynamic`; open a follow-up ticket to investigate |
| Any staleness issue observed (stale data shown after a write) | Do NOT ship; debug the revalidation map first |

Record the before/after numbers in the story's Self-verify section before marking Done.

---

## 7. PR-split recommendation

CACHE-1 (new wrappers + page wiring) and FRESH-1 (seven write paths + guard test) together will
likely approach or exceed the ~400-line PR limit. Recommended split:

**PR A — FRESH-1 first (write-path wiring + guard test)**

Files changed:
- `lib/catalog-cache.ts` (new — tag constants + empty wrappers or stubs)
- `app/api/campsites/route.ts` — add `revalidateTag` after POST commit
- `app/api/campsites/[id]/route.ts` — add `revalidateTag` after PUT and DELETE commit
- `app/api/reviews/route.ts` — add `revalidateTag` after `$transaction` commit
- `app/api/upload/route.ts` — add `revalidateTag` after upload succeeds
- `app/api/seed/route.ts` — add `revalidateTag` at end
- `app/api/bulk-seed/route.ts` — add `revalidateTag` at end
- `app/api/scrape-seed/route.ts` — add `revalidateTag` at end
- `__tests__/freshness-guard.test.ts` (new)

This PR is safe to merge with zero user-visible effect: the tags are emitted but nothing reads from
a cache yet. The guard test goes green immediately.

**PR B — CACHE-1 (activate the cache reads)**

Files changed:
- `lib/catalog-cache.ts` — complete the `getCampBySlug` and `getDefaultCatalog` wrappers
- `app/page.tsx` — remove `force-dynamic`, call `getDefaultCatalog()` for the default path
- `app/campgrounds/[slug]/page.tsx` — call `getCampBySlug(slug)` before the `canViewCampSite` gate

This PR activates caching. It is gated on the measurement plan: merge only if TTFB improves.

---

## 8. ADR

No new ADR is required. The decision to use `unstable_cache + revalidateTag` over PPR / `'use cache'` is already owner-decided (hard constraint from the task brief, citing CAM-191 Edge-middleware incident). This is a build decision, not a new hard-to-reverse architectural call. If the measurement fails and the change is reverted, no ADR is needed because no schema or data contract changed.

If the implementation reveals a genuine trade-off (e.g. the upload route lacks a `campSiteId` param
and a design choice must be made — see Open question #1), an ADR will be written at that point.

---

## 9. Open questions for the owner (G2 trade-off escalation)

**OQ-1 — Upload route lacks `campSiteId` context (Important)**

`app/api/upload/route.ts` is a generic file upload endpoint. It currently takes only a `filename`
query param (line 24) and has no knowledge of which campsite the uploaded image belongs to.

To call `revalidateTag(campTag(campSiteId))` after upload, the route needs the `campSiteId`. Two
options:

- **Option A:** Require callers to pass `?campSiteId=<id>` as an additional query param. The route
  reads it, validates it is a non-empty string, and calls `revalidateTag(campTag(campSiteId))` after
  a successful upload. Impact: backward-compatible addition; existing callers that do not pass
  `campSiteId` simply do not invalidate the camp cache (acceptable — the camp cache will expire at
  its 5-min TTL).
- **Option B:** Skip `revalidateTag` on the upload route entirely. The camp detail cache expires
  within DETAIL_REVALIDATE_S (300s) anyway; the operator normally follows an upload with a PUT
  (edit) that fires `revalidateTag(campTag(id))`. Impact: cover image change may take up to 5 min
  to appear on the cached detail page.

Recommendation from the architect: Option A (prefer explicit wiring). However the TTL safety net
of Option B is also acceptable since upload-without-edit is an uncommon flow. Owner to decide.

**OQ-2 — Review aggregate inside the detail cache (Suggestion)**

The review aggregate (`prisma.review.aggregate` + `prisma.review.findMany`, lines 85–96 of the
detail page) is currently excluded from `getCampBySlug`. This means a new review still forces a
live DB round-trip for the review section on every detail page load.

The review section is isolated in its own `try/catch` (AC-6). Including it in the cache would
require either a second `unstable_cache` wrapper or merging it into `getCampBySlug`. Merging is
simpler but couples the cache lifetime of two separate concerns. A separate `getCampReviews(id)`
wrapper would be cleaner but adds scope beyond CACHE-1/FRESH-1.

Owner to decide: include or defer to a follow-up story.

**OQ-3 — `getDefaultCatalog` where-clause vs `buildCampSiteWhere` divergence risk (Info)**

`getDefaultCatalog` duplicates the zero-filter public-camp predicate (`isPublished: true, isActive:
true, deletedAt: null`) rather than calling `buildCampSiteWhere({})`. This is intentional: the
cached function must not accept dynamic arguments that would change the cache key scope. However,
if `buildCampSiteWhere` adds a new global condition in a future story (e.g. a new `isVerified`
requirement for public listing), `getDefaultCatalog` will not automatically inherit it.

Mitigation: the freshness guard test covers write paths, but not schema drift. A comment in
`lib/catalog-cache.ts` should explicitly cross-reference `lib/campsite-filters.ts` so future
editors know to keep them in sync.

No owner decision required; recorded for backend awareness.

---

## Data model

No migration. No Prisma schema change.

Fields used by the cache wrappers are all existing columns:
- `CampSite.nameThSlug`, `CampSite.nameEnSlug` — slug lookup key
- `CampSite.isPublished`, `CampSite.isActive`, `CampSite.deletedAt` — public filter
- All columns in `campCardSelect` (lib/read-models/camp-card.ts) — listing projection

---

## API contract

No new `/api/*` endpoints. No contract changes.

`revalidateTag` and `revalidatePath` are Next.js server-side cache invalidation calls, not API
endpoints. They are called inside existing route handlers after a successful DB commit; they are
invisible to external callers.

---

## Boundary

```
[browser] → GET /           → app/page.tsx (Server Component, dynamic)
                                ├── auth() [live, session]
                                ├── isSearchActive? YES → prisma.campSite.findMany [live, direct]
                                ├── isSearchActive? NO  → getDefaultCatalog() [unstable_cache → Prisma]
                                └── session?.user → prisma.wishlist.findMany [live, session]

[browser] → GET /campgrounds/[slug] → app/campgrounds/[slug]/page.tsx (Server Component, dynamic)
                                ├── auth() [live, session]
                                ├── getCampBySlug(slug) [unstable_cache → Prisma]
                                ├── canViewCampSite(campSite, session) [live, after cache]
                                ├── isOwner check [live, from session]
                                ├── prisma.wishlist.findUnique [live, session]
                                └── prisma.review.aggregate + findMany [live — excluded from cache, OQ-2]

[host browser] → POST/PUT/DELETE /api/campsites/* → route handler
                                ├── requireAuth / requireCampSitePermission [live]
                                ├── prisma.campSite.create/update/delete [live, DB commit]
                                └── revalidateTag(campTag, CATALOG_TAG) + revalidatePath [after commit]

[reviewer] → POST /api/reviews → route handler
                                ├── auth() [live]
                                ├── prisma.$transaction (create review + update CampSite avgRating) [live]
                                └── revalidateTag(campTag, CATALOG_TAG) [after transaction]
```

The client never calls Prisma directly. The cache layer is entirely server-side within `lib/`.

---

## Links

`story.md` · `lib/linear.ts:106` (unstable_cache pattern) · `lib/read-models/camp-card.ts` (campCardSelect) · `lib/campsite-filters.ts` (buildCampSiteWhere) · `lib/campsite-visibility.ts` (canViewCampSite) · `app/api/campgrounds/[id]/availability/route.ts` (AVAIL-1 no-store baseline)

## Changelog
- v1 (2026-06-26) — created at G2
