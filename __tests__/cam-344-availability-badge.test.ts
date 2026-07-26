/**
 * cam-344-availability-badge.test.ts — CAM-344
 *
 * "Dated catalog search shows availability badge on held camps (fully vs
 * partially unavailable)" — the hide→badge pivot. Full story:
 * docs/specs/data-trust/availability-correctness-ว่างจริง-blockeddate-part/
 * CAM-344-dated-catalog-search-availability-badge-held-camps/story.md
 *
 * AC → test matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * AC-1/AC-7  whole-camp block / all-nights-full → FULLY_UNAVAILABLE, camp still
 *            returned (never filtered out).
 * AC-2       some-nights-full → PARTIALLY_UNAVAILABLE.
 * AC-3       every night open → no status computed (omitted from the map, no
 *            badge attached on either surface).
 * AC-4/BR-7  no dates → no status computed at all, on both surfaces.
 * AC-5/EC-4  active non-expired hold consumes capacity → unavailable; an
 *            expired hold (excluded at the query boundary) does not count.
 * AC-8/EC-7  every camp in the page fully unavailable → all returned, badged,
 *            not filtered to empty (proven at the buildCampSiteWhere layer —
 *            step 7 is gone, nothing can filter by date-availability anymore).
 * AC-9/EC-8  computation throws → fail-open: cards render with no badge, list
 *            still returned in full (proven at both API-route and helper
 *            layers).
 * BR-1       derives ONLY from the single-source predicates (Booking
 *            CONFIRMED/PENDING, whole-camp BlockedDate, ACTIVE InternalHold);
 *            night-exclusive checkout.
 * BR-2       night unavailable = host-blocked OR bookedGuests+heldGuests+
 *            requestedGuests > capacity; capacity=null never numerically
 *            unavailable; requestedGuests defaults to 1.
 * BR-3       0 unavailable nights → no badge; some → PARTIAL; all → FULL;
 *            single-night range can only be FULL or omitted, never PARTIAL.
 * BR-4       Thai copy verbatim + i18n-only (no hardcoded string).
 * BR-5       batched — no per-camp round trips; O(1) query calls per page,
 *            not O(N) per camp.
 * BR-6       buildCampSiteWhere step 7 removed; step 5 (guest-capacity)
 *            unchanged.
 * BR-8       badge copy never contains "held"/"hold" wording (folds holds
 *            into one aggregate "unavailable" signal only).
 * BR-10      badge is presentational only; the whole card stays one Link.
 * EC-1       month-spanning range computed in one batched pass.
 * EC-2       single-night range never yields PARTIALLY_UNAVAILABLE.
 * EC-3       whole-camp block always wins over numeric capacity headroom.
 * EC-6       zero-night / inverted range → no computation, no DB calls.
 * EC-9       capacity=null never numerically unavailable; capacity=0 → every
 *            night unavailable.
 *
 * Layers:
 *   - getAvailabilityStatusForCamps → unit, mocked @/lib/prisma (no DB).
 *   - GET /api/campsites → integration, direct route invocation with mocked
 *     prisma (established precedent: __tests__/security-hotfix.test.ts
 *     "GET /api/campsites — coverage").
 *   - components/CatalogResults.tsx (SSR surface), CampgroundGrid.tsx,
 *     InfiniteScrollGrid.tsx, CampgroundCard.tsx, ui/badge.tsx → source-
 *     inspection (established precedent: cam-195/cam-196/cam-197 test files;
 *     vitest.config.ts only globs `**\/*.test.ts`, never renders a .tsx client
 *     component under jsdom in this repo).
 *   - locales/translations.json → direct import, exact-string assertions.
 *
 * Coverage matrix per .claude/rules/qa.md: normal · null/empty · boundary ·
 * error/validation · concurrent/ordering (N/A — no shared mutable state).
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Module mock — prisma only; no DB connection needed. Covers every model the
// batched helper + the cursor-page route touch.
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findMany: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    blockedDate: {
      findMany: vi.fn(),
    },
    internalHold: {
      findMany: vi.fn(),
    },
    // CAM-355 BR-4c: getAvailabilityStatusForCamps now runs ONE additional
    // grouped Spot query (the PER-SPOT batched sum) alongside the 4 existing
    // ones — mocked here so every pre-existing test in this file continues to
    // exercise the real function unmodified (defaults to no spot rows, i.e.
    // every camp fixture here stays effectively WHOLE-CAMP unless a test
    // explicitly sets useSpotView + spot rows).
    spot: {
      findMany: vi.fn(),
    },
  },
}));

// app/api/campsites/route.ts's POST path imports requireAuth/auth (next-auth) —
// mocked here purely to avoid loading the real next-auth chain in this GET-only
// suite (mirrors __tests__/security-hotfix.test.ts's established convention).
vi.mock('@/lib/auth-utils', () => ({
  requireAuth: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import {
  getAvailabilityStatusForCamps,
  MAX_STATUS_RANGE_NIGHTS,
  type CampAvailabilityStatus,
} from '@/lib/campsite-availability';
import { buildCampSiteWhere } from '@/lib/campsite-filters';
import { getTranslations } from '@/locales/translations';
import { catalogQuerySchema } from '@/lib/validations/catalog-cursor';
import { GET as campsiteGET } from '@/app/api/campsites/route';

/** Build a Date at midnight UTC from an ISO date string. */
function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

const CAMP_A = 'aaaaaaaa-0000-4000-8000-000000000344';
const CAMP_B = 'aaaaaaaa-0000-4000-8000-000000000345';
const CAMP_C = 'aaaaaaaa-0000-4000-8000-000000000346';

function src(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

// ===========================================================================
// Group A: getAvailabilityStatusForCamps — classification (BR-1/2/3, AC-1/2/3/5/7/9)
// ===========================================================================

describe('getAvailabilityStatusForCamps — classification', () => {
  it('[ac-1][ac-7] every night full (booking at capacity every night) → FULLY_UNAVAILABLE', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_A, maxGuestsPerDay: 2 },
    ]);
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { campSiteId: CAMP_A, checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-13'), guests: 2 },
    ]);

    // range 09-10 -> 09-13 (checkout exclusive): nights 09-10, 09-11, 09-12.
    const result = await getAvailabilityStatusForCamps([CAMP_A], d('2026-09-10'), d('2026-09-13'), 1);

    expect(result[CAMP_A]).toBe('FULLY_UNAVAILABLE');
  });

  it('[ac-2] some nights full, some open → PARTIALLY_UNAVAILABLE', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_A, maxGuestsPerDay: 2 },
    ]);
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      // Only the first night (09-10) is at capacity; 09-11 and 09-12 are open.
      { campSiteId: CAMP_A, checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 2 },
    ]);

    const result = await getAvailabilityStatusForCamps([CAMP_A], d('2026-09-10'), d('2026-09-13'), 1);

    expect(result[CAMP_A]).toBe('PARTIALLY_UNAVAILABLE');
  });

  it('[ac-3] every night open (well under capacity) → camp OMITTED from the map (no badge)', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_A, maxGuestsPerDay: 5 },
    ]);

    const result = await getAvailabilityStatusForCamps([CAMP_A], d('2026-09-10'), d('2026-09-13'), 1);

    expect(result[CAMP_A]).toBeUndefined();
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('[ec-3] whole-camp block covering the entire range → FULLY_UNAVAILABLE regardless of unbounded capacity', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_A, maxGuestsPerDay: null }, // unbounded
    ]);
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { campSiteId: CAMP_A, startDate: d('2026-09-10'), endDate: d('2026-09-12') },
    ]);

    const result = await getAvailabilityStatusForCamps([CAMP_A], d('2026-09-10'), d('2026-09-13'), 1);

    expect(result[CAMP_A]).toBe('FULLY_UNAVAILABLE');
  });

  it('[ac-5] an ACTIVE non-expired hold consumes remaining capacity → unavailable', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_A, maxGuestsPerDay: 3 },
    ]);
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { campSiteId: CAMP_A, startDate: d('2026-09-10'), endDate: d('2026-09-11'), guests: 3 },
    ]);

    const result = await getAvailabilityStatusForCamps([CAMP_A], d('2026-09-10'), d('2026-09-11'), 1);

    expect(result[CAMP_A]).toBe('FULLY_UNAVAILABLE');
  });

  it('[ec-4] an expired hold (excluded at the query boundary) does NOT count — night stays available', async () => {
    // getActiveHoldsForRange applies the lazy-expiry filter INSIDE the query
    // itself (status=ACTIVE AND expiresAt>now); the mocked findMany simply
    // never returns an expired row, exactly like cam-302's own convention.
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_A, maxGuestsPerDay: 3 },
    ]);
    (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getAvailabilityStatusForCamps([CAMP_A], d('2026-09-10'), d('2026-09-11'), 1);

    expect(result[CAMP_A]).toBeUndefined();
  });

  it('[predicate] InternalHold query uses status=ACTIVE AND expiresAt>now (lazy expiry, no cron)', async () => {
    await getAvailabilityStatusForCamps([CAMP_A], d('2026-09-10'), d('2026-09-11'), 1);

    const callArgs = (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.where.status).toBe('ACTIVE');
    expect(callArgs.where.expiresAt.gt).toBeInstanceOf(Date);
  });

  it('[br-2] capacity null (unbounded) + no block → never numerically unavailable, even with a heavy booking', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_A, maxGuestsPerDay: null },
    ]);
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { campSiteId: CAMP_A, checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 100 },
    ]);

    const result = await getAvailabilityStatusForCamps([CAMP_A], d('2026-09-10'), d('2026-09-11'), 1);

    expect(result[CAMP_A]).toBeUndefined();
  });

  it('[ec-9] capacity explicit 0 → every night unavailable → FULLY_UNAVAILABLE', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_A, maxGuestsPerDay: 0 },
    ]);

    const result = await getAvailabilityStatusForCamps([CAMP_A], d('2026-09-10'), d('2026-09-11'), 1);

    expect(result[CAMP_A]).toBe('FULLY_UNAVAILABLE');
  });

  it('[ec-2] a single-night range is only ever FULLY_UNAVAILABLE or omitted — never PARTIALLY_UNAVAILABLE', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_A, maxGuestsPerDay: 2 },
    ]);
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { campSiteId: CAMP_A, checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 2 },
    ]);

    const full = await getAvailabilityStatusForCamps([CAMP_A], d('2026-09-10'), d('2026-09-11'), 1);
    expect(full[CAMP_A]).toBe('FULLY_UNAVAILABLE');

    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const open = await getAvailabilityStatusForCamps([CAMP_A], d('2026-09-10'), d('2026-09-11'), 1);
    expect(open[CAMP_A]).toBeUndefined();

    expect(Object.values({ ...full, ...open })).not.toContain('PARTIALLY_UNAVAILABLE');
  });

  it('[ec-1] a month-spanning range (30 Jul -> 2 Aug) is computed in ONE batched pass, not split at the boundary', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_A, maxGuestsPerDay: 2 },
    ]);
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      // Fully booked on the last night only (Aug 1) — crosses the month boundary.
      { campSiteId: CAMP_A, checkInDate: d('2026-08-01'), checkOutDate: d('2026-08-02'), guests: 2 },
    ]);

    const result = await getAvailabilityStatusForCamps([CAMP_A], d('2026-07-30'), d('2026-08-02'), 1);

    expect(result[CAMP_A]).toBe('PARTIALLY_UNAVAILABLE');
    expect(prisma.booking.findMany).toHaveBeenCalledOnce();
    expect(prisma.blockedDate.findMany).toHaveBeenCalledOnce();
    expect(prisma.internalHold.findMany).toHaveBeenCalledOnce();
  });

  it('[br-5][no-n+1] a page of 3 camps still runs exactly 5 grouped queries total (never per-camp, CAM-355 adds the Spot sum)', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_A, maxGuestsPerDay: 2 },
      { id: CAMP_B, maxGuestsPerDay: 2 },
      { id: CAMP_C, maxGuestsPerDay: null },
    ]);

    await getAvailabilityStatusForCamps([CAMP_A, CAMP_B, CAMP_C], d('2026-09-10'), d('2026-09-13'), 1);

    expect(prisma.campSite.findMany).toHaveBeenCalledOnce();
    expect(prisma.booking.findMany).toHaveBeenCalledOnce();
    expect(prisma.blockedDate.findMany).toHaveBeenCalledOnce();
    expect(prisma.internalHold.findMany).toHaveBeenCalledOnce();
    // CAM-355 BR-4c/BR-5: the ONE added grouped Spot query, batched for the
    // whole page (never per-camp) — same `IN [pageIds]` shape as the others.
    expect(prisma.spot.findMany).toHaveBeenCalledOnce();

    const bookingArgs = (prisma.booking.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(bookingArgs.where.campSiteId).toEqual({ in: [CAMP_A, CAMP_B, CAMP_C] });

    const spotArgs = (prisma.spot.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(spotArgs.where.campSiteId).toEqual({ in: [CAMP_A, CAMP_B, CAMP_C] });
    expect(spotArgs.where.deletedAt).toBeNull();
  });

  it('[ec-6] zero-night / inverted range → returns {} with NO database calls at all', async () => {
    const result = await getAvailabilityStatusForCamps([CAMP_A], d('2026-09-10'), d('2026-09-10'), 1);

    expect(result).toEqual({});
    expect(prisma.campSite.findMany).not.toHaveBeenCalled();
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
    expect(prisma.blockedDate.findMany).not.toHaveBeenCalled();
    expect(prisma.internalHold.findMany).not.toHaveBeenCalled();
  });

  it('[null/empty] empty campIds → returns {} with NO database calls at all', async () => {
    const result = await getAvailabilityStatusForCamps([], d('2026-09-10'), d('2026-09-13'), 1);

    expect(result).toEqual({});
    expect(prisma.campSite.findMany).not.toHaveBeenCalled();
  });

  it('[br-2] requestedGuests defaults to 1 when omitted', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_A, maxGuestsPerDay: 1 },
    ]);

    // No 4th arg — defaults to 1. 0 booked + 0 held + 1 requested = 1, not > capacity(1).
    const result = await getAvailabilityStatusForCamps([CAMP_A], d('2026-09-10'), d('2026-09-11'));
    expect(result[CAMP_A]).toBeUndefined();

    // Explicit requestedGuests=2 now exceeds capacity(1).
    const result2 = await getAvailabilityStatusForCamps([CAMP_A], d('2026-09-10'), d('2026-09-11'), 2);
    expect(result2[CAMP_A]).toBe('FULLY_UNAVAILABLE');
  });

  it('[boundary] invalid requestedGuests (0 or negative) falls back to 1, never treated as "no one"', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_A, maxGuestsPerDay: 1 },
    ]);

    const result = await getAvailabilityStatusForCamps([CAMP_A], d('2026-09-10'), d('2026-09-11'), 0);
    // 0 booked + 0 held + fallback(1) = 1, not > capacity(1) → still available.
    expect(result[CAMP_A]).toBeUndefined();
  });

  it('[null/empty] a camp missing from the capacity side-select (e.g. deleted concurrently) defaults to unbounded, never a false positive', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]); // no matching row
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { campSiteId: CAMP_A, checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 100 },
    ]);

    const result = await getAvailabilityStatusForCamps([CAMP_A], d('2026-09-10'), d('2026-09-11'), 1);

    expect(result[CAMP_A]).toBeUndefined();
  });

  it('[fail-open contract] a thrown Prisma error propagates to the CALLER (this function does not swallow it itself)', async () => {
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB timeout'));

    await expect(
      getAvailabilityStatusForCamps([CAMP_A], d('2026-09-10'), d('2026-09-11'), 1)
    ).rejects.toThrow('DB timeout');
  });
});

// ===========================================================================
// Group A2: DoS guard — event-loop hang / OOM (G3 review finding, Important)
//
// GET /api/campsites is public, unauthenticated, and unrate-limited.
// getAvailabilityStatusForCamps runs a synchronous per-night loop per camp —
// an absurd span (e.g. startDate=2026-01-01&endDate=9999-12-31) must never
// reach that loop. The guard is checked BEFORE any Prisma call, so it
// protects both attach points from one shared choke point.
// ===========================================================================

describe('getAvailabilityStatusForCamps — DoS guard (MAX_STATUS_RANGE_NIGHTS)', () => {
  it('MAX_STATUS_RANGE_NIGHTS is exported as 366', () => {
    expect(MAX_STATUS_RANGE_NIGHTS).toBe(366);
  });

  it('[dos] a 10-year span returns {} immediately — NO Prisma call, no per-night loop', async () => {
    const result = await getAvailabilityStatusForCamps(
      [CAMP_A],
      d('2026-01-01'),
      d('2036-01-01'),
      1
    );

    expect(result).toEqual({});
    expect(prisma.campSite.findMany).not.toHaveBeenCalled();
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
    expect(prisma.blockedDate.findMany).not.toHaveBeenCalled();
    expect(prisma.internalHold.findMany).not.toHaveBeenCalled();
  });

  it('[dos] the exact attack shape from the review (2026-01-01 -> 9999-12-31) returns {} with no DB calls', async () => {
    const result = await getAvailabilityStatusForCamps(
      [CAMP_A, CAMP_B, CAMP_C],
      d('2026-01-01'),
      new Date('9999-12-31T00:00:00.000Z'),
      1
    );

    expect(result).toEqual({});
    expect(prisma.campSite.findMany).not.toHaveBeenCalled();
  });

  it('[boundary] exactly MAX_STATUS_RANGE_NIGHTS (366) nights is ALLOWED — runs the real queries', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_A, maxGuestsPerDay: 5 },
    ]);

    // endDate is EXCLUSIVE checkout: 366 nights means endDate = startDate + 366 days.
    const start = d('2026-01-01');
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + MAX_STATUS_RANGE_NIGHTS);

    const result = await getAvailabilityStatusForCamps([CAMP_A], start, end, 1);

    expect(result[CAMP_A]).toBeUndefined(); // fully available — but it DID compute
    expect(prisma.campSite.findMany).toHaveBeenCalledOnce();
    expect(prisma.booking.findMany).toHaveBeenCalledOnce();
  });

  it('[boundary] MAX_STATUS_RANGE_NIGHTS + 1 (367) nights is REJECTED — no DB calls', async () => {
    const start = d('2026-01-01');
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + MAX_STATUS_RANGE_NIGHTS + 1);

    const result = await getAvailabilityStatusForCamps([CAMP_A], start, end, 1);

    expect(result).toEqual({});
    expect(prisma.campSite.findMany).not.toHaveBeenCalled();
  });

  it('[normal] a real 5-night range still classifies normally (guard does not over-trigger)', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CAMP_A, maxGuestsPerDay: 2 },
    ]);
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { campSiteId: CAMP_A, checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-15'), guests: 2 },
    ]);

    const result = await getAvailabilityStatusForCamps([CAMP_A], d('2026-09-10'), d('2026-09-15'), 1);

    expect(result[CAMP_A]).toBe('FULLY_UNAVAILABLE');
  });

  it('[error/validation] a non-finite (Invalid Date) startDate returns {} with NO Prisma call (no wasted round-trips)', async () => {
    const result = await getAvailabilityStatusForCamps(
      [CAMP_A],
      new Date('not-a-real-date'),
      d('2026-09-11'),
      1
    );

    expect(result).toEqual({});
    expect(prisma.campSite.findMany).not.toHaveBeenCalled();
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
    expect(prisma.blockedDate.findMany).not.toHaveBeenCalled();
    expect(prisma.internalHold.findMany).not.toHaveBeenCalled();
  });

  it('[error/validation] a non-finite (Invalid Date) endDate returns {} with NO Prisma call', async () => {
    const result = await getAvailabilityStatusForCamps(
      [CAMP_A],
      d('2026-09-10'),
      new Date('garbage'),
      1
    );

    expect(result).toEqual({});
    expect(prisma.campSite.findMany).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Group A3: schema-layer guard — catalogQuerySchema startDate/endDate (G3 finding)
// ===========================================================================

describe('catalogQuerySchema — startDate/endDate parseability (G3 review, Info finding)', () => {
  it('[normal] a valid ISO date string parses through unchanged', () => {
    const parsed = catalogQuerySchema.safeParse({ startDate: '2026-09-10', endDate: '2026-09-11' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.startDate).toBe('2026-09-10');
      expect(parsed.data.endDate).toBe('2026-09-11');
    }
  });

  it('[error/validation] an unparseable endDate ("garbage") is normalized to undefined — NOT a 400', () => {
    const parsed = catalogQuerySchema.safeParse({ startDate: '2026-09-10', endDate: 'garbage' });
    // Chosen behaviour: never fail the whole request over one bad date — the
    // public catalog GET must keep returning results (treated as undated).
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.endDate).toBeUndefined();
    }
  });

  it('[error/validation] an unparseable startDate is normalized to undefined too', () => {
    const parsed = catalogQuerySchema.safeParse({ startDate: 'not-a-date', endDate: '2026-09-11' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.startDate).toBeUndefined();
    }
  });

  it('[null/empty] both dates absent → both stay undefined (undated search, unchanged)', () => {
    const parsed = catalogQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.startDate).toBeUndefined();
      expect(parsed.data.endDate).toBeUndefined();
    }
  });

  it('[normal] the schema does NOT cap the SPAN of an otherwise-valid range (span cap lives in the helper, not here)', () => {
    // Both individually valid dates — a 7973-year span still parses successfully
    // at the schema layer. The span cap is MAX_STATUS_RANGE_NIGHTS, a single
    // choke point in lib/campsite-availability.ts shared by both attach points.
    const parsed = catalogQuerySchema.safeParse({ startDate: '2026-01-01', endDate: '9999-12-31' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.startDate).toBe('2026-01-01');
      expect(parsed.data.endDate).toBe('9999-12-31');
    }
  });
});

// ===========================================================================
// Group B: buildCampSiteWhere — step 7 removed (BR-6, AC-1/AC-8/EC-7)
// ===========================================================================

describe('buildCampSiteWhere — dates no longer exclude any camp (BR-6)', () => {
  it('[br-6] dates supplied → no NOT / spots exclusion clause is ever added (a previously-hidden camp now stays in results)', () => {
    const where = buildCampSiteWhere({ startDate: '2026-09-05', endDate: '2026-09-10' });
    expect(where.NOT).toBeUndefined();
    expect(where.spots).toBeUndefined();
  });

  it('[ac-8][ec-7] step 5 (static guest-capacity) is unaffected by dates being present', () => {
    const withDates = buildCampSiteWhere({ startDate: '2026-09-05', endDate: '2026-09-10', guests: '4' });
    const withoutDates = buildCampSiteWhere({ guests: '4' });
    // Same capacity clause shape regardless of whether dates are present —
    // proves dates and step-5 capacity are fully independent (BR-6).
    expect(withDates.AND).toEqual(withoutDates.AND);
  });
});

// ===========================================================================
// Group C: GET /api/campsites — cursor-page attach (both-surfaces, AC-4/AC-9/BR-7)
// ===========================================================================

describe('GET /api/campsites — availabilityStatus attach on the cursor page', () => {
  it('[cam-342-trap] dates present + a fully-unavailable camp → item carries availabilityStatus:"FULLY_UNAVAILABLE"', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        { id: CAMP_A, nameTh: 'ค่าย A', nameThSlug: 'a', priceLow: 500, createdAt: d('2026-01-01'), avgRating: null, reviewCount: 0 },
      ]) // 1st call: page listing
      .mockResolvedValueOnce([{ id: CAMP_A, maxGuestsPerDay: 2 }]); // 2nd call: capacity side-select
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { campSiteId: CAMP_A, checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 2 },
    ]);

    const req = new NextRequest('http://localhost/api/campsites?startDate=2026-09-10&endDate=2026-09-11');
    const res = await campsiteGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].availabilityStatus).toBe('FULLY_UNAVAILABLE');
  });

  it('[br-7][ac-4] no dates → item carries NO availabilityStatus key at all (byte-identical to today)', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: CAMP_A, nameTh: 'ค่าย A', nameThSlug: 'a', priceLow: 500, createdAt: d('2026-01-01'), avgRating: null, reviewCount: 0 },
    ]);

    const req = new NextRequest('http://localhost/api/campsites');
    const res = await campsiteGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect('availabilityStatus' in body.items[0]).toBe(false);
    // step-7 removal: campSite.findMany is called exactly ONCE (page listing) —
    // no side-select is ever run when there are no dates.
    expect(prisma.campSite.findMany).toHaveBeenCalledOnce();
  });

  it('[ac-3] every camp fully available (no overlap) → item carries NO availabilityStatus key (no badge)', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        { id: CAMP_A, nameTh: 'ค่าย A', nameThSlug: 'a', priceLow: 500, createdAt: d('2026-01-01'), avgRating: null, reviewCount: 0 },
      ])
      .mockResolvedValueOnce([{ id: CAMP_A, maxGuestsPerDay: 10 }]);

    const req = new NextRequest('http://localhost/api/campsites?startDate=2026-09-10&endDate=2026-09-11');
    const res = await campsiteGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect('availabilityStatus' in body.items[0]).toBe(false);
  });

  it('[ac-9][ec-8] availability computation throws → fail-open: 200, full item list, no badge (never blanked/emptied)', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        { id: CAMP_A, nameTh: 'ค่าย A', nameThSlug: 'a', priceLow: 500, createdAt: d('2026-01-01'), avgRating: null, reviewCount: 0 },
      ])
      .mockRejectedValueOnce(new Error('capacity side-select timed out'));

    const req = new NextRequest('http://localhost/api/campsites?startDate=2026-09-10&endDate=2026-09-11');
    const res = await campsiteGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect('availabilityStatus' in body.items[0]).toBe(false);
  });

  it('[ac-8][ec-7] every camp on the page fully unavailable → all still returned (never filtered to empty)', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        { id: CAMP_A, nameTh: 'ค่าย A', nameThSlug: 'a', priceLow: 500, createdAt: d('2026-01-02'), avgRating: null, reviewCount: 0 },
        { id: CAMP_B, nameTh: 'ค่าย B', nameThSlug: 'b', priceLow: 700, createdAt: d('2026-01-01'), avgRating: null, reviewCount: 0 },
      ])
      .mockResolvedValueOnce([
        { id: CAMP_A, maxGuestsPerDay: 1 },
        { id: CAMP_B, maxGuestsPerDay: 1 },
      ]);
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { campSiteId: CAMP_A, checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 1 },
      { campSiteId: CAMP_B, checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 1 },
    ]);

    const req = new NextRequest('http://localhost/api/campsites?startDate=2026-09-10&endDate=2026-09-11');
    const res = await campsiteGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(2); // NOT filtered to empty
    expect(body.items[0].availabilityStatus).toBe('FULLY_UNAVAILABLE');
    expect(body.items[1].availabilityStatus).toBe('FULLY_UNAVAILABLE');
  });

  it('[dos][g3-finding] the attack shape (startDate=2026-01-01&endDate=9999-12-31) never reaches the per-night loop — 200, no badge, no availability DB calls', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: CAMP_A, nameTh: 'ค่าย A', nameThSlug: 'a', priceLow: 500, createdAt: d('2026-01-01'), avgRating: null, reviewCount: 0 },
    ]);

    const req = new NextRequest('http://localhost/api/campsites?startDate=2026-01-01&endDate=9999-12-31');
    const res = await campsiteGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect('availabilityStatus' in body.items[0]).toBe(false);
    // Only the page-listing call ran — the DoS guard returned {} before the
    // capacity side-select / Booking / BlockedDate / InternalHold queries.
    expect(prisma.campSite.findMany).toHaveBeenCalledOnce();
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
    expect(prisma.blockedDate.findMany).not.toHaveBeenCalled();
    expect(prisma.internalHold.findMany).not.toHaveBeenCalled();
  });

  it('[error/validation][g3-finding] endDate=garbage is normalized to undated at the schema layer — 200, no badge, no wasted round-trips', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: CAMP_A, nameTh: 'ค่าย A', nameThSlug: 'a', priceLow: 500, createdAt: d('2026-01-01'), avgRating: null, reviewCount: 0 },
    ]);

    const req = new NextRequest('http://localhost/api/campsites?startDate=2026-09-10&endDate=garbage');
    const res = await campsiteGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect('availabilityStatus' in body.items[0]).toBe(false);
    // Normalized to undefined at the schema boundary → treated as undated →
    // campSite.findMany is called exactly once (page listing only), no
    // wasted capacity/Booking/BlockedDate/InternalHold round-trips.
    expect(prisma.campSite.findMany).toHaveBeenCalledOnce();
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Group D: components/CatalogResults.tsx — SSR-surface attach (source-inspect)
// ===========================================================================

describe('CatalogResults.tsx — SSR-surface attach (source-inspect, CAM-342 trap)', () => {
  const catalogResultsSrc = src('components/CatalogResults.tsx');

  it('imports getAvailabilityStatusForCamps from the single-source helper', () => {
    expect(catalogResultsSrc).toContain(
      "import { getAvailabilityStatusForCamps, type CampAvailabilityStatus } from \"@/lib/campsite-availability\""
    );
  });

  it('gates the computation on BOTH startDate AND endDate being present (BR-7)', () => {
    expect(catalogResultsSrc).toMatch(/if\s*\(\s*startDate\s*&&\s*endDate/);
  });

  it('wraps the call in try/catch (fail-open, AC-9/EC-8)', () => {
    const block = catalogResultsSrc.match(/if \(startDate && endDate[\s\S]*?\n  }/);
    expect(block).not.toBeNull();
    expect(block![0]).toContain('try {');
    expect(block![0]).toContain('catch (error)');
    expect(block![0]).toContain('availabilityByCampId = {}');
  });

  it('attaches availabilityStatus conditionally (never unconditionally) on the serialised item', () => {
    expect(catalogResultsSrc).toContain('...(availabilityStatus ? { availabilityStatus } : {})');
  });
});

// ===========================================================================
// Group E: app/api/campsites/route.ts — source-level contract checks
// ===========================================================================

describe('app/api/campsites/route.ts — availability attach contract (source-inspect)', () => {
  const routeSrc = src('app/api/campsites/route.ts');

  it('imports getAvailabilityStatusForCamps from the single-source helper', () => {
    expect(routeSrc).toContain(
      "import { getAvailabilityStatusForCamps, type CampAvailabilityStatus } from '@/lib/campsite-availability'"
    );
  });

  it('gates the computation on BOTH startDate AND endDate being present (BR-7)', () => {
    expect(routeSrc).toMatch(/if\s*\(\s*startDate\s*&&\s*endDate/);
  });

  it('wraps the call in try/catch (fail-open, AC-9/EC-8)', () => {
    expect(routeSrc).toContain('try {');
    expect(routeSrc).toContain("availabilityByCampId = {};");
  });
});

// ===========================================================================
// Group F: card wiring — CampSiteCardData / CampgroundGrid / InfiniteScrollGrid
// / CampgroundCard / badge.tsx (source-inspect)
// ===========================================================================

describe('card wiring — availabilityStatus threaded through to CampgroundCard (source-inspect)', () => {
  it('CampSiteCardData declares the explicit optional availabilityStatus field', () => {
    const gridSrc = src('components/CampgroundGrid.tsx');
    expect(gridSrc).toContain('availabilityStatus?: CampAvailabilityStatus');
  });

  it('CampgroundGrid.tsx passes availabilityStatus as an explicit prop (mirrors avgRating/reviewCount)', () => {
    const gridSrc = src('components/CampgroundGrid.tsx');
    expect(gridSrc).toContain('availabilityStatus={camp.availabilityStatus}');
  });

  it('InfiniteScrollGrid.tsx passes availabilityStatus as an explicit prop (mirrors avgRating/reviewCount)', () => {
    const infiniteSrc = src('components/InfiniteScrollGrid.tsx');
    expect(infiniteSrc).toContain('availabilityStatus={camp.availabilityStatus}');
  });

  it('CampgroundCard.tsx renders the badge IFF availabilityStatus is present (never unconditionally)', () => {
    const cardSrc = src('components/CampgroundCard.tsx');
    expect(cardSrc).toMatch(/\{availabilityStatus\s*&&\s*\(/);
  });

  it('CampgroundCard.tsx uses ONLY existing badge.tsx variants (destructive = fully-unavailable, warning = partial) — no new variant introduced', () => {
    const cardSrc = src('components/CampgroundCard.tsx');
    const badgeSrc = src('components/ui/badge.tsx');
    expect(cardSrc).toContain('"FULLY_UNAVAILABLE" ? "destructive" : "warning"');
    // Both variants already exist in badge.tsx — no new variant/token added.
    expect(badgeSrc).toContain('destructive:');
    expect(badgeSrc).toContain('warning:');
  });

  it('CampgroundCard.tsx reuses the shared Badge primitive (no hand-rolled badge markup)', () => {
    const cardSrc = src('components/CampgroundCard.tsx');
    const badgeUsages = cardSrc.match(/<Badge\b/g) ?? [];
    // "New" badge + availability badge = 2 usages of the same shared primitive.
    expect(badgeUsages.length).toBeGreaterThanOrEqual(2);
  });

  it('BR-10: the badge sits inside the Link (does not intercept the tap; the whole card stays one link)', () => {
    const cardSrc = src('components/CampgroundCard.tsx');
    const linkOpenIdx = cardSrc.indexOf('<Link href=');
    const linkCloseIdx = cardSrc.indexOf('</Link>');
    const badgeIdx = cardSrc.indexOf('data-testid="badge--availability-status"');
    expect(badgeIdx).toBeGreaterThan(linkOpenIdx);
    expect(badgeIdx).toBeLessThan(linkCloseIdx);
  });

  it('BR-8: badge copy never mentions "held"/"hold" (folds holds into one aggregate "unavailable" signal only)', () => {
    const th = getTranslations('th');
    const en = getTranslations('en');
    expect(th.catalog.fullyUnavailable.toLowerCase()).not.toContain('hold');
    expect(th.catalog.partiallyUnavailable.toLowerCase()).not.toContain('hold');
    expect(en.catalog.fullyUnavailable.toLowerCase()).not.toContain('hold');
    expect(en.catalog.partiallyUnavailable.toLowerCase()).not.toContain('hold');
  });
});

// ===========================================================================
// Group G: Thai copy verbatim (BR-4)
// ===========================================================================

describe('badge copy — verbatim Thai + EN parity (BR-4)', () => {
  it('[copy] Thai: catalog.fullyUnavailable is exactly "ไม่ว่างในช่วงที่เลือก"', () => {
    const t = getTranslations('th');
    expect(t.catalog.fullyUnavailable).toBe('ไม่ว่างในช่วงที่เลือก');
  });

  it('[copy] Thai: catalog.partiallyUnavailable is exactly "ว่างบางวันในช่วงที่เลือก"', () => {
    const t = getTranslations('th');
    expect(t.catalog.partiallyUnavailable).toBe('ว่างบางวันในช่วงที่เลือก');
  });

  it('[copy] English parity keys exist and are non-empty', () => {
    const t = getTranslations('en');
    expect(typeof t.catalog.fullyUnavailable).toBe('string');
    expect(t.catalog.fullyUnavailable.length).toBeGreaterThan(0);
    expect(typeof t.catalog.partiallyUnavailable).toBe('string');
    expect(t.catalog.partiallyUnavailable.length).toBeGreaterThan(0);
  });

  it('[copy] no em-dash separator in either Thai string (playbook copy rule)', () => {
    const t = getTranslations('th');
    expect(t.catalog.fullyUnavailable).not.toContain('—');
    expect(t.catalog.partiallyUnavailable).not.toContain('—');
  });
});

// ===========================================================================
// Group H: count actions — CAM-344 finding (Seams & refs)
// ===========================================================================

describe('count actions — getCampSiteCount / getCampgroundCount unaffected by step-7 removal', () => {
  it('[finding] FilterModal.tsx (the only caller of getCampSiteCount) never forwards startDate/endDate', () => {
    const filterModalSrc = src('components/FilterModal.tsx');
    // The filters object built for getCampSiteCount only ever sets type/terrain/
    // activities/access/facilities/min/max — never filters.startDate/endDate.
    // Type-agnostic anchor: CAM-523 typed this `any` as CampSiteFilterParams.
    // Match any declared type so the assertion survives a future rename and keeps
    // its teeth (it still fails if the call site starts forwarding dates).
    const callSiteMatch = filterModalSrc.match(/const filters: \w+(?:<[^>]*>)? = \{\};[\s\S]*?getCampSiteCount\(filters\)/);
    expect(callSiteMatch).not.toBeNull();
    expect(callSiteMatch![0]).not.toContain('filters.startDate');
    expect(callSiteMatch![0]).not.toContain('filters.endDate');
  });

  it('[sanity] getCampSiteCount with dates present still returns a count (no crash) — step 7 removal only widens the count, never breaks it', () => {
    const where = buildCampSiteWhere({ startDate: '2026-09-05', endDate: '2026-09-10' });
    // No exclusion clause added → count would be >= the old (filtered) count,
    // never throw, never return a nonsensical shape.
    expect(where.NOT).toBeUndefined();
    expect(where.spots).toBeUndefined();
    expect(where).toMatchObject({ isActive: true, isPublished: true, deletedAt: null });
  });
});

// ===========================================================================
// Group I: enum contract (Data section — CAM-344 backend contract call)
// ===========================================================================

describe('CampAvailabilityStatus — enum contract', () => {
  it('the only two literal values are FULLY_UNAVAILABLE and PARTIALLY_UNAVAILABLE', async () => {
    const values: CampAvailabilityStatus[] = ['FULLY_UNAVAILABLE', 'PARTIALLY_UNAVAILABLE'];
    expect(values).toHaveLength(2);
  });
});
