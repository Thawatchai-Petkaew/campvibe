import { NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { spotSchema } from '@/lib/validations/spot';
import { requireCampSitePermission } from '@/lib/auth-utils';
import { apiError, apiSuccess, arrayToCsv, imageReplaceNested, resolveSpotZoneWrite } from '@/lib/api-utils';
import { auth } from '@/lib/auth';
import { isCampSitePublic, canViewCampSite } from '@/lib/campsite-visibility';
import { campTag, campSlugTag } from '@/lib/catalog-cache';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; spotId: string }> }
) {
  const { id, spotId } = await params;

  try {
    // SEC-1: gate non-public campsites before returning any spot data.
    // Fetch the campsite visibility fields first (single lookup — no N+1).
    const campSite = await prisma.campSite.findUnique({
      where: { id },
      select: { isActive: true, isPublished: true, deletedAt: true, operatorId: true },
    });

    if (!campSite) {
      return apiError('Spot not found', 404);
    }

    if (!isCampSitePublic(campSite)) {
      const session = await auth();
      if (!canViewCampSite(campSite, session)) {
        // 404 not 403 — no information-disclosure.
        return apiError('Spot not found', 404);
      }
    }

    // Scope by campSiteId so a spot can only be read under its own campsite (no cross-campsite IDOR).
    // BR-1 (CAM-352): a soft-deleted spot 404s here too, matching the list GET,
    // the PUT/DELETE ownership lookups, and the aggregation Buffet.
    const spot = await prisma.spot.findFirst({
      where: { id: spotId, campSiteId: id, deletedAt: null },
      include: { campSite: true, images: { orderBy: { sortOrder: 'asc' } } }
    });

    if (!spot) {
      return apiError('Spot not found', 404);
    }

    return apiSuccess(spot);
  } catch (error) {
    return apiError('Failed to fetch spot', 500, error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; spotId: string }> }
) {
  const { id, spotId } = await params;

  // Check permission: updating a spot modifies the campsite composition.
  // CAMPSITE_UPDATE is required — mirrors the campsite PUT handler.
  const { error: authError, campSite } = await requireCampSitePermission(id, 'CAMPSITE_UPDATE');
  if (authError) return authError;

  try {
    const body = await request.json();

    // Validate with Zod (partial validation for updates)
    const validation = spotSchema.partial().safeParse(body);
    if (!validation.success) {
      return apiError('Validation Error', 400, validation.error.format());
    }

    const data = validation.data;

    // Ownership of the campsite is checked above; also verify the spot belongs to THIS
    // campsite so an owner of campsite A cannot mutate spots of campsite B (IDOR).
    // Excludes a soft-deleted spot — a deleted spot cannot be edited back to life (BR-1).
    const owned = await prisma.spot.findFirst({ where: { id: spotId, campSiteId: id, deletedAt: null }, select: { id: true } });
    if (!owned) return apiError('Spot not found', 404);

    // CAM-362: resolve zoneId (takes precedence) or the legacy zone string
    // (tech.md §4.2) — zoneId is validated to belong to THIS camp + live.
    // Neither field sent -> {} (no-op, leaves the existing zone/zoneId untouched).
    const zoneResolution = await resolveSpotZoneWrite(id, { zone: data.zone, zoneId: data.zoneId });
    if (!zoneResolution.ok) {
      return apiError(zoneResolution.message, zoneResolution.status);
    }

    const updated = await prisma.spot.update({
      where: { id: spotId },
      data: {
        ...zoneResolution.fields,
        ...(data.name && { name: data.name }),
        ...('images' in body && { images: imageReplaceNested(data.images) }),
        ...(data.viewType !== undefined && { viewType: data.viewType }),
        ...(data.maxCampers !== undefined && { maxCampers: data.maxCampers }),
        ...(data.maxTents !== undefined && { maxTents: data.maxTents }),
        ...(data.environment !== undefined && { environment: data.environment }),
        ...(data.pricePerNight !== undefined && { pricePerNight: data.pricePerNight }),
        ...(data.pricePerSite !== undefined && { pricePerSite: data.pricePerSite }),
        // CAM-615: `arrayToCsv([])` returns `undefined` on an explicit "clear
        // every facility" — same shape as CampSite.tags (app/api/campsites/
        // [id]/route.ts) — so map the empty case to an explicit null instead
        // of letting Prisma treat it as "skip, leave unchanged".
        ...(data.nearFacilities !== undefined && { nearFacilities: arrayToCsv(data.nearFacilities) ?? null }),
      }
    });

    // CAM-353 BR-8: bust the cached camp-detail read (lib/catalog-cache.ts
    // getCampBySlug) so an edited spot/photo surfaces on the public detail
    // page without waiting on the 5-min TTL.
    revalidateTag(campTag(id), {});
    if (campSite) {
      revalidateTag(campSlugTag(campSite.nameThSlug), {});
      revalidateTag(campSlugTag(campSite.nameEnSlug), {});
    }

    return apiSuccess(updated);
  } catch (error) {
    return apiError('Failed to update spot', 500, error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; spotId: string }> }
) {
  const { id, spotId } = await params;

  // Check permission: deleting a spot is a destructive campsite operation.
  // CAMPSITE_DELETE is required — mirrors the campsite DELETE handler.
  const { error: authError, campSite } = await requireCampSitePermission(id, 'CAMPSITE_DELETE');
  if (authError) return authError;

  try {
    // Verify the spot belongs to THIS campsite before deleting (prevent cross-campsite IDOR).
    // Also excludes an already-deleted spot so a repeat DELETE surfaces 404, not a silent no-op.
    const owned = await prisma.spot.findFirst({
      where: { id: spotId, campSiteId: id, deletedAt: null },
      select: { id: true },
    });
    if (!owned) return apiError('Spot not found', 404);

    // BR-2 (CAM-352): soft-delete — a spot may have Booking/InternalHold/BlockedDate
    // rows; a hard delete either fails on the FK or orphans booking history.
    // Setting deletedAt preserves those rows and matches every other soft-deleted
    // model in the schema. BR-1 is enforced independently at each consumer, not
    // by one shared filter: the spots list GET (`deletedAt: null` where-clause),
    // this route's own PUT/DELETE ownership lookups (above), the spot-aggregation
    // Buffet (`lib/spot-aggregation.ts` — calculateSpotCapacity + the
    // getCampSiteWithCapacity `spots` include), and the holds/blocked-dates
    // spot-IDOR guards all filter `deletedAt: null` explicitly.
    await prisma.spot.update({
      where: { id: spotId },
      data: { deletedAt: new Date() },
    });

    // CAM-353 BR-8: bust the cached camp-detail read (lib/catalog-cache.ts
    // getCampBySlug) so a deleted spot/photo disappears from the public
    // detail page without waiting on the 5-min TTL.
    revalidateTag(campTag(id), {});
    if (campSite) {
      revalidateTag(campSlugTag(campSite.nameThSlug), {});
      revalidateTag(campSlugTag(campSite.nameEnSlug), {});
    }

    return apiSuccess({ success: true });
  } catch (error) {
    return apiError('Failed to delete spot', 500, error);
  }
}
