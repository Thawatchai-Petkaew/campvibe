import { NextRequest } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { campSiteSchema } from '@/lib/validations/campsite';
import { requireCampSitePermission } from '@/lib/auth-utils';
import { apiError, apiSuccess, arrayToCsv, resolveOptionConnect, imageReplaceNested } from '@/lib/api-utils';
import { getCampSiteWithCapacity } from '@/lib/spot-aggregation';
import { applyAdminOnlyFields } from '@/lib/admin-fields';
import { auth } from '@/lib/auth';
import { isCampSitePublic, canViewCampSite } from '@/lib/campsite-visibility';
import { CATALOG_TAG, campTag } from '@/lib/catalog-cache';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Use spot aggregation if useSpotView is enabled
    const campSite = await getCampSiteWithCapacity(id);

    if (!campSite) {
      return apiError('Camp site not found', 404);
    }

    // SEC-1: gate non-public campsites. Auth is lazy — only called when the camp
    // is not public so the hot path (public camp) pays zero auth overhead.
    if (!isCampSitePublic(campSite)) {
      const session = await auth();
      if (!canViewCampSite(campSite, session)) {
        // 404 not 403 — no information-disclosure (don't confirm the camp exists).
        return apiError('Camp site not found', 404);
      }
    }

    return apiSuccess(campSite);
  } catch (error) {
    return apiError('Failed to fetch camp site', 500, error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Check permission
  const { error: authError, campSite: existing, session } = await requireCampSitePermission(id, "CAMPSITE_UPDATE");
  if (authError) return authError;

  try {
    const body = await request.json();

    // Validate with Zod (partial validation for updates)
    const validation = campSiteSchema.partial().safeParse(body);
    if (!validation.success) {
      return apiError('Validation Error', 400, validation.error.format());
    }

    // Strip admin-only fields (isVerified, verifiedDate) for non-admin callers.
    // Role is sourced from the server-side session — never the request body.
    const data = applyAdminOnlyFields(
      validation.data as Record<string, unknown>,
      session.user?.role
    ) as typeof validation.data;

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
        ...(data.campSiteType?.length && { campSiteType: (Array.isArray(data.campSiteType) ? data.campSiteType[0] : data.campSiteType) as string }),
        ...(data.accommodationTypes?.length && { accommodationTypes: arrayToCsv(data.accommodationTypes) as string }),
        // S4a: only replace the options relation when the request actually carried a taxonomy
        // field. zod .default([]) makes parsed values always-present, so gate on the RAW body —
        // otherwise a partial PUT (e.g. price-only) would wipe every option.
        ...((['accessTypes', 'facilities', 'externalFacilities', 'equipment', 'activities', 'terrain'].some((k) => k in body)) && {
          options: {
            set: await resolveOptionConnect([
              data.accessTypes, data.facilities, data.externalFacilities,
              data.equipment, data.activities, data.terrain,
            ]),
          },
        }),

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
        ...('images' in body && { images: imageReplaceNested(data.images) }),
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
        
        // Ownership & Pricing
        ...(data.ownershipType !== undefined && { ownershipType: data.ownershipType || undefined }),
        ...(data.isFree !== undefined && { isFree: data.isFree }),
        
        // Pet & Display Settings
        ...(data.petFriendly !== undefined && { petFriendly: data.petFriendly }),
        ...(data.useSpotView !== undefined && { useSpotView: data.useSpotView }),
      }
    });

    // FRESH-1: invalidate the camp-specific cache entry and the broad catalog
    // cache after any edit (including isPublished flips for publish/unpublish).
    // revalidatePath covers the detail page URL for both slug variants.
    // Called after the DB write succeeds, before the success response.
    revalidateTag(campTag(id), {});
    revalidateTag(CATALOG_TAG, {});
    revalidatePath('/campgrounds/' + updated.nameThSlug);
    revalidatePath('/campgrounds/' + updated.nameEnSlug);

    return apiSuccess(updated);
  } catch (error) {
    return apiError('Failed to update camp site', 500, error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Check permission
  const { error: authError } = await requireCampSitePermission(id, "CAMPSITE_DELETE");
  if (authError) return authError;

  try {
    await prisma.campSite.delete({
      where: { id }
    });

    // FRESH-1: invalidate the camp-specific cache entry and the broad catalog
    // cache after deletion. Called after the DB write succeeds, before the
    // success response.
    revalidateTag(campTag(id), {});
    revalidateTag(CATALOG_TAG, {});

    return apiSuccess({ success: true });
  } catch (error) {
    return apiError('Failed to delete camp site', 500, error);
  }
}
