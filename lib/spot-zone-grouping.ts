// CAM-361 — pure grouping helper for the embedded/standalone spot list
// (components/spot-management-section.tsx). Extracted as a standalone
// function (no React, no i18n) so it gets real behavioral unit tests
// (__tests__/cam-361-spot-zone-grouping.test.ts) rather than only
// source-inspection, per the project's node-env vitest constraint.

import type { SpotDTO } from "@/types/api";

/** Sentinel group key for spots with no zone set (null / empty / whitespace-only). */
export const UNASSIGNED_ZONE_KEY = "__unassigned__";

export interface SpotZoneGroup {
  /** The trimmed zone string, or UNASSIGNED_ZONE_KEY for the no-zone bucket. */
  key: string;
  /** True only for the catch-all "no zone" bucket. */
  isUnassigned: boolean;
  spots: SpotDTO[];
}

/**
 * Groups spots by their free-text `zone` field.
 *
 * Order: each named zone appears in the order it FIRST occurs in `spots`
 * (stable, not alphabetical) — spots with no zone (undefined / empty /
 * whitespace-only) are collected into one catch-all bucket that always
 * sorts LAST, regardless of where those spots sit in the input order.
 * A zone with no live spots is never present (no empty groups).
 */
export function groupSpotsByZone(spots: SpotDTO[]): SpotZoneGroup[] {
  const zoneOrder: string[] = [];
  const byZone = new Map<string, SpotDTO[]>();
  const unassigned: SpotDTO[] = [];

  for (const spot of spots) {
    const zone = spot.zone?.trim();
    if (!zone) {
      unassigned.push(spot);
      continue;
    }
    if (!byZone.has(zone)) {
      byZone.set(zone, []);
      zoneOrder.push(zone);
    }
    byZone.get(zone)!.push(spot);
  }

  const groups: SpotZoneGroup[] = zoneOrder.map((key) => ({
    key,
    isUnassigned: false,
    spots: byZone.get(key) as SpotDTO[],
  }));

  if (unassigned.length > 0) {
    groups.push({ key: UNASSIGNED_ZONE_KEY, isUnassigned: true, spots: unassigned });
  }

  return groups;
}
