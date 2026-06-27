import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { campSiteSchema } from '@/lib/validations/campsite';
import { buildCampSiteWhere, type CampSiteFilterParams } from '@/lib/campsite-filters';
import { apiError, apiSuccess, arrayToCsv, resolveOptionConnect, imageCreateNested } from '@/lib/api-utils';
import { requireAuth } from '@/lib/auth-utils';
import { withTiming } from '@/lib/route-timing';
import { campCardSelect } from '@/lib/read-models/camp-card';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  // RISK-4: IP-based rate-limit on the list endpoint (100 req / 15 min).
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = checkRateLimit(`campgrounds:list:${ip}`, { limit: 100, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSec) },
    });
  }

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

    // RISK-4: cap result set to prevent unbounded fetches.
    const campSites = await withTiming('campground_list', () =>
      prisma.campSite.findMany({
        where,
        select: campCardSelect,
        take: 50,
      })
    );

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

  // Rate-limit: 10 camp creations per user per hour (shared key with campsites route).
  const rl = checkRateLimit(`campsite:create:${userId}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: 'rate_limited', message: 'ถึงขีดจำกัดการสร้างแคมป์แล้ว กรุณาลองใหม่ภายหลัง' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSec) } }
    );
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
        campSiteType: ((Array.isArray(data.campSiteType) ? data.campSiteType[0] : data.campSiteType) || "CAMPGROUND") as string,
        accommodationTypes: (arrayToCsv(data.accommodationTypes) ?? "") as string,

        // S4a: 6 multi-value taxonomies → validated options connect (unknown codes dropped, not 500)
        options: {
          connect: await resolveOptionConnect([
            data.accessTypes, data.facilities, data.externalFacilities,
            data.equipment, data.activities, data.terrain,
          ]),
        },

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
        images: imageCreateNested(data.images),
        
        // isVerified is the platform trust badge — only a platform ADMIN may set it on create
        // (mirrors campsites route + applyAdminOnlyFields on PUT). A self-registering host cannot grant it.
        isVerified: session?.user?.role === 'ADMIN' ? (data.isVerified ?? false) : false,
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
