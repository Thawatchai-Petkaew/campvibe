/**
 * lib/catalog-cache.ts — FRESH-1 / CACHE-1 (CAM-195)
 *
 * Single source of truth for all cache tag constants and unstable_cache
 * wrappers for the default catalog listing and the campsite detail read.
 *
 * Pattern mirrors lib/linear.ts:106 — unstable_cache(asyncFn, [keyParts], { revalidate, tags }).
 *
 * PR A established tag helpers + write-path revalidateTag calls.
 * PR B (this file) activates the read-side cache wrappers.
 */

import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { campCardSelect, type CampCardPayload } from '@/lib/read-models/camp-card';

// ─── Tag constants ─────────────────────────────────────────────────────────────
// Single source so callers never type raw strings.

/** Broad tag covering the full public catalog listing (app/page.tsx default view). */
export const CATALOG_TAG = 'catalog';

/**
 * Narrow tag for a single campsite identified by its database id.
 * Used by PUT (edit/publish/unpublish) and DELETE write paths.
 */
export function campTag(id: string): string {
  return `camp:${id}`;
}

/**
 * Narrow tag for a single campsite identified by either nameThSlug or nameEnSlug.
 * Used by PUT write paths when a slug is known (both old + new on rename).
 */
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
 * are never inside the cache boundary. Calling canViewCampSite inside the cache would
 * cache an access-control decision keyed to one session for all future callers (sec leak).
 *
 * CAM-357 fix: unstable_cache's `tags` option is fixed at WRAP time, not per-call — a
 * module-level `unstable_cache(fn, keyParts, { tags: [] })` (the old shape here) can never
 * carry a tag that depends on the runtime slug, so every revalidateTag(campSlugTag(slug))
 * call across the app was inert against this cache entry (freshness relied on the 5-min
 * TTL alone). The fix builds the unstable_cache wrapper INSIDE this exported function, on
 * every call, so `tags` can read the real `slug` argument: `tags: [campSlugTag(slug)]`.
 *
 * This still caches correctly (no cache-hit loss) because unstable_cache's persisted
 * cache store is looked up by a hash of `keyParts` + the serialized call arguments, NOT
 * by the JS identity/closure of the `unstable_cache(...)` call site. `keyParts` here is
 * `['camp-detail', slug]` — a value that is deterministic given only `slug` — and the
 * runtime argument passed to the returned function is the same `slug` again. Two calls
 * for the SAME slug (even across two separate request lifecycles, each constructing a
 * "new" wrapper object) hash to the IDENTICAL cache key and hit the same persisted entry;
 * two calls for DIFFERENT slugs hash to different keys and get independent entries, each
 * carrying its own real tag. Constructing the wrapper per call is the standard, documented
 * workaround for unstable_cache not supporting a tags-generator function of the arguments.
 *
 * Write paths bust the entry via:
 *   revalidateTag(campSlugTag(slug))  — by slug (now a REAL tag on this entry)
 *   revalidateTag(campTag(id))        — by database id (kept for the catalog-tag path;
 *                                        does not bust this cache entry, since the id is
 *                                        not knowable before the slug is resolved)
 */
export async function getCampBySlug(slug: string) {
  const cached = unstable_cache(
    async (slug: string) => {
      return prisma.campSite.findFirst({
        where: {
          OR: [{ nameThSlug: slug }, { nameEnSlug: slug }],
        },
        include: {
          location: true,
          operator: { select: { id: true, name: true, image: true, createdAt: true } },
          // CAM-353 BR-2: extend from `spots: true` to carry live spots' own photos.
          // Full `include: { images }` (NOT an enumerating `select`) so `Image.kind`
          // (the PANORAMA marker) rides through at runtime — the CAM-342 trap.
          // `where: { deletedAt: null }` excludes soft-deleted spots (EC-3); same
          // single query, richer include — no N+1, no extra round-trip.
          spots: {
            where: { deletedAt: null },
            include: { images: { orderBy: { sortOrder: 'asc' } } },
          },
          options: true,
          images: { orderBy: { sortOrder: 'asc' } },
        },
      });
    },
    ['camp-detail', slug],
    {
      revalidate: DETAIL_REVALIDATE_S,
      // Real per-slug tag — computed from the runtime argument (CAM-357).
      tags: [campSlugTag(slug)],
    }
  );
  return cached(slug);
}

/**
 * getDefaultCatalog — cached default/unfiltered listing.
 *
 * Equivalent to the zero-filter branch of app/page.tsx (all HomeSearchParams undefined,
 * sort = 'related'). Returns CampCardPayload[] capped at take:24 (OT-1=A — PERF-3/CAM-196:
 * unified page size for SSR first page and cursor pages).
 *
 * Called ONLY when isSearchActive is false in the page. Filtered views bypass this
 * entirely and query Prisma directly (they remain live / uncached — same as today).
 *
 * OQ-3 (CAM-195): the where-clause below MUST mirror the zero-filter base of
 * buildCampSiteWhere in lib/campsite-filters.ts ({ isActive, isPublished, deletedAt }).
 * If buildCampSiteWhere ever adds a new global condition (e.g. isVerified), update
 * this predicate to match — otherwise the cached default catalog may return rows
 * that the filtered view would exclude. Keep these two predicates in sync.
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
      take: 24,
    });
  },
  ['catalog-default'],
  {
    revalidate: LISTING_REVALIDATE_S,
    tags: [CATALOG_TAG],
  }
);
