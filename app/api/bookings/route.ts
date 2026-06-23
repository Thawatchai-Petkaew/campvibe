import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { bookingSchema, type BookingInput } from '@/lib/validations/booking';
import { requireAuth } from '@/lib/auth-utils';
import { apiError, apiSuccess, calculateNights } from '@/lib/api-utils';
import { checkDateAvailabilityInTx } from '@/lib/campsite-availability';
import { serializeDecimals } from '@/lib/serialize';
import { resolveUnitPrice, computeBookingPrice } from '@/lib/booking-pricing';

// ---------------------------------------------------------------------------
// Internal helper types for the booking transaction result
// ---------------------------------------------------------------------------
type BookingTxResult =
  | { type: 'ok'; booking: Awaited<ReturnType<typeof prisma.booking.create>> }
  | { type: 'conflict'; detail: string; message: string }
  | { type: 'not_found' }
  | { type: 'error'; cause: unknown };

// ---------------------------------------------------------------------------
// Detect a Postgres serialization failure (error code 40001 → Prisma P2034).
// ---------------------------------------------------------------------------
function isSerializationError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2034'
  );
}

// ---------------------------------------------------------------------------
// Sleep helper for bounded retry backoff.
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Core transaction: all availability checks + booking.create in one
// Serializable transaction.  Retried up to 3 times on P2034.
// ---------------------------------------------------------------------------
async function withBookingTransaction(
  data: BookingInput,
  checkIn: Date,
  checkOut: Date,
  userId: string,
  attempt = 1
): Promise<BookingTxResult> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        // --- Check 1: Spot overlap (only if spotId provided) ---
        if (data.spotId) {
          const overlap = await tx.booking.findFirst({
            where: {
              campSiteId: data.campSiteId,
              spotId: data.spotId,
              status: { not: 'CANCELLED' },
              AND: [
                { checkInDate: { lt: checkOut } },
                { checkOutDate: { gt: checkIn } },
              ],
            },
          });
          if (overlap) {
            return {
              type: 'conflict' as const,
              message: 'Dates not available',
              detail: 'Selected dates overlap with an existing booking.',
            };
          }
        }

        // --- Check 2: Daily capacity (for each day in booking range, inside tx) ---
        const capacityDate = new Date(checkIn);
        while (capacityDate < checkOut) {
          const availability = await checkDateAvailabilityInTx(
            tx,
            data.campSiteId,
            new Date(capacityDate),
            data.guests
          );
          if (!availability.available) {
            return {
              type: 'conflict' as const,
              message: 'Capacity exceeded',
              detail: `Date ${capacityDate.toISOString().split('T')[0]}: ${availability.reason}`,
            };
          }
          capacityDate.setDate(capacityDate.getDate() + 1);
        }

        // --- Check 3: BlockedDate (whole-camp and spot-level blocks, inside tx) ---
        const blockedDateFilter: Prisma.BlockedDateWhereInput = {
          campSiteId: data.campSiteId,
          deletedAt: null,
          OR: [
            { spotId: null },
            ...(data.spotId ? [{ spotId: data.spotId }] : []),
          ],
          AND: [
            { startDate: { lte: checkOut } },
            { endDate: { gte: checkIn } },
          ],
        };
        const blocked = await tx.blockedDate.findFirst({ where: blockedDateFilter });
        if (blocked) {
          return {
            type: 'conflict' as const,
            message: 'Dates not available',
            detail: 'Selected dates are blocked by the host.',
          };
        }

        // --- Fetch campSite for pricing (inside tx for snapshot consistency) ---
        const campSite = await tx.campSite.findUnique({
          where: { id: data.campSiteId },
          include: { spots: true, location: { include: { countryRel: true } } },
        });
        if (!campSite) {
          return { type: 'not_found' as const };
        }

        // --- Price computation (unchanged logic from existing handler) ---
        // Money is Decimal in the DB (ADR-002); compute in number for this simple THB total.
        // CAM-58: price computation centralised in lib/booking-pricing.ts — shared with the UI
        // so displayed total always equals recorded total.
        const bookedSpot = data.spotId ? campSite.spots.find((s) => s.id === data.spotId) : undefined;
        const unitPrice = resolveUnitPrice({
          campSitePriceLow: campSite.priceLow !== null ? Number(campSite.priceLow) : null,
          spotPricePerNight: bookedSpot?.pricePerNight ? Number(bookedSpot.pricePerNight) : null,
        });

        const nights = calculateNights(checkIn, checkOut);
        const currency = campSite.priceCurrency ?? 'THB';
        // S5→S6: pull real regional VAT + timezone from the camp's Country
        const country = campSite.location?.countryRel;
        const vatRate = country ? Number(country.vatRate) : 0;
        const timezone = country?.timezone ?? 'Asia/Bangkok';

        const pricing = computeBookingPrice({ unitPrice, nights, vatRate });
        const { subtotalAmount, taxAmount, vatInclusive, totalAmount } = pricing;
        const totalPrice = totalAmount;

        // --- Create booking ---
        const booking = await tx.booking.create({
          data: {
            userId,
            campSiteId: data.campSiteId,
            spotId: data.spotId,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            guests: data.guests,
            totalPrice,
            currency,
            status: 'PENDING', // Start as pending
            // Crystallize booking state (ADR-005): freeze name/price/tax/times at booking time so
            // later host edits to the live camp never mutate this booking — it is a legal document.
            snapshotCampName: campSite.nameTh,
            snapshotCampNameEn: campSite.nameEn,
            snapshotSpotName: bookedSpot?.name ?? null,
            snapshotUnitAmount: unitPrice,
            snapshotSubtotalAmount: subtotalAmount,
            snapshotTaxRate: vatRate, // S5: regional VAT from the camp's Country.vatRate
            snapshotTaxAmount: taxAmount,
            snapshotVatInclusive: vatInclusive,
            snapshotTotalAmount: totalAmount,
            snapshotCurrency: currency,
            snapshotNights: nights,
            snapshotCheckInTime: campSite.checkInTime,
            snapshotCheckOutTime: campSite.checkOutTime,
            snapshotTimezone: timezone, // S5: from the camp's Country.timezone
          },
        });

        return { type: 'ok' as const, booking };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (err) {
    // Postgres serialization failure (P2034 / pg code 40001): retry with backoff.
    // Cap at 3 total attempts; after exhaustion return a 409 conflict (not 500).
    if (isSerializationError(err) && attempt <= 3) {
      await sleep(50 * attempt); // 50ms, 100ms, 150ms
      return withBookingTransaction(data, checkIn, checkOut, userId, attempt + 1);
    }
    // After 3 retries still a serialization failure → genuine conflict → 409.
    if (isSerializationError(err)) {
      return {
        type: 'conflict' as const,
        message: 'Dates not available',
        detail: 'Selected dates are unavailable (conflict). Please try again.',
      };
    }
    // Any other error: re-throw to let the outer catch return 500.
    throw err;
  }
}

export async function POST(request: NextRequest) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  // Ensure userId is available from the session before touching any DB logic.
  const userId = session?.user?.id;
  if (!userId) {
    return apiError('User ID not found in session', 401);
  }

  try {
    const body = await request.json();

    // 1. Validate at the boundary (zod re-parse; never trust the client).
    const validation = bookingSchema.safeParse({ ...body, userId });
    if (!validation.success) {
      return apiError('Validation Error', 400, validation.error.format());
    }

    const data = validation.data;
    const checkIn = new Date(data.checkInDate);
    const checkOut = new Date(data.checkOutDate);

    // 2. Run all checks + booking create inside a single Serializable transaction
    //    with bounded retry on P2034 serialization failure (ADR-006).
    const result = await withBookingTransaction(data, checkIn, checkOut, userId);

    // 3. Map transaction result to HTTP response (contract unchanged — AC#5).
    if (result.type === 'conflict') {
      return apiError(result.message, 409, result.detail);
    }
    if (result.type === 'not_found') {
      return apiError('Camp site not found', 404);
    }
    if (result.type === 'ok') {
      return apiSuccess(serializeDecimals(result.booking), 201);
    }

    // Unreachable — TypeScript narrows type to 'error' which is thrown above.
    return apiError('Failed to create booking', 500);
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
