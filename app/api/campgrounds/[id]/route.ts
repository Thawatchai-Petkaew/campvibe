import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { campSiteSchema } from '@/lib/validations/campsite';
import { requireCampSiteOwnership } from '@/lib/auth-utils';
import { apiError, apiSuccess, arrayToCsv } from '@/lib/api-utils';
import { getCampSiteWithCapacity } from '@/lib/spot-aggregation';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Use spot aggregation if useSpotView is enabled
    const campSite = await getCampSiteWithCapacity(id);

    if (!campSite) {
      return apiError('Campground not found', 404);
    }

    return apiSuccess(campSite);
  } catch (error) {
    return apiError('Failed to fetch campground', 500, error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Check ownership
  const { error: authError, campSite: existing } = await requireCampSiteOwnership(id);
  if (authError) return authError;

  try {
    const body = await request.json();
    
    // Validate with Zod (partial validation for updates)
    const validation = campSiteSchema.partial().safeParse(body);
    if (!validation.success) {
      return apiError('Validation Error', 400, validation.error.format());
    }
    
    const data = validation.data;

    // Update Location if provided (but don't auto-update lat/lon from camp site)
    // Lat/Lon are independent - user enters manually
    if (data.locationId && (body as any).province) {
      await prisma.location.update({
        where: { id: data.locationId },
        data: {
          province: (body as any).province
          // Note: lat/lon are NOT updated from camp site data
          // They remain independent
        }
      });
    }

    const updated = await prisma.campSite.update({
      where: { id },
      data: {
        ...(data.nameTh && { nameTh: data.nameTh }),
        ...(data.nameEn !== undefined && { nameEn: data.nameEn }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.campSiteType && { campSiteType: Array.isArray(data.campSiteType) ? arrayToCsv(data.campSiteType) : data.campSiteType }),
        ...(data.accessTypes && { accessTypes: arrayToCsv(data.accessTypes) }),
        ...(data.accommodationTypes && { accommodationTypes: arrayToCsv(data.accommodationTypes) }),
        ...(data.facilities && { facilities: arrayToCsv(data.facilities) }),
        ...(data.externalFacilities !== undefined && { externalFacilities: arrayToCsv(data.externalFacilities) }),
        ...(data.equipment !== undefined && { equipment: arrayToCsv(data.equipment) }),
        ...(data.activities !== undefined && { activities: arrayToCsv(data.activities) }),
        ...(data.terrain !== undefined && { terrain: arrayToCsv(data.terrain) }),

        ...(data.address !== undefined && { address: data.address }),
        ...(data.directions !== undefined && { directions: data.directions }),
        ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl || undefined }),
        ...(data.feeInfo !== undefined && { feeInfo: data.feeInfo }),
        
        // Contact Information
        ...(data.phone !== undefined && { phone: data.phone || undefined }),
        ...(data.lineId !== undefined && { lineId: data.lineId || undefined }),
        ...(data.facebookUrl !== undefined && { facebookUrl: data.facebookUrl || undefined }),
        ...(data.facebookMessageUrl !== undefined && { facebookMessageUrl: data.facebookMessageUrl || undefined }),
        ...(data.tiktokUrl !== undefined && { tiktokUrl: data.tiktokUrl || undefined }),
        ...(data.toiletInfo !== undefined && { toiletInfo: data.toiletInfo }),
        ...(data.minimumAge !== undefined && { minimumAge: data.minimumAge }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.checkInTime && { checkInTime: data.checkInTime }),
        ...(data.checkOutTime && { checkOutTime: data.checkOutTime }),
        ...(data.bookingMethod && { bookingMethod: data.bookingMethod }),
        ...(data.priceLow !== undefined && { priceLow: data.priceLow }),
        ...(data.priceHigh !== undefined && { priceHigh: data.priceHigh }),
        ...(data.images !== undefined && { images: arrayToCsv(data.images) }),
        ...(data.logo !== undefined && { logo: data.logo || undefined }),
        ...(data.tags !== undefined && { tags: arrayToCsv(data.tags) }),
        ...(data.partner !== undefined && { partner: data.partner || undefined }),
        ...(data.nationalPark !== undefined && { nationalPark: data.nationalPark || undefined }),
        ...(data.isVerified !== undefined && { isVerified: data.isVerified }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
        
        // Capacity & Ground Type
        ...(data.maxGuestsPerDay !== undefined && { maxGuestsPerDay: data.maxGuestsPerDay }),
        ...(data.maxTentsPerDay !== undefined && { maxTentsPerDay: data.maxTentsPerDay }),
        ...(data.groundType !== undefined && { 
          groundType: typeof data.groundType === 'string' ? data.groundType : JSON.stringify(data.groundType)
        }),
        
        // Pet & Display Settings
        ...(data.petFriendly !== undefined && { petFriendly: data.petFriendly }),
        ...(data.useSpotView !== undefined && { useSpotView: data.useSpotView }),
      }
    });

    return apiSuccess(updated);
  } catch (error) {
    return apiError('Failed to update campground', 500, error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Check ownership
  const { error: authError } = await requireCampSiteOwnership(id);
  if (authError) return authError;

  try {
    await prisma.campSite.delete({
      where: { id }
    });

    return apiSuccess({ success: true });
  } catch (error) {
    return apiError('Failed to delete campground', 500, error);
  }
}
