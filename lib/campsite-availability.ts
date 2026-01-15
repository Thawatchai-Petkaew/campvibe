import { prisma } from '@/lib/prisma';

/**
 * Get daily availability for a camp site
 * Returns guests and tents booked for each date
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
  const availability: Record<string, { bookedGuests: number; bookedTents: number }> = {};
  
  // Initialize all dates in range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    availability[dateKey] = { bookedGuests: 0, bookedTents: 0 };
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
