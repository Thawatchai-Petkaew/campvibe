import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { spotSchema } from '@/lib/validations/spot';
import { requireCampSiteOwnership } from '@/lib/auth-utils';
import { apiError, apiSuccess, arrayToCsv } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; spotId: string }> }
) {
  const { spotId } = await params;
  
  try {
    const spot = await prisma.spot.findUnique({
      where: { id: spotId },
      include: { campSite: true }
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
  
  // Check ownership
  const { error: authError } = await requireCampSiteOwnership(id);
  if (authError) return authError;

  try {
    const body = await request.json();
    
    // Validate with Zod (partial validation for updates)
    const validation = spotSchema.partial().safeParse(body);
    if (!validation.success) {
      return apiError('Validation Error', 400, validation.error.format());
    }
    
    const data = validation.data;

    const updated = await prisma.spot.update({
      where: { id: spotId },
      data: {
        ...(data.zone !== undefined && { zone: data.zone }),
        ...(data.name && { name: data.name }),
        ...(data.images !== undefined && { images: arrayToCsv(data.images) }),
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
  
  // Check ownership
  const { error: authError } = await requireCampSiteOwnership(id);
  if (authError) return authError;

  try {
    await prisma.spot.delete({
      where: { id: spotId }
    });

    return apiSuccess({ success: true });
  } catch (error) {
    return apiError('Failed to delete spot', 500, error);
  }
}
