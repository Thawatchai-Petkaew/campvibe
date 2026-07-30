import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api-utils';
import {
  getCampSiteDailyAvailability,
  getEffectiveCapacity,
  getSpotDailyAvailability,
  AvailabilityRangeTooWideError,
} from '@/lib/campsite-availability';
import { auth } from '@/lib/auth';
import { isCampSitePublic, canViewCampSite } from '@/lib/campsite-visibility';

// CAM-665: validated at the boundary — re-parsed here (not lib/validations/*,
// this story's allowed file surface is deliberately narrow) before it ever
// reaches a Prisma query. Format-invalid → 400; existence/ownership is a
// second, DB-backed check below (also 400 — never a silent drop, CAM-595/602).
const spotIdQuerySchema = z.string().uuid();

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

    // CAM-665: optional spotId — ask "is THIS pitch free", not just the camp.
    // 1. Validate at the boundary (format) BEFORE any DB call. An unknown/
    //    invalid spotId is always a 400 — never a silently-dropped filter
    //    (CAM-595/602: a client must be able to tell "honoured and empty"
    //    from "ignored and everything").
    const spotIdParam = searchParams.get('spotId');
    let requestedSpotId: string | null = null;
    if (spotIdParam !== null) {
      const parsedSpotId = spotIdQuerySchema.safeParse(spotIdParam);
      if (!parsedSpotId.success) {
        return apiError('Invalid spotId parameter', 400);
      }
      requestedSpotId = parsedSpotId.data;
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

    // 2. Existence + ownership — a well-formed but unknown/cross-camp spotId
    // is STILL a 400 (never a silent drop of the filter, same CAM-595/602
    // reasoning as the format check above), not a 404 (this route's 404 is
    // reserved for the campsite itself, per the info-disclosure gate above).
    if (requestedSpotId) {
      const spot = await prisma.spot.findFirst({
        where: { id: requestedSpotId, campSiteId: id, deletedAt: null },
        select: { id: true },
      });
      if (!spot) {
        return apiError('Invalid spotId parameter', 400);
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

    // CAM-665: per-pitch occupancy, only computed when a spotId was
    // requested + validated above. Reuses the SAME capacity module
    // (getSpotDailyAvailability) the booking write gate's spot-overlap check
    // now delegates to as well (ADR-012 §4 — one derivation, never forked).
    // This never touches the whole-camp `availability`/`effectiveGuests`
    // math computed above — a camp queried WITHOUT spotId is byte-identical
    // to before this story.
    const spotOccupancy = requestedSpotId
      ? await getSpotDailyAvailability(id, requestedSpotId, start, end)
      : null;

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
        // CAM-665: null when no spotId was requested (filter not applied —
        // distinct from `false`, which means "requested AND occupied").
        spotAvailable: spotOccupancy ? spotOccupancy[date]?.available ?? null : null,
      };
    });

    // CAM-190: explicit no-store so the calendar always reflects live availability.
    // CAM-665: `spotId` states which filter was actually applied (CAM-595/602)
    // — null = camp-level (no spot filter, response unchanged from before this
    // story); a uuid = this pitch's occupancy is folded into `spotAvailable`
    // on every day above.
    const response = apiSuccess({
      campSiteId: id,
      spotId: requestedSpotId,
      availability: formatted,
      limits: {
        maxGuestsPerDay: effectiveGuests,
        maxTentsPerDay: effectiveTents
      }
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    // CAM-401 AC-2: an absurd startDate/endDate span (>MAX_STATUS_RANGE_NIGHTS)
    // is rejected as a validation error, not a generic 500 — no stack/detail
    // leaked either way (apiError only exposes `details` on 4xx, and this
    // path never passes any).
    if (error instanceof AvailabilityRangeTooWideError) {
      return apiError('Date range too wide', 400);
    }
    return apiError('Failed to fetch availability', 500, error);
  }
}
