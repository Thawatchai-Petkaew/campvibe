import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createHoldSchema } from '@/lib/validations/holds';
import { requireCampSitePermission } from '@/lib/auth-utils';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { checkDateAvailabilityInTx } from '@/lib/campsite-availability';

/**
 * CAM-302 — Host-only InternalHold write API (create + list), reduced M1 slice
 * of ADR-012 §4 (no leadId/quoteId/bookingId FK yet — see the story's `## Data`).
 *
 * Permission model (mirrors CAM-56 blocked-dates exactly, ticket BR-6): owner,
 * platform ADMIN, or a team member with BOOKING_UPDATE — requireCampSitePermission
 * already grants all three in one call.
 *
 * Double-hold prevention (BR-3, AC-5, EC-1, EC-5) reuses the ADR-006
 * serializable-transaction + bounded-retry pattern from
 * app/api/bookings/route.ts (`withBookingTransaction`), looping the SAME
 * checkDateAvailabilityInTx seam per night — now extended (lib/campsite-
 * availability.ts) to also read ACTIVE non-expired holds. No parallel
 * capacity math is written here or anywhere else.
 *
 * Release (an explicit ACTIVE -> RELEASED write, BR-4) is a separate route —
 * see app/api/campsites/[id]/holds/[holdId]/route.ts.
 */

type HoldTxResult =
  | { type: 'ok'; hold: Awaited<ReturnType<typeof prisma.internalHold.create>> }
  | { type: 'conflict' };

function isSerializationError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2034'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withHoldTransaction(
  campSiteId: string,
  spotId: string | null,
  startDate: Date,
  endDate: Date,
  guests: number,
  note: string | null,
  expiresAt: Date,
  createdById: string,
  attempt = 1
): Promise<HoldTxResult> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        // BR-3/EC-1/EC-5: one night-by-night pass through the SAME seam the
        // booking write path uses — checkDateAvailabilityInTx now also counts
        // ACTIVE non-expired holds (lib/campsite-availability.ts). Any night
        // that would exceed remaining capacity rejects the whole create; no
        // row is written (all-or-nothing inside this one transaction).
        const night = new Date(startDate);
        while (night < endDate) {
          const availability = await checkDateAvailabilityInTx(tx, campSiteId, new Date(night), guests);
          if (!availability.available) {
            return { type: 'conflict' as const };
          }
          night.setDate(night.getDate() + 1);
        }

        const hold = await tx.internalHold.create({
          data: {
            campSiteId,
            spotId,
            startDate,
            endDate,
            guests,
            note,
            status: 'ACTIVE',
            expiresAt,
            createdById,
          },
        });

        // BR-7: one AuditLog row per create, written inside the same
        // transaction (atomic with the hold row). No PII in the payload —
        // ids + date range only.
        await tx.auditLog.create({
          data: {
            actorId: createdById,
            action: 'hold.created',
            entityType: 'InternalHold',
            entityId: hold.id,
            metadata: {
              campSiteId,
              spotId,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
            },
          },
        });

        return { type: 'ok' as const, hold };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (err) {
    // Bounded retry on a genuine Postgres serialization conflict (ADR-006),
    // identical shape to withBookingTransaction (app/api/bookings/route.ts).
    if (isSerializationError(err) && attempt <= 3) {
      await sleep(50 * attempt); // 50ms, 100ms, 150ms
      return withHoldTransaction(
        campSiteId,
        spotId,
        startDate,
        endDate,
        guests,
        note,
        expiresAt,
        createdById,
        attempt + 1
      );
    }
    if (isSerializationError(err)) {
      // Retries exhausted — a genuine conflict, exactly one racing writer wins (EC-5).
      return { type: 'conflict' as const };
    }
    throw err;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { error: authError } = await requireCampSitePermission(id, 'BOOKING_UPDATE');
  if (authError) return authError;

  try {
    const holds = await prisma.internalHold.findMany({
      where: { campSiteId: id },
      orderBy: { startDate: 'asc' },
    });

    return apiSuccess(holds);
  } catch (error) {
    return apiError('Failed to fetch holds', 500, error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { error: authError, session } = await requireCampSitePermission(id, 'BOOKING_UPDATE');
  if (authError) return authError;

  try {
    const body = await request.json();

    const validation = createHoldSchema.safeParse(body);
    if (!validation.success) {
      return apiError('Validation Error', 400, validation.error.format());
    }

    const data = validation.data;

    // IDOR guard (BR-6/EC-6): a spot-level hold must reference a spot that
    // belongs to THIS campsite (mirrors CAM-56 blocked-dates exactly).
    if (data.spotId) {
      const spot = await prisma.spot.findFirst({
        where: { id: data.spotId, campSiteId: id },
        select: { id: true },
      });
      if (!spot) {
        return apiError('Spot not found', 404);
      }
    }

    const result = await withHoldTransaction(
      id,
      data.spotId ?? null,
      data.startDate,
      data.endDate,
      data.guests,
      data.note ?? null,
      data.expiresAt,
      session!.user!.id
    );

    if (result.type === 'conflict') {
      // AC-5/BR-3/EC-1/EC-5 — ticket's exact Thai copy, no row written.
      return apiError('ช่วงวันที่นี้ถูกกันไว้แล้ว', 409);
    }

    return apiSuccess({ hold: result.hold }, 201);
  } catch (error) {
    return apiError('Failed to create hold', 500, error);
  }
}
