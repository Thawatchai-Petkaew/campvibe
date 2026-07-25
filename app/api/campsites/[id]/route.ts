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
import { CATALOG_TAG, campTag, campSlugTag } from '@/lib/catalog-cache';
import { computeListingCompleteness, PUBLISH_MIN_COMPLETENESS, publishGateBlockedMessage } from '@/lib/listing-completeness';

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

    // CAM-365 BR-3/BR-4/BR-5/BR-7: gate a false->true isPublished transition
    // on the POST-SAVE PROJECTED completeness score. Detected by comparing
    // the STORED isPublished (existing, from requireCampSitePermission above)
    // against this request's value - an omitted isPublished, an unchanged
    // `true`, or any ->false transition never evaluates the score at all (no
    // auto-unpublish, no wasted queries on an ordinary edit). No role -
    // including ADMIN - bypasses this (BR-7): `existing`/`data` here carry no
    // role branch.
    // S4a: only replace the options relation when the request actually carried a taxonomy
    // field. zod .default([]) makes parsed values always-present, so gate on the RAW body —
    // otherwise a partial PUT (e.g. price-only) would wipe every option.
    // Hoisted above the gate (G3 I-1 fix): the write further below ALREADY
    // unconditionally resolves this exact set whenever `replacesOptions` is
    // true (moving it earlier adds no new query on any path) - hoisting lets
    // the publish-gate projection reuse the SAME resolved+validated connect
    // array the write uses, instead of a stale pre-write live count, mirroring
    // the `images` special-case below (BR-4 symmetry).
    // CAM-515 (S3)/EC-2: `annotatedFeatures` added to BOTH this guard array
    // and the resolveOptionConnect array below — a partial PUT that omits it
    // (e.g. price-only) must not wipe the Annotated features relation either.
    // CAM-516 (S4)/EC-2: same guard applied to `camperStyle` (the SECOND new
    // MasterData group) — identical partial-PUT-must-not-wipe protection.
    const replacesOptions = ['accessTypes', 'facilities', 'externalFacilities', 'equipment', 'activities', 'terrain', 'annotatedFeatures', 'camperStyle'].some((k) => k in body);
    const resolvedOptionsConnect = replacesOptions
      ? await resolveOptionConnect([
          data.accessTypes, data.facilities, data.externalFacilities,
          data.equipment, data.activities, data.terrain, data.annotatedFeatures, data.camperStyle,
        ])
      : null;

    const isPublishTransition = data.isPublished === true && existing!.isPublished === false;
    if (isPublishTransition) {
      // BR-4 post-save projection: the state AS IT WILL BE after THIS save -
      // stored atomic fields overlaid with this request's changed fields,
      // plus the relation counts. `images` AND `options` both special-case:
      // if this same request replaces that relation, the projection counts
      // what THIS write will persist (the request's own resolved set)
      // instead of the stale pre-write count - this is what lets one save
      // both complete the last missing photo/amenity AND publish (AC-3).
      // `spots` is never touched by this PUT body (a separate resource), so
      // it is always a live read.
      const [relCounts, spotCount] = await Promise.all([
        prisma.campSite.findUnique({
          where: { id },
          select: { _count: { select: { images: true, options: true } } },
        }),
        prisma.spot.count({ where: { campSiteId: id, deletedAt: null } }),
      ]);

      const projectedExtraFeeAmount =
        data.extraFeeAmount !== undefined
          ? data.extraFeeAmount
          : existing!.extraFeeAmount !== null
            ? Number(existing!.extraFeeAmount)
            : null;
      const projectedExtraFeeLabel =
        data.extraFeeLabel !== undefined
          ? (data.extraFeeLabel === '' || data.extraFeeLabel === null ? null : data.extraFeeLabel)
          : existing!.extraFeeLabel;
      const projectedCancellationPolicy =
        data.cancellationPolicy !== undefined
          ? (data.cancellationPolicy === null ? null : data.cancellationPolicy)
          : existing!.cancellationPolicy;

      const { score, missing } = computeListingCompleteness({
        imageCount: 'images' in body ? (data.images?.length ?? 0) : (relCounts?._count.images ?? 0),
        priceLow:
          data.priceLow !== undefined
            ? data.priceLow
            : existing!.priceLow !== null
              ? Number(existing!.priceLow)
              : null,
        isFree: data.isFree !== undefined ? data.isFree : existing!.isFree,
        extraFeeAmount: projectedExtraFeeAmount,
        extraFeeLabel: projectedExtraFeeLabel,
        cancellationPolicy: projectedCancellationPolicy,
        spotCount,
        optionsCount: replacesOptions
          ? (resolvedOptionsConnect?.length ?? 0)
          : (relCounts?._count.options ?? 0),
        useSpotView: data.useSpotView !== undefined ? data.useSpotView : existing!.useSpotView,
        maxGuestsPerDay:
          data.maxGuestsPerDay !== undefined ? data.maxGuestsPerDay : existing!.maxGuestsPerDay,
      });

      if (score < PUBLISH_MIN_COMPLETENESS) {
        // No write happens at all - reject before the location update and
        // the campSite.update below (AC-1/AC-4: isPublished stays unchanged).
        return apiError(publishGateBlockedMessage(score), 400, { missing });
      }
    }

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
        // field (`replacesOptions`/`resolvedOptionsConnect` resolved once above, CAM-365 I-1 —
        // reused here so the write and the publish-gate projection can never disagree).
        ...(replacesOptions && {
          options: {
            set: resolvedOptionsConnect ?? [],
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

        // PREP-2 (CAM-268) + CAM-341 clearing fix: undefined (key omitted) means
        // skip - a partial update must never touch a field it did not send. An
        // explicit null means clear the column. The old `|| undefined` mapping
        // collapsed null/empty into "skip" too, so a host clearing extraFeeLabel
        // or cancellationPolicy silently no-op'd (Prisma treats `field: undefined`
        // identically to an omitted key - it never writes NULL). extraFeeAmount
        // already forwarded its value as-is (no `|| undefined` bug), so once the
        // schema accepts an explicit null it clears correctly with no change here.
        ...(data.extraFeeAmount !== undefined && { extraFeeAmount: data.extraFeeAmount }),
        ...(data.extraFeeLabel !== undefined && {
          extraFeeLabel: data.extraFeeLabel === '' || data.extraFeeLabel === null ? null : data.extraFeeLabel,
        }),
        ...(data.cancellationPolicy !== undefined && {
          cancellationPolicy: data.cancellationPolicy === null ? null : data.cancellationPolicy,
        }),

        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.checkInTime && { checkInTime: data.checkInTime }),
        ...(data.checkOutTime && { checkOutTime: data.checkOutTime }),
        ...(data.bookingMethod && { bookingMethod: data.bookingMethod }),
        ...(data.priceLow !== undefined && { priceLow: data.priceLow }),
        ...(data.priceHigh !== undefined && { priceHigh: data.priceHigh }),
        ...('images' in body && { images: imageReplaceNested(data.images) }),
        // CAM-360 clearing fix (same class as CAM-341, see comment above): the
        // old `data.logo || undefined` collapsed both '' and an explicit null
        // into "skip" - a host clearing the logo never actually cleared the
        // column. undefined (key omitted) still skips the field entirely;
        // '' or null now map to an explicit null write.
        ...(data.logo !== undefined && {
          logo: data.logo === '' || data.logo === null ? null : data.logo,
        }),
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
    // CAM-357: also bust the slug-keyed getCampBySlug cache entry directly —
    // campTag(id) alone cannot reach it (that cache entry is keyed + tagged by
    // slug, not by id); mirrors the spot/zone write paths (CAM-353 BR-8).
    revalidateTag(campTag(id), {});
    revalidateTag(CATALOG_TAG, {});
    revalidateTag(campSlugTag(updated.nameThSlug), {});
    revalidateTag(campSlugTag(updated.nameEnSlug), {});
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
    // Capture the deleted row (Prisma returns the full deleted record by default)
    // so the slug-keyed cache bust below needs no extra lookup (no N+1).
    const deleted = await prisma.campSite.delete({
      where: { id }
    });

    // FRESH-1: invalidate the camp-specific cache entry and the broad catalog
    // cache after deletion. Called after the DB write succeeds, before the
    // success response.
    // CAM-357: also bust the slug-keyed getCampBySlug cache entry directly —
    // campTag(id) alone cannot reach it (see PUT above for the full reasoning).
    revalidateTag(campTag(id), {});
    revalidateTag(CATALOG_TAG, {});
    revalidateTag(campSlugTag(deleted.nameThSlug), {});
    revalidateTag(campSlugTag(deleted.nameEnSlug), {});

    return apiSuccess({ success: true });
  } catch (error) {
    return apiError('Failed to delete camp site', 500, error);
  }
}
