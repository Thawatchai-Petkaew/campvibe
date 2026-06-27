import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { spotSchema } from '@/lib/validations/spot';
import { requireCampSitePermission } from '@/lib/auth-utils';
import { apiError, apiSuccess, arrayToCsv, imageReplaceNested } from '@/lib/api-utils';
import { auth } from '@/lib/auth';
import { isCampSitePublic, canViewCampSite } from '@/lib/campsite-visibility';

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
    const spot = await prisma.spot.findFirst({
      where: { id: spotId, campSiteId: id },
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
  const { error: authError } = await requireCampSitePermission(id, 'CAMPSITE_UPDATE');
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
    const owned = await prisma.spot.findFirst({ where: { id: spotId, campSiteId: id }, select: { id: true } });
    if (!owned) return apiError('Spot not found', 404);

    const updated = await prisma.spot.update({
      where: { id: spotId },
      data: {
        ...(data.zone !== undefined && { zone: data.zone }),
        ...(data.name && { name: data.name }),
        ...('images' in body && { images: imageReplaceNested(data.images) }),
        ...(data.viewType !== undefined && { viewType: data.viewType }),
        ...(data.maxCampers !== undefined && { maxCampers: data.maxCampers }),
        ...(data.maxTents !== undefined && { maxTents: data.maxTents }),
        ...(data.environment !== undefined && { environment: data.environment }),
        ...(data.pricePerNight !== undefined && { pricePerNight: data.pricePerNight }),
        ...(data.pricePerSite !== undefined && { pricePerSite: data.pricePerSite }),
        ...(data.nearFacilities !== undefined && { nearFacilities: arrayToCsv(data.nearFacilities) }),
      }
    });

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
  const { error: authError } = await requireCampSitePermission(id, 'CAMPSITE_DELETE');
  if (authError) return authError;

  try {
    // Verify the spot belongs to THIS campsite before deleting (prevent cross-campsite IDOR).
    const owned = await prisma.spot.findFirst({ where: { id: spotId, campSiteId: id }, select: { id: true } });
    if (!owned) return apiError('Spot not found', 404);

    await prisma.spot.delete({
      where: { id: spotId }
    });

    return apiSuccess({ success: true });
  } catch (error) {
    return apiError('Failed to delete spot', 500, error);
  }
}
