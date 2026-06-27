import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { getCampSiteDailyAvailability } from '@/lib/campsite-availability';
import { auth } from '@/lib/auth';
import { isCampSitePublic, canViewCampSite } from '@/lib/campsite-visibility';

// CAM-190: opt out of static generation so every request runs the handler live.
// Paired with the explicit Cache-Control: no-store header on the response.
export const dynamic = 'force-dynamic';

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

    // Get camp site — include visibility fields so the gate can be applied.
    const campSite = await prisma.campSite.findUnique({
      where: { id },
      select: {
        isActive: true,
        isPublished: true,
        deletedAt: true,
        operatorId: true,
        maxGuestsPerDay: true,
        maxTentsPerDay: true,
      }
    });

    if (!campSite) {
      return apiError('Camp site not found', 404);
    }

    // SEC-1: gate non-public campsites. Auth is lazy — only called when the camp
    // is not public so the hot path (public camp) pays zero auth overhead.
    if (!isCampSitePublic(campSite)) {
      const session = await auth();
      if (!canViewCampSite(campSite, session)) {
        // 404 not 403 — no information-disclosure.
        return apiError('Camp site not found', 404);
      }
    }

    // Get daily availability
    const availability = await getCampSiteDailyAvailability(id, start, end);

    // Format response with availability status
    // available = false when capacity-exceeded OR blocked by host (CAM-190 AVAIL-1).
    const formatted = Object.entries(availability).map(([date, data]) => {
      const isCapacityFull =
        (campSite.maxGuestsPerDay && data.bookedGuests >= campSite.maxGuestsPerDay) ||
        (campSite.maxTentsPerDay && data.bookedTents >= campSite.maxTentsPerDay);

      return {
        date,
        bookedGuests: data.bookedGuests,
        bookedTents: data.bookedTents,
        maxGuests: campSite.maxGuestsPerDay,
        maxTents: campSite.maxTentsPerDay,
        available: !isCapacityFull && !data.blockedByHost,
        remainingGuests: campSite.maxGuestsPerDay ? campSite.maxGuestsPerDay - data.bookedGuests : null,
        remainingTents: campSite.maxTentsPerDay ? campSite.maxTentsPerDay - data.bookedTents : null,
        blockedByHost: data.blockedByHost,
      };
    });

    // CAM-190: explicit no-store so the calendar always reflects live availability.
    const response = apiSuccess({
      campSiteId: id,
      availability: formatted,
      limits: {
        maxGuestsPerDay: campSite.maxGuestsPerDay,
        maxTentsPerDay: campSite.maxTentsPerDay
      }
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    return apiError('Failed to fetch availability', 500, error);
  }
}
