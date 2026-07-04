/**
 * cam-267-prep1-availability.test.ts — CAM-267 PREP-1
 *
 * "แคมป์ปิดรับจอง" (whole-camp BlockedDate) must be excluded from date-filtered
 * search results, and the campsite detail page must be able to show a live
 * "เหลือ X ที่" / "เต็มแล้ว" for the exact stay the user picked — derived from the
 * SAME math the booking write path already uses (no forked implementation).
 *
 * AC → test matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * AC-1  buildCampSiteWhere excludes a campsite with a whole-camp BlockedDate
 *       overlapping the requested [startDate, endDate] range.
 * AC-1  A BlockedDate outside the requested range does NOT exclude the campsite.
 * AC-1  A spot-level BlockedDate (spotId set) does NOT exclude the whole campsite.
 * AC-1  No dates supplied → no BlockedDate exclusion clause added at all.
 * AC-1  Predicate is IDENTICAL (lte/gte shape) to getBlockedDatesForRange's overlap.
 * AC-2  getRemainingCapacity: capacity 5, 3 booked → remaining 2 (floor-0 math).
 * AC-2  CANCELLED bookings excluded from the booked-guests sum.
 * AC-2  Floor at 0 — never negative even if bookings exceed capacity.
 * AC-3  Fully booked (bookedGuests === capacity) → remaining 0.
 * BR    A whole-camp BlockedDate covering a night ⇒ remaining forced to 0
 *       regardless of numeric capacity headroom.
 * Agree getRemainingCapacity vs checkDateAvailability agree on the same fixture
 *       (same boundary: the last additional guest that still fits).
 * Copy  booking.remainingSpots / booking.fullyBooked Thai copy verbatim.
 * Priv  BlockedDate.reason never selected/returned by any touched read path.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Module mock — prisma only; no DB connection needed
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: {
      findMany: vi.fn(),
    },
    blockedDate: {
      findMany: vi.fn(),
    },
    campSite: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { buildCampSiteWhere } from '@/lib/campsite-filters';
import {
  getRemainingCapacity,
  checkDateAvailability,
} from '@/lib/campsite-availability';
import { getTranslations } from '@/locales/translations';

const CAMP_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-000000000267';

/** Build a Date at midnight UTC from an ISO date string */
function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ maxGuestsPerDay: 5 });
});

// ===========================================================================
// Group A: buildCampSiteWhere — BlockedDate exclusion (AC-1, search)
// ===========================================================================

describe('buildCampSiteWhere — BlockedDate exclusion (AC-1)', () => {
  it('[normal] no dates supplied → where.NOT is not set (no blocked-date clause at all)', () => {
    const where = buildCampSiteWhere({});
    expect(where.NOT).toBeUndefined();
  });

  it('[normal] dates supplied → where.NOT excludes whole-camp blocks overlapping the range', () => {
    const where = buildCampSiteWhere({ startDate: '2026-09-05', endDate: '2026-09-10' });

    expect(where.NOT).toBeDefined();
    const not = where.NOT as Prisma.CampSiteWhereInput;
    const blockedDates = not.blockedDates as Prisma.BlockedDateListRelationFilter;
    expect(blockedDates.some).toEqual({
      spotId: null,
      deletedAt: null,
      startDate: { lte: d('2026-09-10') },
      endDate: { gte: d('2026-09-05') },
    });
  });

  it('[predicate] overlap shape is IDENTICAL to getBlockedDatesForRange (lte rangeEnd / gte rangeStart)', () => {
    const availabilitySrc = fs.readFileSync(
      path.join(process.cwd(), 'lib/campsite-availability.ts'),
      'utf-8'
    );
    const filtersSrc = fs.readFileSync(
      path.join(process.cwd(), 'lib/campsite-filters.ts'),
      'utf-8'
    );

    // Both sources express the same overlap predicate shape.
    expect(availabilitySrc).toContain('startDate: { lte: endDate }');
    expect(availabilitySrc).toContain('endDate: { gte: startDate }');
    expect(filtersSrc).toContain('startDate: { lte: rangeEnd }');
    expect(filtersSrc).toContain('endDate: { gte: rangeStart }');
  });

  it('[normal] campsite-level blocks only — predicate pins spotId: null (a spot-level block must not remove the whole campsite)', () => {
    const where = buildCampSiteWhere({ startDate: '2026-09-05', endDate: '2026-09-10' });
    const not = where.NOT as Prisma.CampSiteWhereInput;
    const blockedDates = not.blockedDates as Prisma.BlockedDateListRelationFilter;
    expect(blockedDates.some).toMatchObject({ spotId: null });
  });

  it('[predicate] soft-deleted BlockedDate rows are excluded from the predicate (deletedAt: null)', () => {
    const where = buildCampSiteWhere({ startDate: '2026-09-05', endDate: '2026-09-10' });
    const not = where.NOT as Prisma.CampSiteWhereInput;
    const blockedDates = not.blockedDates as Prisma.BlockedDateListRelationFilter;
    expect(blockedDates.some).toMatchObject({ deletedAt: null });
  });

  it('[normal] booking-overlap sub-query (where.spots) is still present alongside the blocked-date exclusion', () => {
    const where = buildCampSiteWhere({ startDate: '2026-09-05', endDate: '2026-09-10' });
    expect(where.spots).toBeDefined();
    expect(where.NOT).toBeDefined();
  });

  it('[boundary] a single-day range (startDate === endDate) still produces a valid predicate', () => {
    const where = buildCampSiteWhere({ startDate: '2026-09-05', endDate: '2026-09-05' });
    const not = where.NOT as Prisma.CampSiteWhereInput;
    const blockedDates = not.blockedDates as Prisma.BlockedDateListRelationFilter;
    expect(blockedDates.some).toEqual({
      spotId: null,
      deletedAt: null,
      startDate: { lte: d('2026-09-05') },
      endDate: { gte: d('2026-09-05') },
    });
  });
});

// ===========================================================================
// Group B: getRemainingCapacity — remaining math (AC-2, AC-3, BR)
// ===========================================================================

describe('getRemainingCapacity — remaining math (AC-2/AC-3)', () => {
  it('[normal] capacity 5, 3 booked (1 night) → remaining 2', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ maxGuestsPerDay: 5 });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 3, status: 'CONFIRMED' },
    ]);

    const result = await getRemainingCapacity(CAMP_ID, d('2026-09-10'), d('2026-09-11'));

    expect(result.capacity).toBe(5);
    expect(result.bookedGuests).toBe(3);
    expect(result.remaining).toBe(2);
    expect(result.blockedByHost).toBe(false);
  });

  it('[normal] CANCELLED bookings are excluded from the booked-guests sum', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ maxGuestsPerDay: 5 });
    // getCampSiteDailyAvailability only queries CONFIRMED/PENDING — a CANCELLED
    // booking would never be returned by the mocked findMany in the first place,
    // proving the "non-CANCELLED" rule at the query boundary.
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 3, status: 'CONFIRMED' },
    ]);

    await getRemainingCapacity(CAMP_ID, d('2026-09-10'), d('2026-09-11'));

    const callArgs = (prisma.booking.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.where.status).toEqual({ in: ['CONFIRMED', 'PENDING'] });
  });

  it('[boundary] floor at 0 — booked guests exceeding capacity never returns negative', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ maxGuestsPerDay: 5 });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 8, status: 'CONFIRMED' },
    ]);

    const result = await getRemainingCapacity(CAMP_ID, d('2026-09-10'), d('2026-09-11'));

    expect(result.remaining).toBe(0);
  });

  it('[ac-3] fully booked (bookedGuests === capacity) → remaining 0 (เต็มแล้ว)', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ maxGuestsPerDay: 5 });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 5, status: 'CONFIRMED' },
    ]);

    const result = await getRemainingCapacity(CAMP_ID, d('2026-09-10'), d('2026-09-11'));

    expect(result.remaining).toBe(0);
  });

  it('[br] a whole-camp BlockedDate covering a night in range forces remaining to 0 regardless of capacity headroom', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ maxGuestsPerDay: 5 });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]); // 0 booked — plenty of headroom
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2026-09-10'), endDate: d('2026-09-10') },
    ]);

    const result = await getRemainingCapacity(CAMP_ID, d('2026-09-10'), d('2026-09-11'));

    expect(result.blockedByHost).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('[normal] multi-night stay takes the bottleneck (max booked) night, not the first/last', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ maxGuestsPerDay: 5 });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      // Night 1 (Sep 10): 1 guest. Night 2 (Sep 11): 4 guests (bottleneck). Night 3 (Sep 12): 1 guest.
      { checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 1, status: 'CONFIRMED' },
      { checkInDate: d('2026-09-11'), checkOutDate: d('2026-09-12'), guests: 4, status: 'CONFIRMED' },
      { checkInDate: d('2026-09-12'), checkOutDate: d('2026-09-13'), guests: 1, status: 'CONFIRMED' },
    ]);

    // Stay is Sep 10 → Sep 13 checkout (3 nights: 10, 11, 12)
    const result = await getRemainingCapacity(CAMP_ID, d('2026-09-10'), d('2026-09-13'));

    expect(result.bookedGuests).toBe(4);
    expect(result.remaining).toBe(1);
  });

  it('[boundary] checkout day itself is excluded from the range checked (departure frees the spot same-day)', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ maxGuestsPerDay: 5 });
    // A booking that only occupies the checkout day of the NEW stay must not
    // count against the new stay's remaining capacity.
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { checkInDate: d('2026-09-11'), checkOutDate: d('2026-09-12'), guests: 5, status: 'CONFIRMED' },
    ]);

    // New stay: Sep 10 (check-in) → Sep 11 (check-out) — only night Sep 10 is checked.
    const result = await getRemainingCapacity(CAMP_ID, d('2026-09-10'), d('2026-09-11'));

    expect(result.bookedGuests).toBe(0);
    expect(result.remaining).toBe(5);
  });

  it('[null/empty] campsite not found → capacity/remaining null, not blocked', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await getRemainingCapacity(CAMP_ID, d('2026-09-10'), d('2026-09-11'));

    expect(result).toEqual({ capacity: null, bookedGuests: 0, remaining: null, blockedByHost: false });
  });

  it('[null/empty] no explicit capacity (maxGuestsPerDay null) and not blocked → remaining is null (unbounded, not shown)', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ maxGuestsPerDay: null });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 3, status: 'CONFIRMED' },
    ]);

    const result = await getRemainingCapacity(CAMP_ID, d('2026-09-10'), d('2026-09-11'));

    expect(result.capacity).toBeNull();
    expect(result.remaining).toBeNull();
    expect(result.blockedByHost).toBe(false);
  });

  it('[no-n+1] getCampSiteDailyAvailability is reused (exactly 1 booking + 1 blockedDate query), no forked query', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ maxGuestsPerDay: 5 });

    await getRemainingCapacity(CAMP_ID, d('2026-09-10'), d('2026-09-13'));

    expect(prisma.campSite.findUnique).toHaveBeenCalledOnce();
    expect(prisma.booking.findMany).toHaveBeenCalledOnce();
    expect(prisma.blockedDate.findMany).toHaveBeenCalledOnce();
  });
});

// ===========================================================================
// Group C: Agreement — getRemainingCapacity vs checkDateAvailability (same fixture)
// ===========================================================================

describe('getRemainingCapacity agrees with checkDateAvailability (same fixture)', () => {
  it('[agree] remaining is exactly the last additional-guest count checkDateAvailability still allows', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      maxGuestsPerDay: 5,
      maxTentsPerDay: null,
    });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 3, status: 'CONFIRMED' },
    ]);

    const remainingResult = await getRemainingCapacity(CAMP_ID, d('2026-09-10'), d('2026-09-11'));
    expect(remainingResult.remaining).toBe(2);

    // checkDateAvailability re-queries with the same mocked fixture (findMany is
    // stateless across calls here) — requesting exactly `remaining` more guests
    // must be available; requesting one more than that must not.
    const withExactRemaining = await checkDateAvailability(CAMP_ID, d('2026-09-10'), remainingResult.remaining as number);
    expect(withExactRemaining.available).toBe(true);

    const withOneMore = await checkDateAvailability(CAMP_ID, d('2026-09-10'), (remainingResult.remaining as number) + 1);
    expect(withOneMore.available).toBe(false);
  });

  it('[agree] fully booked on both sides — remaining 0 and checkDateAvailability rejects any additional guest', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      maxGuestsPerDay: 5,
      maxTentsPerDay: null,
    });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { checkInDate: d('2026-09-10'), checkOutDate: d('2026-09-11'), guests: 5, status: 'CONFIRMED' },
    ]);

    const remainingResult = await getRemainingCapacity(CAMP_ID, d('2026-09-10'), d('2026-09-11'));
    expect(remainingResult.remaining).toBe(0);

    const oneMoreGuest = await checkDateAvailability(CAMP_ID, d('2026-09-10'), 1);
    expect(oneMoreGuest.available).toBe(false);
  });
});

// ===========================================================================
// Group D: Thai copy verbatim (locale)
// ===========================================================================

describe('booking copy — remainingSpots / fullyBooked verbatim (Thai + English)', () => {
  it('[copy] Thai: booking.remainingSpots is "เหลือ {n} ที่"', () => {
    const t = getTranslations('th');
    expect(t.booking.remainingSpots).toBe('เหลือ {n} ที่');
  });

  it('[copy] Thai: booking.fullyBooked is "เต็มแล้ว"', () => {
    const t = getTranslations('th');
    expect(t.booking.fullyBooked).toBe('เต็มแล้ว');
  });

  it('[copy] English: booking.remainingSpots is "{n} spots left"', () => {
    const t = getTranslations('en');
    expect(t.booking.remainingSpots).toBe('{n} spots left');
  });

  it('[copy] English: booking.fullyBooked is "Fully booked"', () => {
    const t = getTranslations('en');
    expect(t.booking.fullyBooked).toBe('Fully booked');
  });

  it('[copy] {n} placeholder substitutes the remaining count correctly (AC-2 example: 2)', () => {
    const t = getTranslations('th');
    const rendered = t.booking.remainingSpots.replace('{n}', String(2));
    expect(rendered).toBe('เหลือ 2 ที่');
  });
});

// ===========================================================================
// Group E: Privacy — BlockedDate.reason never exposed (Rules)
// ===========================================================================

describe('privacy — BlockedDate.reason never leaves the server on any touched read path', () => {
  const remainingCapacityRouteSrc = fs.readFileSync(
    path.join(process.cwd(), 'app/api/campsites/[id]/remaining-capacity/route.ts'),
    'utf-8'
  );

  it('[privacy] getRemainingCapacity returns exactly capacity/bookedGuests/remaining/blockedByHost — no reason key', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ maxGuestsPerDay: 5 });
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2026-09-10'), endDate: d('2026-09-10') },
    ]);

    const result = await getRemainingCapacity(CAMP_ID, d('2026-09-10'), d('2026-09-11'));

    expect(Object.keys(result).sort()).toEqual(['blockedByHost', 'bookedGuests', 'capacity', 'remaining']);
    expect(result).not.toHaveProperty('reason');
  });

  it('[privacy] buildCampSiteWhere blocked-date predicate does not select/return BlockedDate.reason', () => {
    // The predicate uses only spotId/deletedAt/startDate/endDate — never selects
    // or forwards the host's free-text reason field.
    const where = buildCampSiteWhere({ startDate: '2026-09-05', endDate: '2026-09-10' });
    const not = where.NOT as Prisma.CampSiteWhereInput;
    const blockedDates = not.blockedDates as Prisma.BlockedDateListRelationFilter;
    expect(Object.keys(blockedDates.some as object).sort()).toEqual(
      ['deletedAt', 'endDate', 'spotId', 'startDate']
    );
  });

  it('[privacy] the new remaining-capacity route never forwards a reason/blockedReason field in its response', () => {
    // Precise check: the object literal returned to the client (inside apiSuccess)
    // only ever assigns campSiteId/capacity/remaining/blockedByHost.
    const responseBlockMatch = remainingCapacityRouteSrc.match(/apiSuccess\(\{[^}]*\}\)/);
    expect(responseBlockMatch).not.toBeNull();
    expect(responseBlockMatch![0]).not.toContain('reason');
  });

  it('[privacy] remaining-capacity route response shape is capacity/remaining/blockedByHost only', () => {
    expect(remainingCapacityRouteSrc).toContain('capacity: result.capacity');
    expect(remainingCapacityRouteSrc).toContain('remaining: result.remaining');
    expect(remainingCapacityRouteSrc).toContain('blockedByHost: result.blockedByHost');
  });

  it('[cache] remaining-capacity route is force-dynamic + no-store (never cached stale)', () => {
    expect(remainingCapacityRouteSrc).toContain("export const dynamic = 'force-dynamic'");
    expect(remainingCapacityRouteSrc).toContain("'Cache-Control', 'no-store'");
  });

  it('[authz] remaining-capacity route gates non-public campsites (404, no info-disclosure)', () => {
    expect(remainingCapacityRouteSrc).toContain('isCampSitePublic');
    expect(remainingCapacityRouteSrc).toContain('canViewCampSite');
    expect(remainingCapacityRouteSrc).toContain("apiError('Camp site not found', 404)");
  });

  it('[validation] remaining-capacity route re-parses query params with zod at the boundary', () => {
    expect(remainingCapacityRouteSrc).toContain('remainingCapacityQuerySchema.safeParse');
  });
});
