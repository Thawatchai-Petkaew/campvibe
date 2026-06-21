import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bookingSchema } from '@/lib/validations/booking';
import { requireAuth } from '@/lib/auth-utils';
import { apiError, apiSuccess, calculateNights } from '@/lib/api-utils';
import { checkDateAvailability } from '@/lib/campsite-availability';
import { serializeDecimals } from '@/lib/serialize';

export async function POST(request: NextRequest) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  try {
    const body = await request.json();

    // 1. Validation (Inject session user ID)
    const validation = bookingSchema.safeParse({ ...body, userId: session!.user!.id });
    if (!validation.success) {
      return apiError('Validation Error', 400, validation.error.format());
    }

    const data = validation.data;
    const checkIn = new Date(data.checkInDate);
    const checkOut = new Date(data.checkOutDate);

    // 2. Check Overlaps (spot-specific if spotId provided)
    if (data.spotId) {
      const existingBooking = await prisma.booking.findFirst({
        where: {
          campSiteId: data.campSiteId,
          spotId: data.spotId,
          status: { not: 'CANCELLED' },
          AND: [
            { checkInDate: { lt: checkOut } },
            { checkOutDate: { gt: checkIn } }
          ]
        }
      });

      if (existingBooking) {
        return apiError('Dates not available', 409, 'Selected dates overlap with an existing booking.');
      }
    }

    // 3. Check Daily Capacity (for each day in booking range)
    const date = new Date(checkIn);
    while (date < checkOut) {
      const availability = await checkDateAvailability(
        data.campSiteId,
        new Date(date),
        data.guests
      );

      if (!availability.available) {
        return apiError(
          'Capacity exceeded',
          409,
          `Date ${date.toISOString().split('T')[0]}: ${availability.reason}`
        );
      }

      date.setDate(date.getDate() + 1);
    }

    // 4. Price Calculation
    const campSite = await prisma.campSite.findUnique({
      where: { id: data.campSiteId },
      include: { spots: true }
    });

    if (!campSite) {
      return apiError('Camp site not found', 404);
    }

    // Money is Decimal in the DB (ADR-002); compute in number for this simple THB total.
    let pricePerNight = Number(campSite.priceLow ?? 50);
    const bookedSpot = data.spotId ? campSite.spots.find(s => s.id === data.spotId) : undefined;
    if (bookedSpot?.pricePerNight) {
      pricePerNight = Number(bookedSpot.pricePerNight);
    }

    const nights = calculateNights(checkIn, checkOut);
    const totalPrice = pricePerNight * nights;

    // Ensure userId is available
    const userId = session?.user?.id;
    if (!userId) {
      return apiError('User ID not found in session', 401);
    }

    // 5. Create Booking
    const currency = campSite.priceCurrency ?? 'THB';
    const booking = await prisma.booking.create({
      data: {
        userId: userId,
        campSiteId: data.campSiteId,
        spotId: data.spotId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guests: data.guests,
        totalPrice: totalPrice,
        currency,
        status: 'PENDING', // Start as pending
        // Crystallize booking state (ADR-005): freeze name/price/tax/times at booking time so
        // later host edits to the live camp never mutate this booking — it is a legal document.
        snapshotCampName: campSite.nameTh,
        snapshotCampNameEn: campSite.nameEn,
        snapshotSpotName: bookedSpot?.name ?? null,
        snapshotUnitAmount: pricePerNight,
        snapshotSubtotalAmount: totalPrice,
        snapshotTaxRate: 0, // region VAT wired in S5 (Country.vatRate); 0 until then
        snapshotTaxAmount: 0,
        snapshotVatInclusive: false, // no VAT applied yet (taxRate 0); flips true when S5 wires a real rate
        snapshotTotalAmount: totalPrice,
        snapshotCurrency: currency,
        snapshotNights: nights,
        snapshotCheckInTime: campSite.checkInTime,
        snapshotCheckOutTime: campSite.checkOutTime,
        snapshotTimezone: 'Asia/Bangkok', // per-camp IANA tz wired in S5
      }
    });

    return apiSuccess(serializeDecimals(booking), 201);
  } catch (error) {
    return apiError('Failed to create booking', 500, error);
  }
}

export async function GET(request: NextRequest) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: session!.user!.id },
      include: {
        campSite: {
          select: {
            nameTh: true,
            nameEn: true,
            images: true,
            location: true
          }
        },
        spot: {
          select: {
            name: true,
            zone: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return apiSuccess(bookings);
  } catch (error) {
    return apiError('Failed to fetch bookings', 500, error);
  }
}
