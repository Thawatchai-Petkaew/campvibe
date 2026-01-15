import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { getCampSiteDailyAvailability } from '@/lib/campsite-availability';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return apiError('Missing startDate or endDate parameters', 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get camp site to check limits
    const campSite = await prisma.campSite.findUnique({
      where: { id },
      select: {
        maxGuestsPerDay: true,
        maxTentsPerDay: true
      }
    });

    if (!campSite) {
      return apiError('Campground not found', 404);
    }

    // Get daily availability
    const availability = await getCampSiteDailyAvailability(id, start, end);

    // Format response with availability status
    const formatted = Object.entries(availability).map(([date, data]) => {
      const isFull = 
        (campSite.maxGuestsPerDay && data.bookedGuests >= campSite.maxGuestsPerDay) ||
        (campSite.maxTentsPerDay && data.bookedTents >= campSite.maxTentsPerDay);

      return {
        date,
        guests: data.bookedGuests,
        tents: data.bookedTents,
        maxGuests: campSite.maxGuestsPerDay,
        maxTents: campSite.maxTentsPerDay,
        available: !isFull,
        remainingGuests: campSite.maxGuestsPerDay ? campSite.maxGuestsPerDay - data.bookedGuests : null,
        remainingTents: campSite.maxTentsPerDay ? campSite.maxTentsPerDay - data.bookedTents : null
      };
    });

    return apiSuccess({
      campgroundId: id,
      availability: formatted,
      limits: {
        maxGuestsPerDay: campSite.maxGuestsPerDay,
        maxTentsPerDay: campSite.maxTentsPerDay
      }
    });
  } catch (error) {
    return apiError('Failed to fetch availability', 500, error);
  }
}
