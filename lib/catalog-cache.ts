/**
 * lib/catalog-cache.ts — FRESH-1 / CACHE-1 (CAM-195)
 *
 * Single source of truth for all cache tag constants and (in PR B) the
 * unstable_cache wrappers for the default catalog listing and the campsite
 * detail read.
 *
 * PR A (this file): exports only the tag helper functions. No cache wrappers
 * are activated yet — callers in write paths use these tags for revalidation
 * so the infrastructure is in place before the cache reads are turned on.
 *
 * PR B will add: unstable_cache wrappers (getCampBySlug, getDefaultCatalog),
 * TTL constants, and the required imports from next/cache and prisma.
 */

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

// ─── OQ-3 cross-reference note ─────────────────────────────────────────────────
// PR B will add getDefaultCatalog() with the where-clause:
//   { isPublished: true, isActive: true, deletedAt: null }
// This predicate MUST mirror the zero-filter branch of buildCampSiteWhere
// in lib/campsite-filters.ts. If buildCampSiteWhere ever adds a new global
// condition (e.g. isVerified), update getDefaultCatalog to match — otherwise
// the cached default catalog will return rows that the filtered view would
// exclude. Keep these two predicates in sync (OQ-3).
