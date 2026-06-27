/**
 * lib/catalog-cursor.ts — PERF-3 / CAM-196
 *
 * Keyset cursor utilities for the catalog pagination API.
 *
 * Three exports consumed by app/api/campsites/route.ts and app/page.tsx:
 *   encodeCursor  — last item + sort → opaque base64url string
 *   decodeCursor  — base64url string → { k, id } | null (invalid → null)
 *   buildKeysetWhere — { k, id } + sort → Prisma WHERE fragment (OR-decomposition)
 *   orderByFor    — sort → Prisma orderBy array
 *   PAGE_SIZE     — 24 (OT-1 = Option A: unified page size for both SSR and cursor pages)
 *
 * NULL handling is the critical correctness surface:
 *   - avgRating is Decimal(2,1)? — null means 0 reviews; sorts LAST (nulls: 'last').
 *   - priceLow is Decimal(12,2)? — null means isFree=true; sorts FIRST for price_asc.
 *
 * Each case is documented inline with a reference to the two-segment model in tech.md.
 * Do NOT use Prisma's built-in cursor API — the sort columns are non-unique; the manual
 * OR-decomposition is required for correct pagination across ties.
 *
 * No Prisma imports here: this module is pure (serialisable, usable from both server and
 * client). The Prisma type import is type-only.
 */

import type { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Unified page size for SSR first page and cursor pages (OT-1 = Option A). */
export const PAGE_SIZE = 24;

// ---------------------------------------------------------------------------
// Sort type
// ---------------------------------------------------------------------------

export const VALID_SORTS = ['related', 'price_asc', 'price_desc', 'rating'] as const;
export type CatalogSort = (typeof VALID_SORTS)[number];

// ---------------------------------------------------------------------------
// Cursor shape
// ---------------------------------------------------------------------------

/**
 * Internal cursor payload — never sent raw to the client.
 * k  = sort key value of the last item (ISO string / number / null)
 * id = CampSite.id of the last item (UUID tiebreaker)
 */
export interface CursorPayload {
  k: string | number | null;
  id: string;
}

// ---------------------------------------------------------------------------
// encodeCursor
// ---------------------------------------------------------------------------

/**
 * Produce an opaque base64url cursor from the last item on a page.
 *
 * sortKeyValue is the serialised value of the sort column:
 *   related  → createdAt ISO string (string)
 *   price_*  → priceLow number or null (free camp)
 *   rating   → avgRating number or null (no reviews)
 *
 * @param sortKeyValue  The value of the sort column from the last item.
 * @param id            The CampSite.id of the last item.
 */
export function encodeCursor(sortKeyValue: string | number | null, id: string): string {
  const payload: CursorPayload = { k: sortKeyValue, id };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

// ---------------------------------------------------------------------------
// decodeCursor
// ---------------------------------------------------------------------------

/**
 * Decode a cursor string produced by encodeCursor.
 * Returns null on any parse failure — callers must return 400 on null.
 */
export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('k' in parsed) ||
      !('id' in parsed) ||
      typeof (parsed as { id: unknown }).id !== 'string'
    ) {
      return null;
    }
    const { k, id } = parsed as { k: unknown; id: string };
    // k must be string, number, or null
    if (k !== null && typeof k !== 'string' && typeof k !== 'number') {
      return null;
    }
    return { k: k as string | number | null, id };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// buildKeysetWhere
// ---------------------------------------------------------------------------

/**
 * Build the Prisma WHERE fragment for keyset pagination.
 *
 * Uses OR-decomposition instead of Prisma's built-in cursor option because the sort
 * columns are non-unique (avgRating / priceLow / createdAt all have ties). Prisma's
 * cursor requires a unique column — it would produce incorrect results on ties.
 *
 * The WHERE fragment is merged by the caller via:
 *   where = { AND: [buildCampSiteWhere(filters), buildKeysetWhere(sort, cursor)] }
 *
 * NULL handling:
 *   rating:     avgRating=null sorts LAST  (nulls:'last'). Two cases:
 *               Case A — cursor in rated segment (k!=null)  → OR[lt, eq+id, null-all]
 *               Case B — cursor in null segment  (k===null) → AND[null, id-lt]
 *
 *   price_asc:  priceLow=null sorts FIRST (nulls:'first'). Two cases:
 *               Case A — cursor in null segment  (k===null) → AND[null, id-gt]
 *               Case B — cursor in priced segment (k!=null) → AND[not-null, OR[gt, eq+id]]
 *
 *   price_desc: priceLow=null sorts LAST  (nulls:'last'). Same two-case pattern as rating.
 *               Case A — cursor in priced segment (k!=null) → OR[lt, eq+id, null-all]
 *               Case B — cursor in null segment  (k===null) → AND[null, id-lt]
 *
 *   related:    createdAt is never null (non-nullable column). Standard two-value decomposition.
 */
export function buildKeysetWhere(
  sort: CatalogSort,
  cursor: CursorPayload
): Prisma.CampSiteWhereInput {
  const { k, id } = cursor;

  switch (sort) {
    // ─────────────────────────────────────────────────────────────────────────
    // related — createdAt DESC, id DESC
    // ─────────────────────────────────────────────────────────────────────────
    case 'related': {
      // createdAt is non-nullable; k is always an ISO string here.
      const kDate = typeof k === 'string' ? new Date(k) : new Date(0);
      return {
        OR: [
          { createdAt: { lt: kDate } },
          { createdAt: kDate, id: { lt: id } },
        ],
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // price_asc — priceLow ASC NULLS FIRST, id ASC
    // Null-priceLow (free camps) appear FIRST.
    // ─────────────────────────────────────────────────────────────────────────
    case 'price_asc': {
      if (k === null) {
        // Case A: cursor is within the null-priceLow segment (free camps).
        // Stay in the null segment; advance by id ASC.
        return {
          AND: [
            { priceLow: null },
            { id: { gt: id } },
          ],
        };
      }
      // Case B: cursor has crossed into the priced segment.
      // Free camps (null priceLow) have already been delivered — exclude them.
      const kNum = Number(k);
      return {
        AND: [
          { priceLow: { not: null } },
          {
            OR: [
              { priceLow: { gt: kNum } },
              { priceLow: kNum, id: { gt: id } },
            ],
          },
        ],
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // price_desc — priceLow DESC NULLS LAST, id DESC
    // Null-priceLow (free camps) appear LAST (same structure as rating/nulls-last).
    // ─────────────────────────────────────────────────────────────────────────
    case 'price_desc': {
      if (k === null) {
        // Case B: cursor is within the null segment (after all priced camps).
        // Stay in null segment; advance by id DESC.
        return {
          AND: [
            { priceLow: null },
            { id: { lt: id } },
          ],
        };
      }
      // Case A: cursor is still in the priced segment.
      // Deliver remaining priced camps + all null-priceLow camps after them.
      const kNum = Number(k);
      return {
        OR: [
          { priceLow: { lt: kNum } },
          { priceLow: kNum, id: { lt: id } },
          { priceLow: null },
        ],
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // rating — avgRating DESC NULLS LAST, id DESC
    // Null-avgRating camps (0 reviews) appear LAST.
    // ─────────────────────────────────────────────────────────────────────────
    case 'rating': {
      if (k === null) {
        // Case B: cursor is already in the null segment (all rated camps delivered).
        // Stay in null segment; advance by id DESC.
        return {
          AND: [
            { avgRating: null },
            { id: { lt: id } },
          ],
        };
      }
      // Case A: cursor is still in the rated segment.
      // Include: lower-rated camps, same-rating next-id, AND all null-avgRating camps.
      const kNum = Number(k);
      return {
        OR: [
          { avgRating: { lt: kNum } },
          { avgRating: kNum, id: { lt: id } },
          { avgRating: null },
        ],
      };
    }

    default: {
      // TypeScript exhaustiveness guard — should never reach here at runtime.
      void (sort as never);
      return {};
    }
  }
}

// ---------------------------------------------------------------------------
// orderByFor
// ---------------------------------------------------------------------------

/**
 * Return the Prisma orderBy array matching the sort param.
 *
 * Matches app/page.tsx ordering exactly:
 *   related    → createdAt DESC, id DESC
 *   price_asc  → priceLow ASC NULLS FIRST, id ASC
 *   price_desc → priceLow DESC NULLS LAST,  id DESC
 *   rating     → avgRating DESC NULLS LAST,  id DESC
 *
 * The `id` tiebreaker is DESC for DESC sorts and ASC for ASC sorts — consistent with
 * the keyset WHERE direction for each sort (see tech.md ADRs section).
 */
export function orderByFor(sort: CatalogSort): Prisma.CampSiteOrderByWithRelationInput[] {
  switch (sort) {
    case 'related':
      return [{ createdAt: 'desc' }, { id: 'desc' }];

    case 'price_asc':
      return [
        { priceLow: { sort: 'asc', nulls: 'first' } },
        { id: 'asc' },
      ];

    case 'price_desc':
      return [
        { priceLow: { sort: 'desc', nulls: 'last' } },
        { id: 'desc' },
      ];

    case 'rating':
      return [
        { avgRating: { sort: 'desc', nulls: 'last' } },
        { id: 'desc' },
      ];

    default: {
      void (sort as never);
      return [{ createdAt: 'desc' }, { id: 'desc' }];
    }
  }
}

// ---------------------------------------------------------------------------
// encodeCursorFromItem — convenience wrapper for app/page.tsx + route handler
// ---------------------------------------------------------------------------

/**
 * Extract the sort key value from a serialised camp card and return the encoded cursor.
 * Works on both raw CampCardPayload (Decimal) and serialised objects (number).
 *
 * Used by:
 *   1. app/page.tsx — computes initialCursor for the SSR first page
 *   2. app/api/campsites/route.ts — computes nextCursor for each cursor page
 *
 * @param item  A serialised camp card (priceLow/avgRating already number|null, createdAt string).
 * @param sort  The active sort.
 */
export function encodeCursorFromItem(
  item: { id: string; createdAt: string | Date; priceLow: number | null; avgRating: number | null },
  sort: CatalogSort
): string {
  let sortKeyValue: string | number | null;

  switch (sort) {
    case 'related':
      sortKeyValue =
        item.createdAt instanceof Date
          ? item.createdAt.toISOString()
          : String(item.createdAt);
      break;
    case 'price_asc':
    case 'price_desc':
      sortKeyValue = item.priceLow;
      break;
    case 'rating':
      sortKeyValue = item.avgRating;
      break;
    default: {
      void (sort as never);
      sortKeyValue = null;
    }
  }

  return encodeCursor(sortKeyValue, item.id);
}
