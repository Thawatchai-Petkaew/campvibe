import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampSitePermission } from '@/lib/auth-utils';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { computeListingCompleteness } from '@/lib/listing-completeness';

/**
 * CAM-304 — GET-only listing completeness score `{ score, missing[] }` for a
 * single campsite, visible only to its owner, a platform ADMIN, or an
 * authorized team member (BR-4).
 *
 * Authz mirrors the sibling app/api/campsites/[id]/holds/route.ts exactly,
 * via the shared requireCampSitePermission seam. Permission code is
 * CAMPSITE_UPDATE (not BOOKING_UPDATE, which the holds route uses) — the
 * scored fields here (photos/price/extra-fee/cancellation-policy/zones/
 * amenities) are the same CampSite listing fields that CAMPSITE_UPDATE
 * already gates for editing (PUT app/api/campsites/[id]/route.ts): the
 * population that can see "what's missing" should be exactly the population
 * that can go fix it.
 *
 * BR-1: the score is ALWAYS computed live from the current field state on
 * every request — it is never stored or cached as the source of truth
 * (Atomic Data Framework §12). Cache-Control: no-store makes that explicit at
 * the HTTP layer, mirroring the sibling availability route's same guarantee.
 */

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { error: authError, campSite } = await requireCampSitePermission(id, 'CAMPSITE_UPDATE');
  if (authError) return authError;

  // BR-4/EC-4: a soft-deleted camp is treated exactly like an unknown one —
  // no listing data is disclosed. requireCampSitePermission does not itself
  // filter deletedAt (it also backs mutation routes that need to read a row
  // regardless of its soft-delete state), so this read-only route checks it
  // explicitly before computing anything.
  if (campSite!.deletedAt) {
    return apiError('Camp site not found', 404);
  }

  try {
    // Two small, targeted queries (no N+1): relation counts (images/options)
    // in one findUnique, non-deleted Spot count in a separate count query —
    // run in parallel. campSite's own scalar fields (priceLow/isFree/
    // extraFeeAmount/extraFeeLabel/cancellationPolicy) are already on the
    // object requireCampSitePermission returned above; no re-fetch needed.
    const [counts, spotCount] = await Promise.all([
      prisma.campSite.findUnique({
        where: { id },
        select: { _count: { select: { images: true, options: true } } },
      }),
      prisma.spot.count({ where: { campSiteId: id, deletedAt: null } }),
    ]);

    const result = computeListingCompleteness({
      imageCount: counts?._count.images ?? 0,
      priceLow: campSite!.priceLow !== null ? Number(campSite!.priceLow) : null,
      isFree: campSite!.isFree,
      extraFeeAmount: campSite!.extraFeeAmount !== null ? Number(campSite!.extraFeeAmount) : null,
      extraFeeLabel: campSite!.extraFeeLabel ?? null,
      cancellationPolicy: campSite!.cancellationPolicy ?? null,
      spotCount,
      optionsCount: counts?._count.options ?? 0,
    });

    const response = apiSuccess(result);
    // BR-1: never cached — always recomputed from the latest field state.
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    return apiError('Failed to compute listing completeness', 500, error);
  }
}
