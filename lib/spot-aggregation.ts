import { prisma } from '@/lib/prisma';

/**
 * Calculate capacity from spots for a camp site
 * Returns aggregated data: total spots, max guests, max tents, and ground type breakdown
 */
export async function calculateSpotCapacity(campSiteId: string) {
  const spots = await prisma.spot.findMany({
    where: { campSiteId },
    select: {
      maxCampers: true,
      maxTents: true,
      environment: true,
    }
  });

  // Calculate totals
  const totalSpots = spots.length;
  const maxGuestsPerDay = spots.reduce((sum, spot) => sum + (spot.maxCampers || 0), 0);
  const maxTentsPerDay = spots.reduce((sum, spot) => sum + (spot.maxTents || 0), 0);

  // Group by ground type from environment field
  // Environment field may contain ground type info (STONE, GRASS, CONCRETE, WOOD)
  const groundTypeCount: Record<string, number> = {};
  
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
      spots: true,
      location: {
        include: {
          thaiLocation: true
        }
      }
    }
  });

  if (!campSite) {
    return null;
  }

  // If useSpotView is true, calculate from spots
  if (campSite.useSpotView) {
    const spotCapacity = await calculateSpotCapacity(campSiteId);
    return {
      ...campSite,
      // Override capacity fields with calculated values
      maxGuestsPerDay: spotCapacity.maxGuestsPerDay || campSite.maxGuestsPerDay,
      maxTentsPerDay: spotCapacity.maxTentsPerDay || campSite.maxTentsPerDay,
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
    spotStats: null,
  };
}
