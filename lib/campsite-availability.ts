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
 * CAM-302 (ADR-012 §4) — returns ACTIVE, non-expired InternalHold rows that
 * overlap [startDate, endDate] for the given campSiteId. Predicate mirrors
 * getBlockedDatesForRange exactly (same lte/gte overlap shape); the ONLY
 * addition is the lazy-expiry filter (status = ACTIVE AND expiresAt > now) —
 * an expired hold silently drops out of every read here, no cron, no row
 * rewrite (ADR-012 §4 "lazy vs cron expiry", BR-2).
 *
 * spotId is NOT filtered here (unlike getBlockedDatesForRange) — a spot-level
 * hold still counts against the camp-wide capacity bottleneck exactly like a
 * spot-level Booking already does (BR-3); there is no separate per-spot
 * capacity concept in this schema.
 */
export async function getActiveHoldsForRange(
  campSiteId: string,
  startDate: Date,
  endDate: Date
): Promise<{ startDate: Date; endDate: Date; guests: number }[]> {
  return prisma.internalHold.findMany({
    where: {
      campSiteId,
      status: 'ACTIVE',
      expiresAt: { gt: new Date() },
      AND: [
        { startDate: { lte: endDate } },
        { endDate: { gte: startDate } },
      ],
    },
    select: { startDate: true, endDate: true, guests: true },
  });
}

/**
 * Get daily availability for a camp site
 * Returns guests and tents booked for each date, plus host BlockedDate coverage
 * and held (InternalHold) guests — CAM-302, kept separate from bookedGuests
 * (ADR-012 §4: a host dashboard legitimately wants both numbers).
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
  const availability: Record<string, { bookedGuests: number; bookedTents: number; blockedByHost: boolean; heldGuests: number }> = {};

  // Initialize all dates in range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    availability[dateKey] = { bookedGuests: 0, bookedTents: 0, blockedByHost: false, heldGuests: 0 };
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

  // CAM-302 (ADR-012 §4): fold ACTIVE non-expired holds in — one query for the
  // whole range (no N+1), same shape as the booking/blockedDate loops above.
  // endDate is the EXCLUSIVE checkout day (BR-2) — identical loop shape to the
  // booking loop above (`while (date < checkOut)`), NOT the inclusive BlockedDate
  // loop shape.
  const holds = await getActiveHoldsForRange(campSiteId, startDate, endDate);

  for (const hold of holds) {
    const date = new Date(hold.startDate);
    const holdEnd = new Date(hold.endDate);
    while (date < holdEnd) {
      const dateKey = date.toISOString().split('T')[0];
      if (availability[dateKey]) {
        availability[dateKey].heldGuests += hold.guests;
      }
      date.setDate(date.getDate() + 1);
    }
  }

  return availability;
}

/**
 * Result shape for getRemainingCapacity — CAM-267 PREP-1 (+ CAM-302 heldGuests).
 */
export interface RemainingCapacityResult {
  /** CampSite.maxGuestsPerDay. null = no explicit capacity set (unbounded — never rendered as a number). */
  capacity: number | null;
  /** Booked (non-CANCELLED) guests on the bottleneck night — the night with the highest bookedGuests + heldGuests. */
  bookedGuests: number;
  /**
   * CAM-302 (ADR-012 §4): ACTIVE, non-expired InternalHold guests on that SAME
   * bottleneck night. Kept as its own labeled number, never merged into
   * bookedGuests — a host dashboard legitimately wants "X confirmed + Y on hold"
   * as two numbers, same reasoning that already keeps blockedByHost separate.
   */
  heldGuests: number;
  /**
   * capacity - (bookedGuests + heldGuests), floored at 0 (CAM-267 AC-2, extended
   * by CAM-302 to also subtract holds). null when capacity is null (unbounded,
   * nothing to subtract from) AND the range is not host-blocked. Forced to 0
   * whenever blockedByHost is true — a whole-site BlockedDate makes the site
   * unavailable for the range regardless of the numeric capacity.
   */
  remaining: number | null;
  /** true when ANY night in [startDate, endDate) is covered by a whole-camp BlockedDate (spotId: null). */
  blockedByHost: boolean;
}

/**
 * CAM-267 PREP-1: the single shared implementation for "remaining capacity" over
 * a requested stay [startDate, endDate) — nights only; the checkout day itself is
 * excluded, mirroring the booking write-path's per-night loop (app/api/bookings/
 * route.ts, Check 2: `while (capacityDate < checkOut)`).
 *
 * Built ONLY on top of getCampSiteDailyAvailability (the single source of truth
 * for bookedGuests + blockedByHost per day, CAM-190/ADR-006) — this function does
 * NOT run a second booking/blockedDate query, so it can never disagree with the
 * booking page's own math (checkDateAvailability / checkDateAvailabilityInTx read
 * the exact same per-day map).
 *
 * The bottleneck night (max bookedGuests across the stay) drives `remaining`; ANY
 * blocked night makes `blockedByHost` true and forces `remaining` to 0 (BR:
 * "BlockedDate covering a day ⇒ that day remaining=0 — whole-site block").
 *
 * PRIVACY (CAM-190 owner-delegated decision): BlockedDate.reason is never read or
 * returned here — callers get only the boolean blockedByHost flag.
 */
export async function getRemainingCapacity(
  campSiteId: string,
  startDate: Date,
  endDate: Date
): Promise<RemainingCapacityResult> {
  const campSite = await prisma.campSite.findUnique({
    where: { id: campSiteId },
    select: { maxGuestsPerDay: true },
  });

  if (!campSite) {
    return { capacity: null, bookedGuests: 0, heldGuests: 0, remaining: null, blockedByHost: false };
  }

  const capacity = campSite.maxGuestsPerDay;

  // Nights only: exclude the checkout day (a guest departing that day frees the
  // spot for a same-day arrival). A same-day / inverted range has no night to
  // check — treat as fully open; the API boundary rejects checkOut <= checkIn
  // before a real booking attempt ever reaches this function.
  const lastNight = new Date(endDate);
  lastNight.setDate(lastNight.getDate() - 1);
  if (lastNight < startDate) {
    return { capacity, bookedGuests: 0, heldGuests: 0, remaining: capacity, blockedByHost: false };
  }

  const daily = await getCampSiteDailyAvailability(campSiteId, startDate, lastNight);

  // CAM-302: the bottleneck night is now the night with the highest COMBINED
  // (bookedGuests + heldGuests) — a hold-heavy night can be the true bottleneck
  // even when its bookedGuests alone is lower than another night's. Both counts
  // reported are the ones from that same bottleneck night (kept separately
  // labeled per ADR-012 §4, never merged into one number).
  let bookedGuests = 0;
  let heldGuests = 0;
  let blockedByHost = false;
  let maxCombined = -1;
  for (const day of Object.values(daily)) {
    const combined = day.bookedGuests + day.heldGuests;
    if (combined > maxCombined) {
      maxCombined = combined;
      bookedGuests = day.bookedGuests;
      heldGuests = day.heldGuests;
    }
    if (day.blockedByHost) blockedByHost = true;
  }

  const remaining = blockedByHost
    ? 0
    : capacity !== null
      ? Math.max(0, capacity - (bookedGuests + heldGuests))
      : null;

  return { capacity, bookedGuests, heldGuests, remaining, blockedByHost };
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
 *
 * CAM-302 (ADR-012 §4, BR-2/BR-3): also reads ACTIVE, non-expired InternalHold
 * rows overlapping this date INSIDE the same transaction boundary — this is the
 * SAME seam the booking write path already loops per night
 * (app/api/bookings/route.ts `withBookingTransaction`), so a guest booking over
 * a hold that fills capacity auto-rejects with NO change to the booking route
 * (the story's KPI seam, AC-4), and a hold create reusing this same function
 * gets the identical serializable double-hold-prevention lock ADR-006 already
 * gives Booking (AC-5, EC-1, EC-5) — no parallel capacity math anywhere.
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

  // CAM-302: ACTIVE, non-expired holds overlapping this exact date, read inside
  // the SAME transaction boundary as the bookings above (lazy expiry, BR-2).
  const holds = await tx.internalHold.findMany({
    where: {
      campSiteId,
      status: 'ACTIVE',
      expiresAt: { gt: new Date() },
      AND: [
        { startDate: { lte: date } },
        { endDate: { gt: date } },
      ],
    },
    select: { guests: true },
  });
  const heldGuests = holds.reduce((sum, h) => sum + h.guests, 0);

  if (
    campSite.maxGuestsPerDay &&
    bookedGuests + heldGuests + requestedGuests > campSite.maxGuestsPerDay
  ) {
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
