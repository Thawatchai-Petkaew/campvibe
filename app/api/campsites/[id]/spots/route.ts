import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { spotSchema } from '@/lib/validations/spot';
import { requireCampSiteOwnership } from '@/lib/auth-utils';
import { apiError, apiSuccess, arrayToCsv } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const spots = await prisma.spot.findMany({
      where: { campSiteId: id },
      orderBy: { createdAt: 'desc' }
    });

    return apiSuccess(spots);
  } catch (error) {
    return apiError('Failed to fetch spots', 500, error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Check ownership
  const { error: authError } = await requireCampSiteOwnership(id);
  if (authError) return authError;

  try {
    const body = await request.json();
    
    // Validate with Zod
    const validation = spotSchema.safeParse({ ...body, campSiteId: id });
    if (!validation.success) {
      return apiError('Validation Error', 400, validation.error.format());
    }
    
    const data = validation.data;

    const spot = await prisma.spot.create({
      data: {
        zone: data.zone,
        name: data.name,
        images: data.images ? arrayToCsv(data.images) : undefined,
        viewType: data.viewType,
        maxCampers: data.maxCampers,
        maxTents: data.maxTents,
        environment: data.environment,
        pricePerNight: data.pricePerNight,
        pricePerSite: data.pricePerSite,
        nearFacilities: data.nearFacilities ? arrayToCsv(data.nearFacilities) : undefined,
        campSiteId: id,
      },
    });

    return apiSuccess(spot, 201);
  } catch (error) {
    return apiError('Failed to create spot', 500, error);
  }
}
