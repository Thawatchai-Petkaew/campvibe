import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { campSiteSchema } from '@/lib/validations/campsite';
import { buildCampSiteWhere, type CampSiteFilterParams } from '@/lib/campsite-filters';
import { apiError, apiSuccess, arrayToCsv } from '@/lib/api-utils';
import { requireAuth } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const filterParams: CampSiteFilterParams = {
      type: searchParams.get('type') || undefined,
      keyword: searchParams.get('keyword') || undefined,
      province: searchParams.get('province') || undefined,
      district: searchParams.get('district') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      guests: searchParams.get('guests') || undefined,
      min: searchParams.get('min') || undefined,
      max: searchParams.get('max') || undefined,
      access: searchParams.get('access') || undefined,
      facilities: searchParams.get('facilities') || undefined,
      external: searchParams.get('external') || undefined,
      equipment: searchParams.get('equipment') || undefined,
      activities: searchParams.get('activities') || undefined,
      terrain: searchParams.get('terrain') || undefined,
    };

    const where = buildCampSiteWhere(filterParams);

    const campSites = await prisma.campSite.findMany({
      where,
      include: {
        location: true,
        spots: true,
        reviews: { select: { rating: true } }
      },
    });
    
    return apiSuccess(campSites);
  } catch (error) {
    return apiError('Failed to fetch campgrounds', 500, error);
  }
}

export async function POST(request: NextRequest) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  const userId = session?.user?.id;
  if (!userId) {
    return apiError('User ID not found in session', 401);
  }

  try {
    const body = await request.json();

    // Validate with Zod
    const validation = campSiteSchema.safeParse(body);

    if (!validation.success) {
      return apiError('Validation Error', 400, validation.error.format());
    }

    const data = validation.data;

    // Ensure slugs are available
    const nameThSlug = data.nameThSlug || data.nameTh.toLowerCase().replace(/\s+/g, '-');
    const nameEnSlug = data.nameEnSlug || (data.nameEn || data.nameTh).toLowerCase().replace(/\s+/g, '-');

    const campSite = await prisma.campSite.create({
      data: {
        nameTh: data.nameTh,
        nameEn: data.nameEn,
        nameThSlug: nameThSlug,
        nameEnSlug: nameEnSlug,
        description: data.description || "",
        campSiteType: (data.campSiteType 
          ? (Array.isArray(data.campSiteType) ? arrayToCsv(data.campSiteType) : data.campSiteType)
          : "CAMPGROUND") as string,

        // Convert arrays to CSV strings
        accessTypes: (data.accessTypes ? arrayToCsv(data.accessTypes) : "") as string,
        accommodationTypes: (data.accommodationTypes ? arrayToCsv(data.accommodationTypes) : "") as string,
        facilities: (data.facilities ? arrayToCsv(data.facilities) : "") as string,
        externalFacilities: (data.externalFacilities ? arrayToCsv(data.externalFacilities) : "") as string,
        equipment: (data.equipment ? arrayToCsv(data.equipment) : "") as string,
        activities: (data.activities ? arrayToCsv(data.activities) : "") as string,
        terrain: (data.terrain ? arrayToCsv(data.terrain) : "") as string,

        address: data.address,
        directions: data.directions,
        videoUrl: data.videoUrl || undefined,
        logo: data.logo || undefined,
        
        // Contact Information
        phone: data.phone || undefined,
        lineId: data.lineId || undefined,
        facebookUrl: data.facebookUrl || undefined,
        facebookMessageUrl: data.facebookMessageUrl || undefined,
        tiktokUrl: data.tiktokUrl || undefined,
        feeInfo: data.feeInfo,
        toiletInfo: data.toiletInfo,
        minimumAge: data.minimumAge,
        tags: arrayToCsv(data.tags || []),

        latitude: data.latitude,
        longitude: data.longitude,
        checkInTime: data.checkInTime,
        checkOutTime: data.checkOutTime,
        bookingMethod: data.bookingMethod,
        priceLow: data.priceLow,
        priceHigh: data.priceHigh,

        partner: data.partner,
        nationalPark: data.nationalPark,
        images: arrayToCsv(data.images || []),
        
        isVerified: data.isVerified ?? false,
        isActive: data.isActive ?? true,
        isPublished: data.isPublished ?? false,
        
        // Capacity & Ground Type
        maxGuestsPerDay: data.maxGuestsPerDay,
        maxTentsPerDay: data.maxTentsPerDay,
        groundType: data.groundType ? (typeof data.groundType === 'string' ? data.groundType : JSON.stringify(data.groundType)) : undefined,

        // Ownership & Pricing
        ownershipType: data.ownershipType || undefined,
        isFree: data.isFree ?? false,

        // Pet & Display Settings
        petFriendly: data.petFriendly ?? false,
        useSpotView: data.useSpotView ?? false,

        locationId: data.locationId,
        operatorId: userId,
      },
    });

    return apiSuccess(campSite, 201);
  } catch (error) {
    return apiError('Failed to create campground', 500, error);
  }
}
