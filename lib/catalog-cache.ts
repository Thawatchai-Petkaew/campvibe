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
 * Each slug gets its own cache entry because the slug arg is incorporated into the
 * cache key by unstable_cache. Write paths bust the entry via:
 *   revalidateTag(campSlugTag(slug))  — by slug
 *   revalidateTag(campTag(id))        — by database id (same entry)
 *
 * Pattern mirrors lib/linear.ts:106.
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
  ['camp-detail'],
  {
    revalidate: DETAIL_REVALIDATE_S,
    // tags: [] — slug differentiates entries via the function arg (Next.js incorporates
    // args into the cache key). Write paths call revalidateTag(campSlugTag(slug)) +
    // revalidateTag(campTag(id)) to bust the relevant entry.
    tags: [],
  }
);

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
