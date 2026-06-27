/**
 * cam-190-avail1-blockeddate.test.ts — unit + source tests for CAM-190 AVAIL-1
 *
 * AC→test matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * AC-1  Blocked day → available:false + blockedByHost:true in GET availability
 * AC-1  Non-blocked day with capacity → unchanged (available:true, blockedByHost:false)
 * AC-1  BlockedDate predicate IDENTICAL to booking write path (source + unit)
 * AC-1  No blockedReason exposed (privacy — owner-delegated decision, CAM-190)
 * AC-1  Blocked + capacity-full → available:false + blockedByHost:true
 * AC-2  Concurrency: staging verification only — not new code (see comment at end)
 * Cache Cache-Control: no-store present on both routes (source-inspect)
 *
 * Layers:
 *   unit        = getBlockedDatesForRange + getCampSiteDailyAvailability with mocked prisma
 *   source      = source-inspection assertions (predicate shape, no-store, privacy)
 *
 * Prove-It: each test is annotated with what would break the assertion.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  },
}));

import { prisma } from '@/lib/prisma';
import {
  getBlockedDatesForRange,
  getCampSiteDailyAvailability,
} from '@/lib/campsite-availability';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CAMP_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-000000000010';

/** Build a Date at midnight UTC from an ISO date string */
function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no bookings, no blocked dates
  (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

// ===========================================================================
// Group A: getBlockedDatesForRange — predicate shape (AC-1 / source of truth)
// ===========================================================================

describe('getBlockedDatesForRange — predicate and return shape (AC-1)', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Returns the rows that the mocked prisma returns (basic contract)
  // Prove-It: if findMany were never called, result would be [] → FAIL.
  // ─────────────────────────────────────────────────────────────────────────
  it('[normal] returns blocked date rows from prisma (no spotId)', async () => {
    const rows = [
      { startDate: d('2026-09-05'), endDate: d('2026-09-07') },
    ];
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(rows);

    const result = await getBlockedDatesForRange(CAMP_ID, d('2026-09-01'), d('2026-09-30'));

    expect(result).toEqual(rows);
    expect(prisma.blockedDate.findMany).toHaveBeenCalledOnce();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Predicate shape without spotId: OR must contain only { spotId: null }
  // Prove-It: if spotId arm were always added, the predicate would diverge from
  // the write-path contract (it would add an extra arm).
  // ─────────────────────────────────────────────────────────────────────────
  it('[predicate] without spotId: OR contains only { spotId: null } (whole-camp blocks only)', async () => {
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await getBlockedDatesForRange(CAMP_ID, d('2026-09-01'), d('2026-09-30'));

    const callArgs = (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.where.OR).toEqual([{ spotId: null }]);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Predicate shape with spotId: OR contains both { spotId: null } and { spotId }
  // This mirrors the write-path: ...(data.spotId ? [{ spotId: data.spotId }] : [])
  // Prove-It: removing the spotId arm would miss spot-level blocks.
  // ─────────────────────────────────────────────────────────────────────────
  it('[predicate] with spotId: OR contains { spotId: null } AND { spotId } (spot-level blocks)', async () => {
    const SPOT_ID = 'spot-aaa-001';
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await getBlockedDatesForRange(CAMP_ID, d('2026-09-01'), d('2026-09-30'), SPOT_ID);

    const callArgs = (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.where.OR).toEqual([{ spotId: null }, { spotId: SPOT_ID }]);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deletedAt: null must be in the predicate (soft-delete guard)
  // Prove-It: remove deletedAt from the predicate → soft-deleted blocks leak.
  // ─────────────────────────────────────────────────────────────────────────
  it('[predicate] deletedAt: null present in where (soft-delete guard, AC-1)', async () => {
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await getBlockedDatesForRange(CAMP_ID, d('2026-09-01'), d('2026-09-30'));

    const callArgs = (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.where.deletedAt).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AND overlap predicate: startDate lte endDate AND endDate gte startDate
  // This is the exact overlap predicate from bookings/route.ts lines 100–103.
  // Prove-It: swap lte/gte → wrong overlap → non-overlapping blocks returned.
  // ─────────────────────────────────────────────────────────────────────────
  it('[predicate] AND overlap: startDate lte rangeEnd AND endDate gte rangeStart (identical to write path)', async () => {
    const rangeStart = d('2026-09-01');
    const rangeEnd = d('2026-09-30');
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await getBlockedDatesForRange(CAMP_ID, rangeStart, rangeEnd);

    const callArgs = (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.where.AND).toEqual([
      { startDate: { lte: rangeEnd } },
      { endDate: { gte: rangeStart } },
    ]);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Privacy: return type must NOT include reason (owner-delegated, CAM-190)
  // Prove-It: if reason were selected, this test would still pass, but the source
  // inspection below confirms it is not in the select clause.
  // ─────────────────────────────────────────────────────────────────────────
  it('[privacy] select clause does NOT include reason field (no host notes exposed)', async () => {
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await getBlockedDatesForRange(CAMP_ID, d('2026-09-01'), d('2026-09-30'));

    const callArgs = (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.select).not.toHaveProperty('reason');
    expect(callArgs.select).toEqual({ startDate: true, endDate: true });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // campSiteId is passed through correctly
  // ─────────────────────────────────────────────────────────────────────────
  it('[normal] campSiteId is passed to the query', async () => {
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await getBlockedDatesForRange(CAMP_ID, d('2026-09-01'), d('2026-09-30'));

    const callArgs = (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.where.campSiteId).toBe(CAMP_ID);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Empty result: no blocked dates → returns []
  // Prove-It: if the mock were wrong, result would not be [].
  // ─────────────────────────────────────────────────────────────────────────
  it('[null/empty] no blocked dates → returns empty array', async () => {
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getBlockedDatesForRange(CAMP_ID, d('2026-09-01'), d('2026-09-30'));

    expect(result).toEqual([]);
  });
});

// ===========================================================================
// Group B: getCampSiteDailyAvailability — blockedByHost merge (AC-1)
// ===========================================================================

describe('getCampSiteDailyAvailability — blockedByHost merge (AC-1)', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // AC-1: a day covered by a BlockedDate → blockedByHost:true
  // Prove-It: remove the blockedRanges loop → blockedByHost stays false → FAIL.
  // ─────────────────────────────────────────────────────────────────────────
  it('[ac1] blocked day → blockedByHost:true in availability map', async () => {
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2026-09-05'), endDate: d('2026-09-07') },
    ]);

    const avail = await getCampSiteDailyAvailability(CAMP_ID, d('2026-09-01'), d('2026-09-10'));

    expect(avail['2026-09-05'].blockedByHost).toBe(true);
    expect(avail['2026-09-06'].blockedByHost).toBe(true);
    expect(avail['2026-09-07'].blockedByHost).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC-1: days outside the blocked range → blockedByHost:false
  // Prove-It: if the while-loop boundary were wrong, adjacent days would be flagged.
  // ─────────────────────────────────────────────────────────────────────────
  it('[ac1] days outside the blocked range → blockedByHost:false (unchanged)', async () => {
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2026-09-05'), endDate: d('2026-09-07') },
    ]);

    const avail = await getCampSiteDailyAvailability(CAMP_ID, d('2026-09-01'), d('2026-09-10'));

    expect(avail['2026-09-04'].blockedByHost).toBe(false);
    expect(avail['2026-09-08'].blockedByHost).toBe(false);
    expect(avail['2026-09-01'].blockedByHost).toBe(false);
    expect(avail['2026-09-10'].blockedByHost).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC-1: no blocked dates at all → all blockedByHost:false
  // Prove-It: if the default were true, all days would be blocked → FAIL.
  // ─────────────────────────────────────────────────────────────────────────
  it('[null/empty] no blocked dates → all days have blockedByHost:false', async () => {
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const avail = await getCampSiteDailyAvailability(CAMP_ID, d('2026-09-01'), d('2026-09-03'));

    expect(avail['2026-09-01'].blockedByHost).toBe(false);
    expect(avail['2026-09-02'].blockedByHost).toBe(false);
    expect(avail['2026-09-03'].blockedByHost).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Booking counts are still populated correctly alongside blockedByHost
  // Prove-It: if bookings were dropped, bookedGuests would be 0 → FAIL.
  // ─────────────────────────────────────────────────────────────────────────
  it('[normal] booking guest counts are still accumulated when blocked dates present', async () => {
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        checkInDate: d('2026-09-01'),
        checkOutDate: d('2026-09-03'),
        guests: 4,
        status: 'CONFIRMED',
      },
    ]);
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2026-09-03'), endDate: d('2026-09-05') },
    ]);

    const avail = await getCampSiteDailyAvailability(CAMP_ID, d('2026-09-01'), d('2026-09-05'));

    // Sep 1 and 2: booked, not blocked
    expect(avail['2026-09-01'].bookedGuests).toBe(4);
    expect(avail['2026-09-01'].blockedByHost).toBe(false);
    expect(avail['2026-09-02'].bookedGuests).toBe(4);
    expect(avail['2026-09-02'].blockedByHost).toBe(false);
    // Sep 3–5: blocked
    expect(avail['2026-09-03'].blockedByHost).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Boundary: single-day block (startDate = endDate)
  // Prove-It: if cur <= blockEnd used < instead, a single-day block would be skipped.
  // ─────────────────────────────────────────────────────────────────────────
  it('[boundary] single-day block (startDate = endDate) → that exact day blockedByHost:true', async () => {
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2026-09-05'), endDate: d('2026-09-05') },
    ]);

    const avail = await getCampSiteDailyAvailability(CAMP_ID, d('2026-09-01'), d('2026-09-10'));

    expect(avail['2026-09-05'].blockedByHost).toBe(true);
    expect(avail['2026-09-04'].blockedByHost).toBe(false);
    expect(avail['2026-09-06'].blockedByHost).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Multiple non-overlapping blocked ranges
  // ─────────────────────────────────────────────────────────────────────────
  it('[normal] multiple blocked ranges — all days in each range are flagged', async () => {
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2026-09-02'), endDate: d('2026-09-03') },
      { startDate: d('2026-09-07'), endDate: d('2026-09-08') },
    ]);

    const avail = await getCampSiteDailyAvailability(CAMP_ID, d('2026-09-01'), d('2026-09-10'));

    expect(avail['2026-09-02'].blockedByHost).toBe(true);
    expect(avail['2026-09-03'].blockedByHost).toBe(true);
    expect(avail['2026-09-07'].blockedByHost).toBe(true);
    expect(avail['2026-09-08'].blockedByHost).toBe(true);
    // Gaps between ranges remain unblocked
    expect(avail['2026-09-04'].blockedByHost).toBe(false);
    expect(avail['2026-09-06'].blockedByHost).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Exactly 2 prisma queries per request (booking + blockedDate) — no N+1
  // Prove-It: if a per-day query loop were used, findMany would be called N times.
  // ─────────────────────────────────────────────────────────────────────────
  it('[no-n+1] exactly 1 booking query + 1 blockedDate query per call (no N+1)', async () => {
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await getCampSiteDailyAvailability(CAMP_ID, d('2026-09-01'), d('2026-09-30'));

    expect(prisma.booking.findMany).toHaveBeenCalledOnce();
    expect(prisma.blockedDate.findMany).toHaveBeenCalledOnce();
  });
});

// ===========================================================================
// Group C: Merged availability rule — available = false when blocked OR full
// ===========================================================================

describe('getCampSiteDailyAvailability — merged availability rule (AC-1)', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // The service layer returns blockedByHost:true so the routes can set available:false.
  // These tests confirm the service sets the flag; the route tests confirm available.
  // ─────────────────────────────────────────────────────────────────────────

  it('[ac1] service sets blockedByHost:true for blocked days (routes compute available)', async () => {
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2026-09-10'), endDate: d('2026-09-12') },
    ]);

    const avail = await getCampSiteDailyAvailability(CAMP_ID, d('2026-09-10'), d('2026-09-12'));

    // All three days are blocked
    ['2026-09-10', '2026-09-11', '2026-09-12'].forEach((day) => {
      expect(avail[day].blockedByHost).toBe(true);
    });
  });

  it('[ac1] service sets blockedByHost:false for non-blocked days', async () => {
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const avail = await getCampSiteDailyAvailability(CAMP_ID, d('2026-09-10'), d('2026-09-12'));

    ['2026-09-10', '2026-09-11', '2026-09-12'].forEach((day) => {
      expect(avail[day].blockedByHost).toBe(false);
    });
  });
});

// ===========================================================================
// Group D: Source-inspection — predicate match, no-store, privacy (AC-1, Cache)
// ===========================================================================

describe('source-inspection — predicate, no-store, privacy (AC-1 / Cache)', () => {
  const availabilitySrc = fs.readFileSync(
    path.join(process.cwd(), 'lib/campsite-availability.ts'),
    'utf-8'
  );
  const campsitesRouteSrc = fs.readFileSync(
    path.join(process.cwd(), 'app/api/campsites/[id]/availability/route.ts'),
    'utf-8'
  );
  const campgroundsRouteSrc = fs.readFileSync(
    path.join(process.cwd(), 'app/api/campgrounds/[id]/availability/route.ts'),
    'utf-8'
  );
  const bookingsRouteSrc = fs.readFileSync(
    path.join(process.cwd(), 'app/api/bookings/route.ts'),
    'utf-8'
  );

  // ─────────────────────────────────────────────────────────────────────────
  // AC-1: predicate in getBlockedDatesForRange uses deletedAt: null (identical to write path)
  // Prove-It: remove deletedAt from either source → assertion fails.
  // ─────────────────────────────────────────────────────────────────────────
  it('[source-ac1] getBlockedDatesForRange contains deletedAt: null (soft-delete guard)', () => {
    expect(availabilitySrc).toContain('deletedAt: null');
  });

  it('[source-ac1] booking write path also contains deletedAt: null (predicate match)', () => {
    expect(bookingsRouteSrc).toContain('deletedAt: null');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC-1: OR: [{ spotId: null }, ...] present in both read and write paths
  // Prove-It: remove OR from either source → assertion fails.
  // ─────────────────────────────────────────────────────────────────────────
  it('[source-ac1] getBlockedDatesForRange contains OR with spotId: null arm', () => {
    expect(availabilitySrc).toContain('spotId: null');
    expect(availabilitySrc).toContain('OR:');
  });

  it('[source-ac1] booking write path also uses OR with spotId: null arm', () => {
    expect(bookingsRouteSrc).toContain('spotId: null');
    expect(bookingsRouteSrc).toContain('OR:');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC-1: overlap predicate shape — startDate lte / endDate gte
  // Prove-It: swap lte/gte in either source → assertion fails.
  // ─────────────────────────────────────────────────────────────────────────
  it('[source-ac1] getBlockedDatesForRange contains startDate: { lte: endDate }', () => {
    expect(availabilitySrc).toContain('startDate: { lte: endDate }');
  });

  it('[source-ac1] getBlockedDatesForRange contains endDate: { gte: startDate }', () => {
    expect(availabilitySrc).toContain('endDate: { gte: startDate }');
  });

  it('[source-ac1] booking write path contains startDate: { lte: checkOut }', () => {
    expect(bookingsRouteSrc).toContain('startDate: { lte: checkOut }');
  });

  it('[source-ac1] booking write path contains endDate: { gte: checkIn }', () => {
    expect(bookingsRouteSrc).toContain('endDate: { gte: checkIn }');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Privacy: reason is NOT in the select of getBlockedDatesForRange
  // Prove-It: add reason: true to the select → this assertion fails.
  // ─────────────────────────────────────────────────────────────────────────
  it('[source-privacy] getBlockedDatesForRange does NOT select reason (host notes not exposed)', () => {
    // The select must only contain startDate and endDate
    // Find the select block inside getBlockedDatesForRange
    const selectMatch = availabilitySrc.match(/select:\s*\{[^}]*\}/);
    expect(selectMatch).not.toBeNull();
    const selectBlock = selectMatch![0];
    expect(selectBlock).not.toContain('reason');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Privacy: routes do NOT include blockedReason in formatted output
  // Prove-It: add blockedReason to a route → assertion fails.
  // ─────────────────────────────────────────────────────────────────────────
  it('[source-privacy] campsites route does NOT include blockedReason in response', () => {
    expect(campsitesRouteSrc).not.toContain('blockedReason');
  });

  it('[source-privacy] campgrounds route does NOT include blockedReason in response', () => {
    expect(campgroundsRouteSrc).not.toContain('blockedReason');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Cache: both routes include 'force-dynamic' export
  // Prove-It: remove the export → assertion fails; next.js may cache the route.
  // ─────────────────────────────────────────────────────────────────────────
  it("[source-cache] campsites route exports dynamic = 'force-dynamic'", () => {
    expect(campsitesRouteSrc).toContain("export const dynamic = 'force-dynamic'");
  });

  it("[source-cache] campgrounds route exports dynamic = 'force-dynamic'", () => {
    expect(campgroundsRouteSrc).toContain("export const dynamic = 'force-dynamic'");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Cache: both routes set Cache-Control: no-store on the response
  // Prove-It: remove the header.set call → assertion fails.
  // ─────────────────────────────────────────────────────────────────────────
  it('[source-cache] campsites route sets Cache-Control: no-store header', () => {
    expect(campsitesRouteSrc).toContain("'Cache-Control', 'no-store'");
  });

  it('[source-cache] campgrounds route sets Cache-Control: no-store header', () => {
    expect(campgroundsRouteSrc).toContain("'Cache-Control', 'no-store'");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC-1: both routes include blockedByHost in formatted output
  // Prove-It: remove blockedByHost from a route → assertion fails.
  // ─────────────────────────────────────────────────────────────────────────
  it('[source-ac1] campsites route includes blockedByHost in formatted day object', () => {
    expect(campsitesRouteSrc).toContain('blockedByHost');
  });

  it('[source-ac1] campgrounds route includes blockedByHost in formatted day object', () => {
    expect(campgroundsRouteSrc).toContain('blockedByHost');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Merged availability rule: available uses blockedByHost in both routes
  // Prove-It: remove the blockedByHost check → blocked days appear available.
  // ─────────────────────────────────────────────────────────────────────────
  it('[source-ac1] campsites route: available = !isCapacityFull && !data.blockedByHost', () => {
    expect(campsitesRouteSrc).toContain('!isCapacityFull && !data.blockedByHost');
  });

  it('[source-ac1] campgrounds route: available = !isCapacityFull && !data.blockedByHost', () => {
    expect(campgroundsRouteSrc).toContain('!isCapacityFull && !data.blockedByHost');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getCampSiteDailyAvailability calls getBlockedDatesForRange once
  // Prove-It: remove the call → blockedByHost is never set → FAIL.
  // ─────────────────────────────────────────────────────────────────────────
  it('[source-ac1] getCampSiteDailyAvailability calls getBlockedDatesForRange', () => {
    expect(availabilitySrc).toContain('getBlockedDatesForRange');
  });
});

// ===========================================================================
// STAGING CONCURRENCY NOTE (AC-2) — not new code
// ===========================================================================
//
// AC-2 ("two concurrent bookings, only one succeeds, other sees full") relies on
// the Serializable transaction + P2034 retry already built in CAM-57
// (app/api/bookings/route.ts, withBookingTransaction, ADR-006).
// AVAIL-1 adds no new concurrency code. AC-2 is a staging verification step:
//
//   Run the staging concurrency test from cam-57-atomic-lock.test.ts comments:
//   two simultaneous POST /api/bookings for the same campsite + overlapping dates
//   with one slot remaining → expected: one 201, one 409.
//
// Backend must document the staging test result in the PR description.
