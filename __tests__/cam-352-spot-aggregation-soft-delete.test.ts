/**
 * cam-352-spot-aggregation-soft-delete.test.ts — CAM-352 G3 review fix
 * (Important): derived capacity must exclude soft-deleted spots (BR-1/EC-4).
 *
 * Pre-CAM-352 the DELETE route hard-deleted a spot, so a deleted spot could
 * never survive as a row for `calculateSpotCapacity`/`getCampSiteWithCapacity`
 * to over-count. CAM-352 switched DELETE to a soft-delete (sets `deletedAt`),
 * which exposed this trap: without an explicit filter here, a soft-deleted
 * spot's `maxCampers`/`maxTents` would still sum into the camper-facing
 * `maxGuestsPerDay`/`maxTentsPerDay` on a `useSpotView` camp, and
 * `spotStats.totalSpots` would over-count too. Both functions now filter
 * `deletedAt: null` explicitly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    spot: {
      findMany: vi.fn(),
    },
    campSite: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { calculateSpotCapacity, getCampSiteWithCapacity } from '@/lib/spot-aggregation';

const CAMPSITE_ID = '550e8400-e29b-41d4-a716-446655440000';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('calculateSpotCapacity — excludes soft-deleted spots (BR-1/EC-4)', () => {
  it('queries spot.findMany with deletedAt: null (the filter a real soft-deleted row must never pass)', async () => {
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await calculateSpotCapacity(CAMPSITE_ID);

    const call = (prisma.spot.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where).toEqual({ campSiteId: CAMPSITE_ID, deletedAt: null });
  });

  it('fixture: one live + one soft-deleted spot -> derived totals count only the live spot', async () => {
    // The `deletedAt: null` where-clause (asserted above) means a real Postgres
    // query never RETURNS the soft-deleted row in the first place — this
    // fixture represents that already-filtered result set.
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { maxCampers: 6, maxTents: 2, environment: null },
    ]);

    const result = await calculateSpotCapacity(CAMPSITE_ID);

    expect(result.totalSpots).toBe(1);
    expect(result.maxGuestsPerDay).toBe(6);
    expect(result.maxTentsPerDay).toBe(2);
  });
});

describe('getCampSiteWithCapacity — spots include + spotStats exclude soft-deleted spots (BR-1/EC-4)', () => {
  it('queries campSite.findUnique with include.spots scoped to deletedAt: null', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CAMPSITE_ID,
      useSpotView: false,
      spots: [],
      maxGuestsPerDay: 10,
      maxTentsPerDay: 5,
      groundType: null,
    });

    await getCampSiteWithCapacity(CAMPSITE_ID);

    const call = (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.include.spots).toEqual({ where: { deletedAt: null } });
  });

  it('useSpotView camp, fixture: one live + one soft-deleted spot -> maxGuestsPerDay + spotStats.totalSpots count only the live spot', async () => {
    // campSite.findUnique's `include: { spots: { where: { deletedAt: null } } }`
    // means a real query would already exclude the soft-deleted spot from
    // this row — mock represents that already-filtered shape.
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CAMPSITE_ID,
      useSpotView: true,
      spots: [{ id: 'live-spot', maxCampers: 6, maxTents: 2, deletedAt: null }],
      maxGuestsPerDay: 999, // manual fallback value — must be overridden by the derived total
      maxTentsPerDay: 999,
      groundType: null,
    });
    // calculateSpotCapacity runs its OWN spot.findMany call — same live-only fixture.
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { maxCampers: 6, maxTents: 2, environment: null },
    ]);

    const result = await getCampSiteWithCapacity(CAMPSITE_ID);

    expect(result?.maxGuestsPerDay).toBe(6);
    expect(result?.maxTentsPerDay).toBe(2);
    expect(result?.spotStats?.totalSpots).toBe(1);
  });

  it('returns null when the campsite does not exist', async () => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await getCampSiteWithCapacity(CAMPSITE_ID);

    expect(result).toBeNull();
  });
});
