import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { adminAreaChainSelect, resolveLocationDisplayNames } from '@/lib/read-models/camp-card';

/**
 * A client capable of reading the Spot table — either the default `prisma`
 * singleton or a `Prisma.TransactionClient`. CAM-355 (BR-4 perf): allowing a
 * tx-client variant lets the booking write gate (lib/campsite-availability.ts
 * checkDateAvailabilityInTx) read the SAME derivation INSIDE its serializable
 * transaction (snapshot-consistent, EC-1/EC-2) instead of forking a parallel
 * sum (ADR-009).
 */
type SpotQueryClient = PrismaClient | Prisma.TransactionClient;

/**
 * CAM-355 BR-1/ADR-009: the ONE summing formula every PER-SPOT capacity
 * consumer shares — calculateSpotCapacity (single camp, below) and the
 * batched multi-camp spot-sum in lib/campsite-availability.ts
 * (getAvailabilityStatusForCamps, BR-5 — one grouped query per page, never
 * per-camp). Both callers apply the `deletedAt: null` filter (BR-3) at their
 * own query boundary before handing rows here; this function only sums. A
 * spot with a null per-spot value contributes 0 (BR-1).
 */
export function sumSpotCapacity(
  spots: { maxCampers: number | null; maxTents: number | null }[]
): { maxGuestsPerDay: number; maxTentsPerDay: number } {
  return {
    maxGuestsPerDay: spots.reduce((sum, spot) => sum + (spot.maxCampers || 0), 0),
    maxTentsPerDay: spots.reduce((sum, spot) => sum + (spot.maxTents || 0), 0),
  };
}

/**
 * Calculate capacity from spots for a camp site
 * Returns aggregated data: total spots, max guests, max tents, and ground type breakdown
 *
 * `client` defaults to the global `prisma` singleton (every pre-existing
 * caller); pass a `Prisma.TransactionClient` to read inside a serializable
 * transaction (CAM-355 BR-4 — the booking/hold write gate's per-spot sum).
 */
export async function calculateSpotCapacity(campSiteId: string, client: SpotQueryClient = prisma) {
  // CAM-352 BR-1/EC-4: a soft-deleted spot must not count toward the derived
  // capacity — otherwise the camper-facing detail page overstates
  // maxGuestsPerDay/maxTentsPerDay after a host deletes a spot.
  const spots = await client.spot.findMany({
    where: { campSiteId, deletedAt: null },
    select: {
      maxCampers: true,
      maxTents: true,
      environment: true,
    }
  });

  // Calculate totals
  const totalSpots = spots.length;
  const { maxGuestsPerDay, maxTentsPerDay } = sumSpotCapacity(spots);

  // Group by ground type from environment field
  // Environment field may contain ground type info (STONE, GRASS, CONCRETE, WOOD)
  // Count spots - for now, we'll count total spots as ground type breakdown
  // In the future, if Spot model has a dedicated groundType field, use that instead
  // For now, we'll just return total spots count
  // Ground type breakdown will need to be added to Spot model later if needed

  return {
    totalSpots,
    maxGuestsPerDay,
    maxTentsPerDay,
    groundType: undefined, // Will be calculated from Spot groundType field when added
  };
}

/**
 * Get camp site with calculated capacity based on useSpotView flag
 */
export async function getCampSiteWithCapacity(campSiteId: string) {
  const campSite = await prisma.campSite.findUnique({
    where: { id: campSiteId },
    include: {
      // CAM-352 BR-1/EC-4: exclude soft-deleted spots from the detail payload's
      // own spots array too (keeps it consistent with the list/aggregation).
      spots: { where: { deletedAt: null } },
      options: true,
      images: { orderBy: { sortOrder: 'asc' } },
      // CAM-574: the retired `thaiLocation` FK relation is replaced by the
      // resolved AdminArea chain — CampgroundForm's edit prefill reads the
      // bilingual `provinceTh`/`provinceEn`/`districtTh`/`districtEn` fields
      // attached below (resolveLocationDisplayNames), never the chain
      // directly (this module is server-only; the chain's own
      // `lib/read-models/camp-card.ts` import pulls in `next/cache`, which
      // cannot ride into CampgroundForm.tsx, a client component).
      location: {
        include: {
          adminArea: { select: adminAreaChainSelect },
        },
      },
    }
  });

  if (!campSite) {
    return null;
  }

  const location = campSite.location
    ? { ...campSite.location, ...resolveLocationDisplayNames(campSite.location.adminArea) }
    : campSite.location;

  // If useSpotView is true, calculate from spots
  if (campSite.useSpotView) {
    const spotCapacity = await calculateSpotCapacity(campSiteId);
    return {
      ...campSite,
      location,
      // CAM-355 BR-6 fold-in: NO `|| campSite.maxGuestsPerDay/maxTentsPerDay`
      // fallback — a zero-spot (or all-null) PER-SPOT camp derives 0, a REAL
      // closed-for-booking capacity, not the stale manual column. This is the
      // same effective-capacity rule the enforcement readers in
      // lib/campsite-availability.ts use (getEffectiveCapacity) — display and
      // enforcement now agree (previously this fallback made the display show
      // a stale non-zero column while the write gate would derive 0).
      maxGuestsPerDay: spotCapacity.maxGuestsPerDay,
      maxTentsPerDay: spotCapacity.maxTentsPerDay,
      groundType: spotCapacity.groundType
        ? JSON.stringify(spotCapacity.groundType)
        : campSite.groundType,
      // Include spot statistics
      spotStats: {
        totalSpots: spotCapacity.totalSpots,
        groundTypeBreakdown: spotCapacity.groundType,
      }
    };
  }

  // If useSpotView is false, use manual values
  return {
    ...campSite,
    location,
    spotStats: null,
  };
}
