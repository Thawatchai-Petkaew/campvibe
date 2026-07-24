/**
 * cam-465-bulk-availability-real-guard.test.ts — CAM-465, integration-style
 * coverage that keeps `getRemainingCapacityForCamps` REAL (unmocked) — only
 * the underlying Prisma calls are mocked (same shape as
 * `__tests__/cam-427-remaining-capacity-batched.test.ts`). This proves two
 * things the fully-mocked `cam-465-bulk-availability.test.ts` cannot:
 *
 *   1. EC-6/Decision 2 — the per-range MAX_STATUS_RANGE_NIGHTS (366) guard,
 *      one layer down inside the REAL batched core, actually fires for a
 *      single absurd range reaching `bulkAvailability` — fails open to an
 *      'unknown' cell, never throws, never hangs the event loop (CAM-344
 *      class), and never blocks the rest of the matrix.
 *   2. ADR-009 no-forked-data-path parity — a normal range's numbers come
 *      from the SAME derivation `getRemainingCapacityForCamps`/
 *      `getRemainingCapacity`/`searchCampsites`'s "เหลือ N ที่" already use;
 *      bulkAvailability introduces no parallel availability math.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: { findMany: vi.fn() },
    booking: { findMany: vi.fn() },
    blockedDate: { findMany: vi.fn() },
    internalHold: { findMany: vi.fn() },
    spot: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { MAX_STATUS_RANGE_NIGHTS } from '@/lib/campsite-availability';
import { executeBulkAvailability, bulkAvailabilityArgsSchema } from '@/lib/ai/tools/bulk-availability';

const CAMP_A = 'aaaaaaaa-0000-4000-8000-000000000465';

function candidateRow(id: string) {
  return { id, reviewCount: 0, location: { province: 'Chiang Mai' }, options: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

describe('bulkAvailability — real 366-night guard inherited (EC-6, Decision 2, CAM-344)', () => {
  it('[boundary] a single range wider than MAX_STATUS_RANGE_NIGHTS fails open to an unknown cell — never throws, never a per-night loop', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([candidateRow(CAMP_A)]); // candidate query only

    const start = new Date('2026-01-01T00:00:00.000Z');
    const wideEnd = new Date(start);
    wideEnd.setUTCDate(wideEnd.getUTCDate() + MAX_STATUS_RANGE_NIGHTS + 10);

    const args = bulkAvailabilityArgsSchema.parse({
      dates: [{ startDate: start.toISOString().slice(0, 10), endDate: wideEnd.toISOString().slice(0, 10) }],
    });

    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.camps).toHaveLength(1);
      expect(result.camps[0].cells).toEqual([{ status: 'unknown' }]);
    }
    // the guard rejects BEFORE the 5 grouped queries — campSite.findMany was
    // called ONLY once (the candidate query), never a 2nd time for capacity.
    expect(prisma.campSite.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it('[normal] a second, normal-width range in the SAME request still computes live status (the guard fails open per-range, not for the whole matrix)', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([candidateRow(CAMP_A)]) // candidate query
      .mockResolvedValueOnce([{ id: CAMP_A, useSpotView: false, maxGuestsPerDay: 20 }]); // capacity lookup for range 2 only

    const start = new Date('2026-01-01T00:00:00.000Z');
    const wideEnd = new Date(start);
    wideEnd.setUTCDate(wideEnd.getUTCDate() + MAX_STATUS_RANGE_NIGHTS + 10);

    const args = bulkAvailabilityArgsSchema.parse({
      dates: [
        { startDate: start.toISOString().slice(0, 10), endDate: wideEnd.toISOString().slice(0, 10) },
        { startDate: '2026-09-10', endDate: '2026-09-11' },
      ],
    });

    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.camps[0].cells).toEqual([{ status: 'unknown' }, { status: 'free', remaining: 20 }]);
    }
  });
});

describe('bulkAvailability — real batched core parity (ADR-009 no-forked-data-path)', () => {
  it('[normal] a normal range computes real remaining via the SAME batched core getRemainingCapacity/searchCampsites use', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([candidateRow(CAMP_A)]) // candidate query
      .mockResolvedValueOnce([{ id: CAMP_A, useSpotView: false, maxGuestsPerDay: 20 }]); // capacity lookup
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        campSiteId: CAMP_A,
        checkInDate: new Date('2026-09-10T00:00:00.000Z'),
        checkOutDate: new Date('2026-09-11T00:00:00.000Z'),
        guests: 6,
      },
    ]);

    const args = bulkAvailabilityArgsSchema.parse({
      dates: [{ startDate: '2026-09-10', endDate: '2026-09-11' }],
    });

    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // capacity 20 - booked 6 = 14, identical to CAM-427's own
      // getRemainingCapacityForCamps assertion for the same fixture shape.
      expect(result.camps[0].cells).toEqual([{ status: 'free', remaining: 14 }]);
    }
  });

  it('[boundary] a whole-camp BlockedDate forces the cell to full regardless of numeric headroom (parity with getRemainingCapacity)', async () => {
    (prisma.campSite.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([candidateRow(CAMP_A)])
      .mockResolvedValueOnce([{ id: CAMP_A, useSpotView: false, maxGuestsPerDay: 20 }]);
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { campSiteId: CAMP_A, startDate: new Date('2026-09-10T00:00:00.000Z'), endDate: new Date('2026-09-10T00:00:00.000Z') },
    ]);

    const args = bulkAvailabilityArgsSchema.parse({
      dates: [{ startDate: '2026-09-10', endDate: '2026-09-11' }],
    });

    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.camps[0].cells).toEqual([{ status: 'full' }]);
  });
});
