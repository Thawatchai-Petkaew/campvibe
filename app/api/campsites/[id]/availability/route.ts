import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { getCampSiteDailyAvailability, getEffectiveCapacity } from '@/lib/campsite-availability';
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
        useSpotView: true,
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

    // CAM-355 (G3 Important-1): this is the 5th capacity reader the story's
    // inventory missed — the camper date-picker (isDateDisabled) and the host
    // availability calendar both consume this route's isCapacityFull/available/
    // remainingGuests/limits, so a PER-SPOT camp with a stale column must not
    // drive them. Effective capacity is derived ONCE per request here (hoisted,
    // not once per day) via the SAME getEffectiveCapacity helper the write gate
    // and the badge/remaining-capacity readers use (ADR-009, one derivation).
    //
    // Fail-OPEN (unlike the booking write gate's fail-CLOSED): this route is a
    // DISPLAY reader (a calendar signal), so a spot-sum read failure must not
    // 500 the calendar — it mirrors the getAvailabilityStatusForCamps badge
    // contract and keeps serving the raw (possibly stale) column value instead.
    let effectiveGuests = campSite.maxGuestsPerDay;
    let effectiveTents = campSite.maxTentsPerDay;
    if (campSite.useSpotView) {
      try {
        const effective = await getEffectiveCapacity(prisma, {
          id,
          useSpotView: true,
          maxGuestsPerDay: campSite.maxGuestsPerDay,
          maxTentsPerDay: campSite.maxTentsPerDay,
        });
        effectiveGuests = effective.maxGuestsPerDay;
        effectiveTents = effective.maxTentsPerDay;
      } catch (error) {
        console.error('[CAM-355] effective capacity read failed for the availability calendar (fail-open, column-derived)', error);
        // effectiveGuests/effectiveTents stay the raw column values set above.
      }
    }

    // Get daily availability
    const availability = await getCampSiteDailyAvailability(id, start, end);

    // Format response with availability status
    // available = false when capacity-exceeded OR blocked by host (CAM-190 AVAIL-1).
    // CAM-302 (ADR-012 §4): this route re-derives every field by explicit
    // enumeration rather than spreading the daily-availability object, so
    // heldGuests must be threaded through here explicitly or an ACTIVE hold
    // would silently never reduce "เหลือ {n} ที่" on the calendar (the story's
    // Seams & refs "CAM-342 trap" — see lib/campsite-availability.ts).
    const formatted = Object.entries(availability).map(([date, data]) => {
      // CAM-400 BR-1/BR-3: the invariant (null = unlimited, 0 = closed/full)
      // is uniform across the whole seam now. WHOLE-CAMP previously kept the
      // pre-CAM-355 truthy-gate (BR-8) that read a 0 column as "no cap" —
      // disagreeing with getRemainingCapacity/getAvailabilityStatusForCamps
      // (both already `!== null`) and the write gate (fixed alongside this).
      // PER-SPOT was already null-check (BR-6); both branches now match.
      const isCapacityFull = campSite.useSpotView
        ? (
            (effectiveGuests !== null && (data.bookedGuests + data.heldGuests) >= effectiveGuests) ||
            (effectiveTents !== null && data.bookedTents >= effectiveTents)
          )
        : (
            (campSite.maxGuestsPerDay !== null && (data.bookedGuests + data.heldGuests) >= campSite.maxGuestsPerDay) ||
            (campSite.maxTentsPerDay !== null && data.bookedTents >= campSite.maxTentsPerDay)
          );

      return {
        date,
        bookedGuests: data.bookedGuests,
        heldGuests: data.heldGuests,
        bookedTents: data.bookedTents,
        maxGuests: effectiveGuests,
        maxTents: effectiveTents,
        available: !isCapacityFull && !data.blockedByHost,
        remainingGuests: campSite.useSpotView
          ? (effectiveGuests !== null ? effectiveGuests - (data.bookedGuests + data.heldGuests) : null)
          : (campSite.maxGuestsPerDay !== null ? campSite.maxGuestsPerDay - (data.bookedGuests + data.heldGuests) : null),
        remainingTents: campSite.useSpotView
          ? (effectiveTents !== null ? effectiveTents - data.bookedTents : null)
          : (campSite.maxTentsPerDay !== null ? campSite.maxTentsPerDay - data.bookedTents : null),
        blockedByHost: data.blockedByHost,
      };
    });

    // CAM-190: explicit no-store so the calendar always reflects live availability.
    const response = apiSuccess({
      campSiteId: id,
      availability: formatted,
      limits: {
        maxGuestsPerDay: effectiveGuests,
        maxTentsPerDay: effectiveTents
      }
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    return apiError('Failed to fetch availability', 500, error);
  }
}
