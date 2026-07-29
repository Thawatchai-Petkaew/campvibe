import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { bookingSchema, type BookingInput } from '@/lib/validations/booking';
import { requireAuth } from '@/lib/auth-utils';
import { apiError, apiSuccess, calculateNights } from '@/lib/api-utils';
import { checkDateAvailabilityInTx, isSpotBookedForStay } from '@/lib/campsite-availability';
import { serializeDecimals } from '@/lib/serialize';
import { buildBookingPriceArgs, computeBookingPrice } from '@/lib/booking-pricing';
import { checkRateLimit } from '@/lib/rate-limit';

// RISK-12: cap the list query so it never does a full-table scan as data grows.
// Returns the most recent N bookings (orderBy createdAt desc).
// Full keyset + infinite-scroll is a deferred FE story.
const BOOKING_LIST_LIMIT = 100;

// ---------------------------------------------------------------------------
// Internal helper types for the booking transaction result
// ---------------------------------------------------------------------------
type BookingTxResult =
  | { type: 'ok'; booking: Awaited<ReturnType<typeof prisma.booking.create>> }
  | { type: 'conflict'; detail: string; message: string }
  | { type: 'not_found' }
  // CAM-668 (CAM-665 security review): `spotId` was provided but does not
  // belong to `campSiteId` — or belongs to it but is soft-deleted. See the
  // Check 0 comment below for why this is one rejection, not two.
  | { type: 'invalid_spot' }
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
        // CAM-665 (ADR-012 §4 — no forked capacity path): this used to run its
        // own inline query here, independent of the capacity module every
        // other reader (GET /api/campsites/[id]/availability?spotId=) now
        // shares. Delegated to isSpotBookedForStay so the write gate and the
        // read-side can never silently disagree (the CAM-190/CAM-267/CAM-400
        // failure class) — same predicate, moved verbatim, not rewritten.
        if (data.spotId) {
          const overlap = await isSpotBookedForStay(
            tx,
            data.campSiteId,
            data.spotId,
            checkIn,
            checkOut
          );
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
        // CAM-668: `spots` is scoped `deletedAt: null` — a soft-deleted pitch on
        // THIS camp must never be bookable/priceable, same as a foreign one
        // (Check 0 below treats both identically).
        const campSite = await tx.campSite.findUnique({
          where: { id: data.campSiteId },
          include: { spots: { where: { deletedAt: null } }, location: { include: { countryRel: true } } },
        });
        if (!campSite) {
          return { type: 'not_found' as const };
        }

        // --- Price computation (CAM-651: routed through buildBookingPriceArgs) ---
        // Money is Decimal in the DB (ADR-002); compute in number for this simple THB total.
        // CAM-58: price computation centralised in lib/booking-pricing.ts — shared with the UI
        // so displayed total always equals recorded total.
        const bookedSpot = data.spotId ? campSite.spots.find((s) => s.id === data.spotId) : undefined;

        // --- Check 0 (CAM-668, CAM-665 security review): spotId must belong to
        // THIS camp and be live ------------------------------------------------
        // The finding: Checks 1 and 3 above both scope by campSiteId+spotId, so
        // a FOREIGN spotId simply matches nothing in either query and sails
        // through — campSite.spots.find() above then returns undefined,
        // pricing silently falls back to camp-level, and booking.create below
        // still WRITES the foreign spotId. GET /api/bookings later returns
        // spot:{name,zone} for that foreign spot — a cross-tenant read.
        //
        // Runs HERE (not a separate query) deliberately: `campSite` above is
        // already fetched inside THIS Serializable transaction (ADR-006), so
        // there is no separate tx.spot.findFirst call to add (ADR-009 no
        // forked-data-path) and no TOCTOU window — a host soft-deleting the
        // pitch concurrently is caught by Postgres serializable snapshot
        // isolation exactly like every other check in this transaction.
        //
        // ONE query, ONE `.find()` — "no such pitch anywhere" and "pitch
        // exists but belongs to another camp" both collapse into the exact
        // same `bookedSpot === undefined` result, so the response below can
        // never be used as an existence oracle for another camp's spots.
        // Mirrors app/api/campsites/[id]/availability/route.ts's own spotId
        // rejection (CAM-665) — same 400, so the read and write paths agree.
        if (data.spotId && !bookedSpot) {
          return { type: 'invalid_spot' as const };
        }

        const nights = calculateNights(checkIn, checkOut);
        const currency = campSite.priceCurrency ?? 'THB';
        // S5→S6: pull real regional VAT + timezone from the camp's Country
        const country = campSite.location?.countryRel;
        const vatRate = country ? Number(country.vatRate) : 0;
        const timezone = country?.timezone ?? 'Asia/Bangkok';

        // CAM-652 (ADR-014): the real CampSite.priceUnit / Spot.priceUnit columns
        // now travel through buildBookingPriceArgs, and `party.guests` is the
        // camper's actual real request value — this is what makes a PER_PERSON
        // camp charge unitPrice x guests x nights instead of unitPrice x nights.
        // A camp/spot still stuck at the PER_SITE column default (every camp,
        // until a host opts in via CAM-654) keeps charging exactly as before —
        // resolveQuantity ignores `guests` for PER_SITE (lib/booking-pricing.ts).
        const priceArgs = buildBookingPriceArgs({
          campSite: {
            priceLow: campSite.priceLow !== null ? Number(campSite.priceLow) : null,
            priceUnit: campSite.priceUnit ?? null,
            // CAM-268 (PREP-2): the camp's atomic one-time fee — same single source
            // (computeBookingPrice) the detail-page preview uses, so the recorded total
            // never diverges from what was shown before the guest reserved.
            extraFeeAmount: campSite.extraFeeAmount !== null ? Number(campSite.extraFeeAmount) : null,
          },
          spot: bookedSpot
            ? {
                pricePerNight: bookedSpot.pricePerNight ? Number(bookedSpot.pricePerNight) : null,
                priceUnit: bookedSpot.priceUnit ?? null,
              }
            : null,
          party: { guests: data.guests },
          nights,
          vatRate,
        });
        // `ok:false` (TENT_COUNT_UNAVAILABLE) is unreachable today — no host
        // form writes CampSite.priceUnit / Spot.priceUnit yet (CAM-654, the
        // unit picker, is a separate story), so every row still carries the
        // column default PER_SITE (ADR-014 §2) — but the discriminated union
        // still forces this check rather than a silent guessed price if that
        // ever changes.
        if (!priceArgs.ok) {
          return {
            type: 'error' as const,
            cause: new Error(`booking-pricing: ${priceArgs.reason}`),
          };
        }

        const pricing = computeBookingPrice(priceArgs.input);
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
            // CAM-642: attribution label only — never read for pricing/capacity/authz above.
            source: data.source,
            // Crystallize booking state (ADR-005): freeze name/price/tax/times at booking time so
            // later host edits to the live camp never mutate this booking — it is a legal document.
            snapshotCampName: campSite.nameTh,
            snapshotCampNameEn: campSite.nameEn,
            snapshotSpotName: bookedSpot?.name ?? null,
            snapshotUnitAmount: pricing.unitAmount,
            snapshotSubtotalAmount: subtotalAmount,
            // CAM-652 (ADR-014 §4): freeze the unit + multiplier that actually
            // priced this stay, alongside the amounts — a later host unit
            // change must never reinterpret an existing booking's total.
            snapshotPricingUnit: priceArgs.input.unit,
            snapshotQuantity: priceArgs.input.quantity,
            snapshotExtraFeeAmount: pricing.extraFeeAmount, // CAM-268: frozen fee at booking time
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

  // RISK-3: Rate-limit booking creation per user (20 req / 1 min).
  const rl = checkRateLimit(`booking:create:${userId}`, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSec) },
    });
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
    if (result.type === 'invalid_spot') {
      // CAM-668: deliberately 400, not 404 — this route's 404 is reserved for
      // the campsite itself (branch above). A spotId that doesn't belong to
      // this camp — or doesn't exist at all, or is soft-deleted — is a bad
      // INPUT VALUE in context, the same class as a zod validation failure,
      // and mirrors GET /api/campsites/[id]/availability's own rejection for
      // the identical field (CAM-665) so the two never disagree.
      return apiError('Invalid spotId parameter', 400);
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
      orderBy: { createdAt: 'desc' },
      take: BOOKING_LIST_LIMIT,
    });

    return apiSuccess(bookings);
  } catch (error) {
    return apiError('Failed to fetch bookings', 500, error);
  }
}
