import { NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { campSiteSchema } from '@/lib/validations/campsite';
import { catalogQuerySchema } from '@/lib/validations/catalog-cursor';
import { buildCampSiteWhere } from '@/lib/campsite-filters';
import { apiError, apiSuccess, arrayToCsv, resolveOptionConnect, imageCreateNested } from '@/lib/api-utils';
import { serializeDecimals } from '@/lib/serialize';
import { requireAuth } from '@/lib/auth-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/route-timing';
import { campCardSelect } from '@/lib/read-models/camp-card';
import { CATALOG_TAG } from '@/lib/catalog-cache';
import { getAvailabilityStatusForCamps, type CampAvailabilityStatus } from '@/lib/campsite-availability';
import { computeListingCompleteness, PUBLISH_MIN_COMPLETENESS, publishGateBlockedMessage } from '@/lib/listing-completeness';
import {
  decodeCursor,
  buildKeysetWhere,
  orderByFor,
  encodeCursorFromItem,
  PAGE_SIZE,
  type CatalogSort,
} from '@/lib/catalog-cursor';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // 1. Validate at the boundary — zod-parse every query param.
    const rawParams: Record<string, string | undefined> = {};
    searchParams.forEach((value, key) => { rawParams[key] = value; });

    const parsed = catalogQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters' } },
        { status: 400 }
      );
    }

    const {
      sort,
      cursor: cursorParam,
      type, keyword, province, district, startDate, endDate,
      guests, min, max, access, facilities, external, equipment, activities, terrain,
      annotatedFeatures,
    } = parsed.data;

    // 2. Decode cursor (SEC-1: never pass raw cursor to Prisma; decode first).
    let decodedCursor = null;
    if (cursorParam !== undefined) {
      decodedCursor = decodeCursor(cursorParam);
      if (decodedCursor === null) {
        return Response.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Invalid cursor' } },
          { status: 400 }
        );
      }
    }

    // 3. Build base filter (SEC-1: isActive/isPublished/deletedAt always present).
    const baseWhere = buildCampSiteWhere({
      type, keyword, province, district, startDate, endDate,
      guests, min, max, access, facilities, external, equipment, activities, terrain,
      annotatedFeatures,
    });

    // 4. Merge keyset WHERE via AND (never replaces the base gate).
    const where = decodedCursor
      ? { AND: [baseWhere, buildKeysetWhere(sort as CatalogSort, decodedCursor)] }
      : baseWhere;

    // 5. Query — take PAGE_SIZE + 1 to detect hasNextPage without a separate count.
    const rows = await withTiming('catalog_cursor_list', () =>
      prisma.campSite.findMany({
        where,
        select: campCardSelect,
        orderBy: orderByFor(sort as CatalogSort),
        take: PAGE_SIZE + 1,
      })
    );

    // 6. Detect next page: if we got PAGE_SIZE+1 rows, there is more data.
    const hasMore = rows.length > PAGE_SIZE;
    const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

    // 7. Compute nextCursor from the last item returned (null when end of results).
    const nextCursor: string | null =
      hasMore && items.length > 0
        ? encodeCursorFromItem(
            {
              id: items[items.length - 1].id,
              createdAt: items[items.length - 1].createdAt,
              // Decimal → number via toNumber() for cursor encoding
              priceLow:
                items[items.length - 1].priceLow !== null
                  ? Number(items[items.length - 1].priceLow)
                  : null,
              avgRating:
                items[items.length - 1].avgRating !== null
                  ? Number(items[items.length - 1].avgRating)
                  : null,
            },
            sort as CatalogSort
          )
        : null;

    // 7b. CAM-344 (BR-7): compute the dated-search availability badge ONLY
    // when both check-in and check-out are present — an undated cursor page
    // is byte-identical to before (no status computed, no badge). Fail-open
    // (AC-9/EC-8): a thrown/timed-out computation never blocks or empties
    // the page — caught here and simply yields no badge on any card.
    let availabilityByCampId: Record<string, CampAvailabilityStatus> = {};
    if (startDate && endDate && items.length > 0) {
      try {
        const guestsNum = guests ? parseInt(guests, 10) : 1;
        const requestedGuests = Number.isFinite(guestsNum) && guestsNum > 0 ? guestsNum : 1;
        availabilityByCampId = await getAvailabilityStatusForCamps(
          items.map((i) => i.id),
          new Date(startDate),
          new Date(endDate),
          requestedGuests
        );
      } catch (error) {
        console.error('[CAM-344] availability status computation failed (fail-open, no badge)', error);
        availabilityByCampId = {};
      }
    }

    // 8. Serialise Decimals at the boundary (priceLow/avgRating: Decimal → number).
    const serialisedItems = serializeDecimals(
      items.map((c) => {
        const availabilityStatus = availabilityByCampId[c.id];
        return {
          ...c,
          createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
          ...(availabilityStatus ? { availabilityStatus } : {}),
        };
      })
    );

    // 9. Return contract shape: { items, nextCursor }.
    return Response.json({ items: serialisedItems, nextCursor }, { status: 200 });
  } catch (error) {
    console.error('[API Error 500]: GET /api/campsites', error);
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch camp sites' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  const userId = session?.user?.id;
  if (!userId) {
    return apiError('User ID not found in session', 401);
  }

  // Rate-limit: 10 camp creations per user per hour (shared key with campgrounds route).
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

    // S4a: 6 multi-value taxonomies → validated options connect (unknown codes
    // dropped, not 500). Hoisted above the create() call (was inline before
    // CAM-365) so the SAME resolved+validated connect array feeds both the
    // actual write below AND the publish-gate projection's optionsCount —
    // one DB round trip, never two.
    const optionsConnect = await resolveOptionConnect([
      data.accessTypes, data.facilities, data.externalFacilities,
      data.equipment, data.activities, data.terrain,
      // CAM-515 (S3) — Annotated features, the FIRST new MasterData group.
      data.annotatedFeatures,
    ]);

    // CAM-365 BR-6: a create that requests isPublished=true is the same
    // false->true transition as the PUT path (there is no "stored" row yet -
    // it is implicitly false) - gated identically on the post-CREATE
    // projected score. The normal form create always sends
    // isPublished=false (components/CampgroundForm.tsx), so only a direct
    // API create can reach this. No role - including ADMIN - bypasses it
    // (BR-7): this check has no role branch.
    if (data.isPublished === true) {
      const { score, missing } = computeListingCompleteness({
        imageCount: data.images?.length ?? 0,
        priceLow: data.priceLow ?? null,
        isFree: data.isFree ?? false,
        extraFeeAmount: data.extraFeeAmount ?? null,
        extraFeeLabel: data.extraFeeLabel ?? null,
        cancellationPolicy: data.cancellationPolicy ?? null,
        spotCount: 0, // a create has no Spot rows yet — Spot is a separate resource
        optionsCount: optionsConnect.length,
        useSpotView: data.useSpotView ?? false,
        maxGuestsPerDay: data.maxGuestsPerDay ?? null,
      });

      if (score < PUBLISH_MIN_COMPLETENESS) {
        // Reject before any write — nothing is created at all (not even
        // unpublished), matching a 400's no-side-effect contract.
        return apiError(publishGateBlockedMessage(score), 400, { missing });
      }
    }

    const campSite = await prisma.campSite.create({
      data: {
        nameTh: data.nameTh,
        nameEn: data.nameEn,
        nameThSlug: nameThSlug,
        nameEnSlug: nameEnSlug,
        description: data.description || "",
        campSiteType: ((Array.isArray(data.campSiteType) ? data.campSiteType[0] : data.campSiteType) || "CAMPGROUND") as string,
        accommodationTypes: (arrayToCsv(data.accommodationTypes) ?? "") as string,

        // S4a: validated options connect resolved once above (CAM-365).
        options: {
          connect: optionsConnect,
        },

        address: data.address,
        directions: data.directions,
        videoUrl: data.videoUrl || undefined,
        // CAM-360: on create there is nothing to clear, but map '' / explicit
        // null to null consistently with the PUT route (rather than the old
        // blanket `|| undefined`) so the same input shape behaves the same
        // way on both write paths.
        logo: data.logo === '' || data.logo === null ? null : data.logo,
        
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

        // PREP-2 (CAM-268): atomic one-time fee + closed cancellation policy.
        extraFeeAmount: data.extraFeeAmount,
        extraFeeLabel: data.extraFeeLabel,
        cancellationPolicy: data.cancellationPolicy || undefined,

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
        // (mirrors applyAdminOnlyFields on the PUT path). A self-registering host cannot grant it.
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

    // FRESH-1: invalidate the public catalog cache after a new camp is created.
    // Called after the DB write succeeds, before the success response.
    revalidateTag(CATALOG_TAG, {});

    return apiSuccess(campSite, 201);
  } catch (error) {
    return apiError('Failed to create camp site', 500, error);
  }
}
