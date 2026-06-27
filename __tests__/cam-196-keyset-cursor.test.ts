/**
 * cam-196-keyset-cursor.test.ts — PERF-3 / CAM-196 (backend: cursor API + keyset)
 *
 * AC coverage:
 *
 *   AC-encode/decode  encodeCursor/decodeCursor round-trip for each sort, incl. k=null.
 *   AC-keyset-related  buildKeysetWhere(related) produces correct OR-decomposition.
 *   AC-keyset-price_asc  buildKeysetWhere(price_asc) — priced segment + null-priceLow segment.
 *   AC-keyset-price_desc  buildKeysetWhere(price_desc) — priced + null-priceLow (nulls last).
 *   AC-keyset-rating  buildKeysetWhere(rating) — rated segment + NULL boundary (critical).
 *   AC-null-rating   avgRating NULL boundary: Case A (rated → delivers null-camp segment)
 *                    and Case B (inside null segment → stays in null segment).
 *   AC-null-price    priceLow NULL boundary: Case A (null-priceLow segment price_asc)
 *                    and Case B (priced segment price_asc).
 *   AC-nextCursor    nextCursor is null when items < PAGE_SIZE; present when PAGE_SIZE.
 *   AC-sec1          buildCampSiteWhere base gate still merged on every cursor query.
 *   AC-orderBy       orderByFor returns the correct array for each sort.
 *   AC-page-size     PAGE_SIZE === 24 (OT-1=A).
 *   AC-catalog-cache  getDefaultCatalog take:24 (OT-1=A, source-inspect).
 *   AC-page-cursor   app/page.tsx computes initialCursor and passes it to CampgroundGrid.
 *
 * Layers:
 *   - encode/decode, buildKeysetWhere, orderByFor, PAGE_SIZE → unit (pure functions)
 *   - nextCursor, SEC-1, catalog-cache take:24, page.tsx wiring → source-inspect
 *
 * Prove-It notes:
 *   - encode/decode round-trip tests FAIL if the base64url codec is swapped.
 *   - NULL-boundary tests FAIL if the k===null branch is removed from buildKeysetWhere.
 *   - orderByFor nulls tests FAIL if nulls:'last'/'first' is removed.
 *   - catalog-cache take:24 test FAILS if take is changed back to 40.
 *   - page.tsx initialCursor test FAILS if encodeCursorFromItem import is removed.
 *   - SEC-1 test FAILS if buildCampSiteWhere is removed from the route.
 *
 * Coverage matrix: normal · null/empty · boundary · error/validation
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  encodeCursor,
  decodeCursor,
  buildKeysetWhere,
  orderByFor,
  encodeCursorFromItem,
  PAGE_SIZE,
  VALID_SORTS,
  type CatalogSort,
  type CursorPayload,
} from '../lib/catalog-cursor';

// ---------------------------------------------------------------------------
// Source helpers
// ---------------------------------------------------------------------------

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

const catalogCacheSrc    = readSrc('lib/catalog-cache.ts');
const pageSrc            = readSrc('app/page.tsx');
// LOAD-1 (CAM-197): data-fetch logic moved from page.tsx → CatalogResults.tsx.
const catalogResultsSrc  = readSrc('components/CatalogResults.tsx');
const routeSrc           = readSrc('app/api/campsites/route.ts');
const gridSrc            = readSrc('components/CampgroundGrid.tsx');

// ===========================================================================
// PAGE_SIZE
// ===========================================================================

describe('PAGE_SIZE — OT-1=A unified page size', () => {
  it('[normal] PAGE_SIZE === 24 (OT-1=A)', () => {
    // Prove-It: FAILS if PAGE_SIZE is changed back to 40.
    expect(PAGE_SIZE).toBe(24);
  });
});

// ===========================================================================
// VALID_SORTS
// ===========================================================================

describe('VALID_SORTS', () => {
  it('[normal] contains all four valid sort values', () => {
    expect(VALID_SORTS).toContain('related');
    expect(VALID_SORTS).toContain('price_asc');
    expect(VALID_SORTS).toContain('price_desc');
    expect(VALID_SORTS).toContain('rating');
  });
});

// ===========================================================================
// encodeCursor / decodeCursor — round-trip
// ===========================================================================

describe('encodeCursor / decodeCursor round-trip', () => {

  it('[normal] round-trip for related sort (k = ISO string)', () => {
    const sortKeyValue = '2026-05-01T10:00:00.000Z';
    const id = 'abc-def-123';
    const encoded = encodeCursor(sortKeyValue, id);
    const decoded = decodeCursor(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.k).toBe(sortKeyValue);
    expect(decoded!.id).toBe(id);
  });

  it('[normal] round-trip for price_asc sort (k = number)', () => {
    const sortKeyValue = 1250;
    const id = 'camp-uuid-001';
    const encoded = encodeCursor(sortKeyValue, id);
    const decoded = decodeCursor(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.k).toBe(1250);
    expect(decoded!.id).toBe(id);
  });

  it('[normal] round-trip for rating sort (k = number)', () => {
    const encoded = encodeCursor(4.5, 'camp-uuid-002');
    const decoded = decodeCursor(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.k).toBe(4.5);
    expect(decoded!.id).toBe('camp-uuid-002');
  });

  it('[null/empty] round-trip for k = null (free camp / no-review camp)', () => {
    // Critical: null must survive encode/decode for the NULL boundary cases.
    const encoded = encodeCursor(null, 'free-camp-id');
    const decoded = decodeCursor(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.k).toBeNull();
    expect(decoded!.id).toBe('free-camp-id');
  });

  it('[normal] encodeCursor produces a non-empty base64url string', () => {
    const encoded = encodeCursor('2026-01-01T00:00:00.000Z', 'any-id');
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
    // base64url must not contain + or / (standard base64 chars)
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('[error] decodeCursor returns null for an invalid cursor string', () => {
    expect(decodeCursor('not-valid-base64url!!')).toBeNull();
  });

  it('[error] decodeCursor returns null for a valid base64url but wrong JSON structure', () => {
    // Encode a JSON object that is missing the `id` field
    const bad = Buffer.from(JSON.stringify({ k: 'val' })).toString('base64url');
    expect(decodeCursor(bad)).toBeNull();
  });

  it('[error] decodeCursor returns null for an empty string', () => {
    expect(decodeCursor('')).toBeNull();
  });

  it('[error] decodeCursor returns null when k has an invalid type (array)', () => {
    const bad = Buffer.from(JSON.stringify({ k: [1, 2], id: 'abc' })).toString('base64url');
    expect(decodeCursor(bad)).toBeNull();
  });

  it('[boundary] round-trip preserves the minimum numeric k value (k = 0)', () => {
    const encoded = encodeCursor(0, 'camp-zero');
    const decoded = decodeCursor(encoded);
    expect(decoded!.k).toBe(0);
  });

  it('[boundary] round-trip preserves a very large price (k = 99999)', () => {
    const encoded = encodeCursor(99999, 'expensive-camp');
    const decoded = decodeCursor(encoded);
    expect(decoded!.k).toBe(99999);
  });
});

// ===========================================================================
// buildKeysetWhere — related (createdAt DESC, id DESC)
// ===========================================================================

describe('buildKeysetWhere — sort=related (createdAt DESC, id DESC)', () => {
  const cursor: CursorPayload = { k: '2026-05-01T10:00:00.000Z', id: 'abc123' };

  it('[normal] produces an OR with two branches', () => {
    const where = buildKeysetWhere('related', cursor) as { OR: unknown[] };
    expect(where).toHaveProperty('OR');
    expect(where.OR).toHaveLength(2);
  });

  it('[normal] first branch: createdAt lt the cursor date', () => {
    const where = buildKeysetWhere('related', cursor) as { OR: Array<Record<string, unknown>> };
    const branch0 = where.OR[0] as { createdAt: { lt: Date } };
    expect(branch0.createdAt.lt).toBeInstanceOf(Date);
    expect(branch0.createdAt.lt.toISOString()).toBe('2026-05-01T10:00:00.000Z');
  });

  it('[normal] second branch: same createdAt AND id lt cursor id (tiebreaker)', () => {
    const where = buildKeysetWhere('related', cursor) as { OR: Array<Record<string, unknown>> };
    const branch1 = where.OR[1] as { createdAt: Date; id: { lt: string } };
    expect(branch1.createdAt).toBeInstanceOf(Date);
    expect(branch1.createdAt.toISOString()).toBe('2026-05-01T10:00:00.000Z');
    expect(branch1.id.lt).toBe('abc123');
  });
});

// ===========================================================================
// buildKeysetWhere — price_asc (priceLow ASC NULLS FIRST, id ASC)
// ===========================================================================

describe('buildKeysetWhere — sort=price_asc', () => {

  it('[null/empty] Case A: cursor in null-priceLow segment (free camp) — AND[null, id-gt]', () => {
    // When cursor is a free camp (k=null, price_asc), we stay in the null segment and advance id ASC.
    const cursor: CursorPayload = { k: null, id: 'free-camp-001' };
    const where = buildKeysetWhere('price_asc', cursor) as { AND: Array<Record<string, unknown>> };
    expect(where).toHaveProperty('AND');
    expect(where.AND).toHaveLength(2);
    // First condition: priceLow is null (staying in null segment)
    expect(where.AND[0]).toEqual({ priceLow: null });
    // Second condition: id > cursor id (ASC tiebreaker within null segment)
    const idBranch = where.AND[1] as { id: { gt: string } };
    expect(idBranch.id.gt).toBe('free-camp-001');
  });

  it('[normal] Case B: cursor in priced segment (k != null) — AND[not-null, OR[gt, eq+id]]', () => {
    const cursor: CursorPayload = { k: 500, id: 'priced-camp-001' };
    const where = buildKeysetWhere('price_asc', cursor) as {
      AND: [{ priceLow: { not: null } }, { OR: Array<Record<string, unknown>> }]
    };
    expect(where).toHaveProperty('AND');
    // First: priceLow is NOT null (free camps already delivered)
    expect(where.AND[0]).toEqual({ priceLow: { not: null } });
    // Second: OR decomposition for priced segment
    expect(where.AND[1]).toHaveProperty('OR');
    const branches = (where.AND[1] as { OR: Array<Record<string, unknown>> }).OR;
    expect(branches).toHaveLength(2);
    // Branch 0: priceLow > cursor price
    expect((branches[0] as { priceLow: { gt: number } }).priceLow.gt).toBe(500);
    // Branch 1: same price, id > cursor id
    const eq = branches[1] as { priceLow: number; id: { gt: string } };
    expect(eq.priceLow).toBe(500);
    expect(eq.id.gt).toBe('priced-camp-001');
  });
});

// ===========================================================================
// buildKeysetWhere — price_desc (priceLow DESC NULLS LAST, id DESC)
// ===========================================================================

describe('buildKeysetWhere — sort=price_desc', () => {

  it('[normal] Case A: cursor in priced segment (k != null) — OR[lt, eq+id, null-all]', () => {
    // Deliver lower-priced camps, same-price next id, then all null-priceLow camps.
    const cursor: CursorPayload = { k: 1200, id: 'camp-priced-99' };
    const where = buildKeysetWhere('price_desc', cursor) as { OR: Array<Record<string, unknown>> };
    expect(where).toHaveProperty('OR');
    expect(where.OR).toHaveLength(3);
    // Branch 0: priceLow < cursor price (lower prices follow higher in DESC)
    expect((where.OR[0] as { priceLow: { lt: number } }).priceLow.lt).toBe(1200);
    // Branch 1: same price, id lt cursor id
    const eq = where.OR[1] as { priceLow: number; id: { lt: string } };
    expect(eq.priceLow).toBe(1200);
    expect(eq.id.lt).toBe('camp-priced-99');
    // Branch 2: null priceLow (all free camps come after all priced camps in DESC)
    expect(where.OR[2]).toEqual({ priceLow: null });
  });

  it('[null/empty] Case B: cursor in null-priceLow segment — AND[null, id-lt]', () => {
    const cursor: CursorPayload = { k: null, id: 'free-camp-desc-01' };
    const where = buildKeysetWhere('price_desc', cursor) as { AND: Array<Record<string, unknown>> };
    expect(where).toHaveProperty('AND');
    expect(where.AND[0]).toEqual({ priceLow: null });
    const idBranch = where.AND[1] as { id: { lt: string } };
    expect(idBranch.id.lt).toBe('free-camp-desc-01');
  });
});

// ===========================================================================
// buildKeysetWhere — rating (avgRating DESC NULLS LAST, id DESC)
// NULL BOUNDARY — critical correctness requirement (tech.md)
// ===========================================================================

describe('buildKeysetWhere — sort=rating (avgRating DESC NULLS LAST, id DESC) — NULL BOUNDARY', () => {

  it('[normal] Case A: cursor at last rated item (k != null) — OR[lt, eq+id, null-all]', () => {
    // The cursor is at the last rated camp. The next page must include:
    // 1. Camps with lower avgRating
    // 2. Camps with same avgRating and smaller id
    // 3. All null-avgRating camps (they sort last)
    const cursor: CursorPayload = { k: 3.5, id: 'rated-camp-last' };
    const where = buildKeysetWhere('rating', cursor) as { OR: Array<Record<string, unknown>> };
    expect(where).toHaveProperty('OR');
    expect(where.OR).toHaveLength(3);
    // Branch 0: avgRating < cursor rating
    expect((where.OR[0] as { avgRating: { lt: number } }).avgRating.lt).toBe(3.5);
    // Branch 1: same rating, id lt (tiebreaker DESC)
    const eq = where.OR[1] as { avgRating: number; id: { lt: string } };
    expect(eq.avgRating).toBe(3.5);
    expect(eq.id.lt).toBe('rated-camp-last');
    // Branch 2: avgRating null — all unreviewed camps follow
    expect(where.OR[2]).toEqual({ avgRating: null });
  });

  it('[null/empty] Case B: cursor inside null-avgRating segment (k=null) — AND[null, id-lt]', () => {
    // Once we are in the null segment, stay there; advance by id DESC.
    const cursor: CursorPayload = { k: null, id: 'null-camp-middle' };
    const where = buildKeysetWhere('rating', cursor) as { AND: Array<Record<string, unknown>> };
    expect(where).toHaveProperty('AND');
    // First: stay in null segment
    expect(where.AND[0]).toEqual({ avgRating: null });
    // Second: id < cursor id (DESC direction within null segment)
    const idBranch = where.AND[1] as { id: { lt: string } };
    expect(idBranch.id.lt).toBe('null-camp-middle');
  });

  it('[boundary] cursor at the very first null camp (k=null) produces correct AND shape', () => {
    // The boundary: last rated camp was delivered, now the first null-rating camp is the cursor.
    // This is Case B — same shape.
    const cursor: CursorPayload = { k: null, id: 'first-null-camp' };
    const where = buildKeysetWhere('rating', cursor) as { AND: Array<Record<string, unknown>> };
    expect(where.AND[0]).toEqual({ avgRating: null });
    expect((where.AND[1] as { id: { lt: string } }).id.lt).toBe('first-null-camp');
  });

  it('[boundary] Case A delivers null-avgRating camps on the next page (cross-boundary)', () => {
    // The OR for Case A always includes { avgRating: null } — this is the cross-boundary signal.
    const cursor: CursorPayload = { k: 1.0, id: 'last-rated-camp' }; // lowest rating
    const where = buildKeysetWhere('rating', cursor) as { OR: Array<Record<string, unknown>> };
    const hasNullBranch = where.OR.some(
      (b) => JSON.stringify(b) === JSON.stringify({ avgRating: null })
    );
    expect(hasNullBranch).toBe(true);
  });
});

// ===========================================================================
// orderByFor — correct Prisma orderBy per sort
// ===========================================================================

describe('orderByFor — correct Prisma orderBy array per sort', () => {

  it('[normal] related → [createdAt:desc, id:desc]', () => {
    const ob = orderByFor('related');
    expect(ob).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('[normal] price_asc → [priceLow:asc nulls:first, id:asc]', () => {
    const ob = orderByFor('price_asc');
    expect(ob[0]).toEqual({ priceLow: { sort: 'asc', nulls: 'first' } });
    expect(ob[1]).toEqual({ id: 'asc' });
  });

  it('[normal] price_desc → [priceLow:desc nulls:last, id:desc]', () => {
    const ob = orderByFor('price_desc');
    expect(ob[0]).toEqual({ priceLow: { sort: 'desc', nulls: 'last' } });
    expect(ob[1]).toEqual({ id: 'desc' });
  });

  it('[normal] rating → [avgRating:desc nulls:last, id:desc]', () => {
    const ob = orderByFor('rating');
    expect(ob[0]).toEqual({ avgRating: { sort: 'desc', nulls: 'last' } });
    expect(ob[1]).toEqual({ id: 'desc' });
  });

  it('[normal] all sorts produce an array with 2 elements (sort key + id tiebreaker)', () => {
    for (const sort of VALID_SORTS) {
      expect(orderByFor(sort as CatalogSort)).toHaveLength(2);
    }
  });

  it('[normal] price_asc uses nulls:first (null priceLow / free camps appear first in ASC)', () => {
    // Prove-It: FAILS if nulls:'last' is used instead of 'first'.
    const ob = orderByFor('price_asc');
    expect((ob[0] as { priceLow: { sort: string; nulls: string } }).priceLow.nulls).toBe('first');
  });

  it('[normal] rating uses nulls:last (null avgRating / no-review camps appear last in DESC)', () => {
    // Prove-It: FAILS if nulls:'first' is used instead of 'last'.
    const ob = orderByFor('rating');
    expect((ob[0] as { avgRating: { sort: string; nulls: string } }).avgRating.nulls).toBe('last');
  });
});

// ===========================================================================
// encodeCursorFromItem — convenience wrapper
// ===========================================================================

describe('encodeCursorFromItem — extract sort key from item', () => {

  const baseItem = {
    id: 'item-001',
    createdAt: '2026-06-01T08:00:00.000Z',
    priceLow: 750,
    avgRating: 4.2,
  };

  it('[normal] related sort uses createdAt as k', () => {
    const encoded = encodeCursorFromItem(baseItem, 'related');
    const decoded = decodeCursor(encoded);
    expect(decoded!.k).toBe('2026-06-01T08:00:00.000Z');
    expect(decoded!.id).toBe('item-001');
  });

  it('[normal] price_asc sort uses priceLow as k', () => {
    const decoded = decodeCursor(encodeCursorFromItem(baseItem, 'price_asc'));
    expect(decoded!.k).toBe(750);
  });

  it('[normal] price_desc sort uses priceLow as k', () => {
    const decoded = decodeCursor(encodeCursorFromItem(baseItem, 'price_desc'));
    expect(decoded!.k).toBe(750);
  });

  it('[normal] rating sort uses avgRating as k', () => {
    const decoded = decodeCursor(encodeCursorFromItem(baseItem, 'rating'));
    expect(decoded!.k).toBe(4.2);
  });

  it('[null/empty] free camp (priceLow=null) → k=null for price_asc', () => {
    const freeItem = { ...baseItem, priceLow: null };
    const decoded = decodeCursor(encodeCursorFromItem(freeItem, 'price_asc'));
    expect(decoded!.k).toBeNull();
  });

  it('[null/empty] no-review camp (avgRating=null) → k=null for rating', () => {
    const noReviewItem = { ...baseItem, avgRating: null };
    const decoded = decodeCursor(encodeCursorFromItem(noReviewItem, 'rating'));
    expect(decoded!.k).toBeNull();
  });

  it('[normal] accepts Date object for createdAt (not just string)', () => {
    const itemWithDate = { ...baseItem, createdAt: new Date('2026-06-01T08:00:00.000Z') };
    const decoded = decodeCursor(encodeCursorFromItem(itemWithDate, 'related'));
    expect(decoded!.k).toBe('2026-06-01T08:00:00.000Z');
  });
});

// ===========================================================================
// nextCursor logic — source-inspect route handler
// ===========================================================================

describe('nextCursor logic — GET /api/campsites route handler (source-inspect)', () => {

  it('[normal] route takes PAGE_SIZE+1 rows from DB to detect hasNextPage', () => {
    // Prove-It: FAILS if take:PAGE_SIZE+1 is replaced with take:PAGE_SIZE.
    expect(routeSrc).toContain('PAGE_SIZE + 1');
  });

  it('[normal] route slices to PAGE_SIZE before returning items', () => {
    // Prove-It: FAILS if hasMore slice is removed.
    expect(routeSrc).toContain('slice(0, PAGE_SIZE)');
  });

  it('[normal] route computes nextCursor as null when fewer than PAGE_SIZE rows returned', () => {
    // The logic: hasMore = rows.length > PAGE_SIZE; null returned when !hasMore.
    expect(routeSrc).toContain('hasMore');
    expect(routeSrc).toContain('nextCursor');
  });

  it('[normal] route returns { items, nextCursor } shape (contract per tech.md)', () => {
    expect(routeSrc).toContain('{ items: serialisedItems, nextCursor }');
  });

  it('[sec-1] route calls buildCampSiteWhere on every request (base gate always present)', () => {
    // Prove-It: FAILS if buildCampSiteWhere is removed from the GET handler.
    expect(routeSrc).toContain('buildCampSiteWhere(');
  });

  it('[sec-1] route merges keyset WHERE via AND[] (never replaces the base where)', () => {
    // The keyset predicate must be AND-merged, not a standalone where.
    expect(routeSrc).toContain('AND: [baseWhere, buildKeysetWhere(');
  });

  it('[validation] route validates sort + cursor params with zod before any logic', () => {
    expect(routeSrc).toContain('catalogQuerySchema.safeParse(');
  });

  it('[validation] route returns 400 on invalid cursor (decode failure)', () => {
    expect(routeSrc).toContain("'VALIDATION_ERROR'");
    expect(routeSrc).toContain('Invalid cursor');
  });

  it('[imports] route imports PAGE_SIZE and buildKeysetWhere from catalog-cursor', () => {
    expect(routeSrc).toContain("from '@/lib/catalog-cursor'");
    expect(routeSrc).toContain('buildKeysetWhere');
    expect(routeSrc).toContain('PAGE_SIZE');
  });
});

// ===========================================================================
// catalog-cache take:24 — OT-1=A (source-inspect)
// ===========================================================================

describe('lib/catalog-cache.ts — take:24 (OT-1=A, PERF-3 / CAM-196)', () => {

  it('[normal] getDefaultCatalog uses take:24 (OT-1=A unified page size)', () => {
    // Prove-It: FAILS if take is changed back to 40.
    expect(catalogCacheSrc).toMatch(/take:\s*24/);
  });

  it('[normal] catalog-cache no longer uses take:40 (old value removed)', () => {
    // Prove-It: FAILS if take:40 is still present.
    expect(catalogCacheSrc).not.toMatch(/take:\s*40/);
  });

  it('[normal] getDefaultCatalog still has isPublished:true, isActive:true, deletedAt:null', () => {
    expect(catalogCacheSrc).toContain('isPublished: true');
    expect(catalogCacheSrc).toContain('isActive: true');
    expect(catalogCacheSrc).toContain('deletedAt: null');
  });

  it('[normal] getDefaultCatalog still uses CATALOG_TAG (cache invalidation intact)', () => {
    expect(catalogCacheSrc).toContain('[CATALOG_TAG]');
  });
});

// ===========================================================================
// app/page.tsx — initialCursor plumbing (source-inspect)
// ===========================================================================

describe('CatalogResults.tsx — initialCursor computation and prop (PERF-3 / CAM-196 + LOAD-1 / CAM-197)', () => {
  // LOAD-1 (CAM-197): initialCursor logic moved from page.tsx → CatalogResults.tsx.

  it('[normal] CatalogResults.tsx imports encodeCursorFromItem from catalog-cursor', () => {
    // Prove-It: FAILS if encodeCursorFromItem import is removed.
    expect(catalogResultsSrc).toContain('encodeCursorFromItem');
    expect(catalogResultsSrc).toContain("from \"@/lib/catalog-cursor\"");
  });

  it('[normal] CatalogResults.tsx imports PAGE_SIZE from catalog-cursor', () => {
    expect(catalogResultsSrc).toContain('PAGE_SIZE');
  });

  it('[normal] CatalogResults.tsx computes initialCursor', () => {
    expect(catalogResultsSrc).toContain('initialCursor');
  });

  it('[normal] CatalogResults.tsx passes initialCursor to InfiniteScrollGrid', () => {
    // The prop must be threaded through so the client can request page 2.
    expect(catalogResultsSrc).toContain('initialCursor={initialCursor}');
  });

  it('[normal] CatalogResults.tsx uses PAGE_SIZE (not hardcoded 24 or 40) for the take param', () => {
    // Prove-It: FAILS if take is hardcoded instead of using the constant.
    expect(catalogResultsSrc).toContain('take: PAGE_SIZE');
    expect(catalogResultsSrc).not.toContain('take: 40');
  });

  it('[normal] CatalogResults.tsx still renders the first page in SSR (InfiniteScrollGrid present in JSX)', () => {
    // The SSR render must not be broken — InfiniteScrollGrid still renders the SSR-seeded cards.
    expect(catalogResultsSrc).toContain('InfiniteScrollGrid');
  });

  it('[normal] CatalogResults.tsx computes initialCursor from the last item when campSites.length === PAGE_SIZE', () => {
    // The length guard ensures we only emit a cursor when there is a next page.
    expect(catalogResultsSrc).toContain('campSites.length === PAGE_SIZE');
  });

  it('[normal] CatalogResults.tsx sets initialCursor to null when campSites is empty or < PAGE_SIZE', () => {
    // The null case: fewer results than a full page → no next cursor.
    expect(catalogResultsSrc).toContain(': null');
  });
});

// ===========================================================================
// CampgroundGrid — optional initialCursor prop (source-inspect)
// ===========================================================================

describe('components/CampgroundGrid.tsx — optional initialCursor prop', () => {

  it('[normal] CampgroundGridProps has the optional initialCursor field', () => {
    // Prove-It: FAILS if initialCursor is removed from the props interface.
    expect(gridSrc).toContain('initialCursor');
  });

  it('[normal] initialCursor is typed as optional (string | null)', () => {
    // Must be optional — CampgroundGrid is also used in other contexts (operator dashboard etc).
    expect(gridSrc).toContain('string | null');
  });
});
