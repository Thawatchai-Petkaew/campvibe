/**
 * cam-361-spot-zone-grouping.test.ts — real behavioral unit tests for the
 * pure zone-grouping helper (lib/spot-zone-grouping.ts) that backs the
 * embedded + standalone spot section (components/spot-management-section.tsx).
 *
 * Coverage matrix: normal · null/empty · boundary (whitespace-only, dedup) ·
 * ordering (first-appearance stable, unassigned always last regardless of
 * input interleaving).
 */

import { describe, it, expect } from 'vitest';
import { groupSpotsByZone, UNASSIGNED_ZONE_KEY } from '@/lib/spot-zone-grouping';
import type { SpotDTO } from '@/types/api';

function makeSpot(id: string, zone?: string): SpotDTO {
  return {
    id,
    zone,
    name: `Spot ${id}`,
    pricePerNight: 100,
    campSiteId: 'camp-1',
  };
}

describe('groupSpotsByZone — normal grouping', () => {
  it('[normal] groups spots under their zone, one group per distinct zone', () => {
    const spots = [makeSpot('1', 'Zone A'), makeSpot('2', 'Zone B'), makeSpot('3', 'Zone A')];

    const groups = groupSpotsByZone(spots);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ key: 'Zone A', isUnassigned: false });
    expect(groups[0].spots.map((s) => s.id)).toEqual(['1', '3']);
    expect(groups[1]).toMatchObject({ key: 'Zone B', isUnassigned: false });
    expect(groups[1].spots.map((s) => s.id)).toEqual(['2']);
  });

  it('[normal] orders named zones by first appearance, not alphabetically', () => {
    const spots = [makeSpot('1', 'Zebra'), makeSpot('2', 'Apple')];

    const groups = groupSpotsByZone(spots);

    expect(groups.map((g) => g.key)).toEqual(['Zebra', 'Apple']);
  });
});

describe('groupSpotsByZone — null/empty handling', () => {
  it('[null/empty] a spot with no zone lands in the unassigned bucket', () => {
    const spots = [makeSpot('1', undefined)];

    const groups = groupSpotsByZone(spots);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: UNASSIGNED_ZONE_KEY, isUnassigned: true });
    expect(groups[0].spots.map((s) => s.id)).toEqual(['1']);
  });

  it('[null/empty] an empty-string zone also lands in the unassigned bucket', () => {
    const groups = groupSpotsByZone([makeSpot('1', '')]);

    expect(groups[0].isUnassigned).toBe(true);
  });

  it('[boundary] a whitespace-only zone normalizes to unassigned (trimmed)', () => {
    const groups = groupSpotsByZone([makeSpot('1', '   ')]);

    expect(groups[0].isUnassigned).toBe(true);
  });

  it('[boundary] a zone value is trimmed before use as the group key/label', () => {
    const groups = groupSpotsByZone([makeSpot('1', '  Zone A  ')]);

    expect(groups[0].key).toBe('Zone A');
  });

  it('[null/empty] an empty spot list returns an empty group list, never throws', () => {
    expect(groupSpotsByZone([])).toEqual([]);
  });
});

describe('groupSpotsByZone — unassigned bucket always sorts last', () => {
  it('[ordering] unassigned spots interleaved with named zones still group last', () => {
    const spots = [
      makeSpot('1', undefined),
      makeSpot('2', 'Zone A'),
      makeSpot('3', undefined),
      makeSpot('4', 'Zone B'),
    ];

    const groups = groupSpotsByZone(spots);

    expect(groups.map((g) => g.key)).toEqual(['Zone A', 'Zone B', UNASSIGNED_ZONE_KEY]);
    expect(groups[2].spots.map((s) => s.id)).toEqual(['1', '3']);
  });

  it('[ordering] an all-unassigned camp yields exactly one bucket (no empty named groups)', () => {
    const groups = groupSpotsByZone([makeSpot('1'), makeSpot('2')]);

    expect(groups).toHaveLength(1);
    expect(groups[0].isUnassigned).toBe(true);
    expect(groups[0].spots).toHaveLength(2);
  });
});
