import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Returns BlockedDate rows that overlap [startDate, endDate] for the given
 * campSiteId, applying the IDENTICAL predicate used by the booking write path
 * (app/api/bookings/route.ts lines 93–104, CAM-57 / ADR-006).
 *
 * spotId: when provided, also includes spot-level blocks for that spot.
 * When omitted (campsite-level availability), only whole-camp blocks (spotId null) are returned.
 *
 * PRIVACY DECISION (CAM-190, owner-delegated): reason field is intentionally NOT
 * returned to callers — guests see only a blockedByHost boolean flag, not the
 * host's free-text notes.
 */
export async function getBlockedDatesForRange(
  campSiteId: string,
  startDate: Date,
  endDate: Date,
  spotId?: string
): Promise<{ startDate: Date; endDate: Date }[]> {
  return prisma.blockedDate.findMany({
    where: {
      campSiteId,
      deletedAt: null,
      OR: [
        { spotId: null },
        ...(spotId ? [{ spotId }] : []),
      ],
      AND: [
        { startDate: { lte: endDate } },
        { endDate: { gte: startDate } },
      ],
    },
    select: { startDate: true, endDate: true },
  });
}

/**
 * Get daily availability for a camp site
 * Returns guests and tents booked for each date, plus host BlockedDate coverage.
 */
export async function getCampSiteDailyAvailability(
  campSiteId: string,
  startDate: Date,
  endDate: Date
) {
  const bookings = await prisma.booking.findMany({
    where: {
      campSiteId,
      status: { in: ['CONFIRMED', 'PENDING'] }, // Only count confirmed and pending bookings
      AND: [
        { checkInDate: { lte: endDate } },
        { checkOutDate: { gte: startDate } }
      ]
    },
    select: {
      checkInDate: true,
      checkOutDate: true,
      guests: true,
      status: true
    }
  });

  // Group by date
  const availability: Record<string, { bookedGuests: number; bookedTents: number; blockedByHost: boolean }> = {};

  // Initialize all dates in range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    availability[dateKey] = { bookedGuests: 0, bookedTents: 0, blockedByHost: false };
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calculate bookings per day
  bookings.forEach(booking => {
    const checkIn = new Date(booking.checkInDate);
    const checkOut = new Date(booking.checkOutDate);

    // Count each day in the booking range
    const date = new Date(checkIn);
    while (date < checkOut) {
      const dateKey = date.toISOString().split('T')[0];
      if (availability[dateKey]) {
        availability[dateKey].bookedGuests += booking.guests;
        // Estimate tents: assume 2 guests per tent on average
        availability[dateKey].bookedTents += Math.ceil(booking.guests / 2);
      }
      date.setDate(date.getDate() + 1);
    }
  });

  // Apply host BlockedDate ranges (one query for the full range — no N+1).
  // Predicate is IDENTICAL to the booking write path (app/api/bookings/route.ts
  // lines 93–104, CAM-57 / ADR-006). Camp-level only (no spotId here).
  const blockedRanges = await getBlockedDatesForRange(campSiteId, startDate, endDate);

  for (const block of blockedRanges) {
    const cur = new Date(block.startDate);
    const blockEnd = new Date(block.endDate);
    while (cur <= blockEnd && cur <= endDate) {
      const dateKey = cur.toISOString().split('T')[0];
      if (availability[dateKey]) {
        availability[dateKey].blockedByHost = true;
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  return availability;
}

/**
 * Check if a date is available for booking
 */
export async function checkDateAvailability(
  campSiteId: string,
  date: Date,
  requestedGuests: number,
  requestedTents?: number
) {
  const campSite = await prisma.campSite.findUnique({
    where: { id: campSiteId },
    select: {
      maxGuestsPerDay: true,
      maxTentsPerDay: true
    }
  });

  if (!campSite) {
    return { available: false, reason: 'Camp site not found' };
  }

  // Get availability for the date
  const dateKey = date.toISOString().split('T')[0];
  const availability = await getCampSiteDailyAvailability(
    campSiteId,
    date,
    date
  );

  const current = availability[dateKey] || { bookedGuests: 0, bookedTents: 0 };

  // Check guests limit
  if (campSite.maxGuestsPerDay) {
    const totalGuests = current.bookedGuests + requestedGuests;
    if (totalGuests > campSite.maxGuestsPerDay) {
      return {
        available: false,
        reason: `Exceeds maximum guests per day (${campSite.maxGuestsPerDay})`,
        current: current.bookedGuests,
        max: campSite.maxGuestsPerDay
      };
    }
  }

  // Check tents limit
  if (campSite.maxTentsPerDay && requestedTents) {
    const estimatedTents = Math.ceil(requestedGuests / 2);
    const totalTents = current.bookedTents + estimatedTents;
    if (totalTents > campSite.maxTentsPerDay) {
      return {
        available: false,
        reason: `Exceeds maximum tents per day (${campSite.maxTentsPerDay})`,
        current: current.bookedTents,
        max: campSite.maxTentsPerDay
      };
    }
  }

  return {
    available: true,
    current: {
      guests: current.bookedGuests,
      tents: current.bookedTents
    },
    max: {
      guests: campSite.maxGuestsPerDay,
      tents: campSite.maxTentsPerDay
    }
  };
}

/**
 * Transactional variant of checkDateAvailability.
 * Must be called inside a prisma.$transaction callback with the tx client.
 * Reads execute within the serializable transaction boundary so Postgres can
 * detect conflicting concurrent writes and issue a serialization failure (P2034).
 *
 * The existing `checkDateAvailability` and `getCampSiteDailyAvailability` exports
 * are NOT changed — GET-availability callers are unaffected.
 */
export async function checkDateAvailabilityInTx(
  tx: Prisma.TransactionClient,
  campSiteId: string,
  date: Date,
  requestedGuests: number,
  requestedTents?: number
): Promise<{ available: boolean; reason?: string }> {
  const campSite = await tx.campSite.findUnique({
    where: { id: campSiteId },
    select: { maxGuestsPerDay: true, maxTentsPerDay: true },
  });

  if (!campSite) {
    return { available: false, reason: 'Camp site not found' };
  }

  const dateKey = date.toISOString().split('T')[0];

  // Fetch all active bookings that overlap with the target date (inside tx).
  const bookings = await tx.booking.findMany({
    where: {
      campSiteId,
      status: { in: ['CONFIRMED', 'PENDING'] },
      AND: [
        { checkInDate: { lte: date } },
        { checkOutDate: { gt: date } },
      ],
    },
    select: { checkInDate: true, checkOutDate: true, guests: true },
  });

  // Sum guests/tents booked for this exact date (mirrors getCampSiteDailyAvailability logic).
  let bookedGuests = 0;
  let bookedTents = 0;
  for (const b of bookings) {
    const d = new Date(b.checkInDate);
    while (d < new Date(b.checkOutDate)) {
      if (d.toISOString().split('T')[0] === dateKey) {
        bookedGuests += b.guests;
        bookedTents += Math.ceil(b.guests / 2);
      }
      d.setDate(d.getDate() + 1);
    }
  }

  if (campSite.maxGuestsPerDay && bookedGuests + requestedGuests > campSite.maxGuestsPerDay) {
    return {
      available: false,
      reason: `Exceeds maximum guests per day (${campSite.maxGuestsPerDay})`,
    };
  }

  if (campSite.maxTentsPerDay && requestedTents) {
    const estimatedTents = Math.ceil(requestedGuests / 2);
    if (bookedTents + estimatedTents > campSite.maxTentsPerDay) {
      return {
        available: false,
        reason: `Exceeds maximum tents per day (${campSite.maxTentsPerDay})`,
      };
    }
  }

  return { available: true };
}
