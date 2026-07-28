import { NextRequest } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { campSiteSchema, isPriceOrderValid, PRICE_ORDER_ERROR } from '@/lib/validations/campsite';
import { requireCampSitePermission } from '@/lib/auth-utils';
import { apiError, apiSuccess, arrayToCsv, resolveOptionConnect, imageReplaceNested, clearableWrite } from '@/lib/api-utils';
import { getCampSiteWithCapacity } from '@/lib/spot-aggregation';
import { applyAdminOnlyFields } from '@/lib/admin-fields';
import { auth } from '@/lib/auth';
import { isCampSitePublic, canViewCampSite } from '@/lib/campsite-visibility';
import { CATALOG_TAG, campTag, campSlugTag } from '@/lib/catalog-cache';
import { computeListingCompleteness, PUBLISH_MIN_COMPLETENESS, publishGateBlockedMessage } from '@/lib/listing-completeness';
import { updateCampSiteLocationSchema } from '@/lib/validations/location';
import { checkRateLimit } from '@/lib/rate-limit';

// CAM-619 — PUT/DELETE on this SAME resource had NO rate limit at all while
// the sibling POST (create, app/api/campsites/route.ts) is capped at
// 10/hour/user. `components/CampgroundForm.tsx` fires exactly ONE PUT per
// explicit Save click (no autosave/loop) and exactly ONE DELETE per explicit
// delete confirmation — never a bulk loop (verified: grep of every
// `/api/campsites/${id}` caller). An edit session legitimately re-saves
// several times while working through the publish-completeness gate
// (isPublishTransition below rejects a low-completeness save and expects the
// host to add data and save AGAIN), so PUT gets more headroom than the
// one-shot POST/DELETE actions; DELETE mirrors POST's cadence — deleting a
// listing is rare and deliberate, never something a real host loops.
const CAMPSITE_UPDATE_RATE_LIMIT = 30;
const CAMPSITE_UPDATE_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const CAMPSITE_DELETE_RATE_LIMIT = 10;
const CAMPSITE_DELETE_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

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

  // CAM-619: rate-limit AFTER the permission check (not before, unlike POST's
  // IP-based limit above) — requireCampSitePermission is the ONE shared
  // helper that resolves both auth AND ownership in a single call and lives
  // outside this story's file surface, so the userId it returns is used here
  // rather than re-deriving it earlier.
  const rl = checkRateLimit(`campsite:update:${session.user?.id ?? 'unknown'}`, {
    limit: CAMPSITE_UPDATE_RATE_LIMIT,
    windowMs: CAMPSITE_UPDATE_RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: 'rate_limited', message: 'ถึงขีดจำกัดการแก้ไขแคมป์แล้ว กรุณาลองใหม่ภายหลัง' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

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

    // CAM-619 BR: priceLow<=priceHigh — a PARTIAL PUT may send only one side,
    // so project the EFFECTIVE post-save value for whichever side is absent
    // from THIS request (same "post-save projection" idiom the isPublished
    // gate below already uses for extraFeeAmount/extraFeeLabel/
    // cancellationPolicy) rather than comparing only the two fields this
    // request happens to carry. Runs before any write (no side effect yet).
    // `== null` (not `!== null`) on the stored side deliberately treats an
    // absent/`undefined` stored value the SAME as an explicit `null` — a real
    // Prisma row always carries one or the other, never `undefined`, but this
    // check runs on every PUT (not gated like the isPublished projection
    // below), so it must not misread a test double / partial object that
    // simply never set the field as "an inverted price".
    const projectedPriceLow =
      data.priceLow !== undefined ? data.priceLow : (existing!.priceLow == null ? null : Number(existing!.priceLow));
    const projectedPriceHigh =
      data.priceHigh !== undefined ? data.priceHigh : (existing!.priceHigh == null ? null : Number(existing!.priceHigh));
    if (!isPriceOrderValid({ priceLow: projectedPriceLow, priceHigh: projectedPriceHigh })) {
      return apiError(PRICE_ORDER_ERROR, 400);
    }

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
    // CAM-521 (S8)/EC-2: same guard applied to `stayConnected`/`markingMethod`/
    // `driveway` (the final taxonomy slice — host-input + camper-detail-
    // display only, NOT searchable, see BR-4).
    const replacesOptions = ['accessTypes', 'facilities', 'externalFacilities', 'equipment', 'activities', 'terrain', 'annotatedFeatures', 'camperStyle', 'stayConnected', 'markingMethod', 'driveway'].some((k) => k in body);
    const resolvedOptionsConnect = replacesOptions
      ? await resolveOptionConnect([
          data.accessTypes, data.facilities, data.externalFacilities,
          data.equipment, data.activities, data.terrain, data.annotatedFeatures, data.camperStyle,
          data.stayConnected, data.markingMethod, data.driveway,
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

    // Update Location's free-text fields if provided.
    //
    // CAM-575: this route never writes Location.lat/lon directly (never did),
    // but the old comment here ("lat/lon are NOT updated from camp site data -
    // they remain independent") described a real defect, not a design choice:
    // the `campSite.update` below DOES write `data.latitude`/`data.longitude`
    // on every pin edit, and nothing kept `Location.lat/lon` in sync with it -
    // this is very likely how the 4 real camps CAM-575 found diverged (an
    // edited pin moved CampSite's coordinates but never touched Location's).
    // `CampSite.latitude/longitude` is now the canonical source (owner
    // decision, 2026-07-26) and the `campsite_coords_sync` DB trigger
    // (prisma/migrations/20260726165149_cam575_...) derives
    // `Location.lat/lon` automatically the moment the `campSite.update` below
    // runs - no application code here needs to touch it.
    //
    // CAM-556/CAM-559: `province`/`district`/`subDistrict` live on the related
    // `Location` row, not on `CampSite` — they are NOT part of `campSiteSchema`,
    // so they were previously read straight off the raw, unvalidated body
    // (`(body as any).province`) and ONLY `province` was ever written. A host
    // could pick all three levels on create (CAM-553's fixed path) and lose
    // district/subDistrict on the very next edit. Validate all three at the
    // boundary here (same zod-at-the-boundary rule as every other field on
    // this route), then write only the ones actually present in the body —
    // an explicit "" clears the column to null (CAM-341/CAM-360 pattern);
    // an omitted key is a true no-op skip (never touches the column).
    const locationFieldsValidation = updateCampSiteLocationSchema.safeParse({
      province: (body as Record<string, unknown>).province,
      district: (body as Record<string, unknown>).district,
      subDistrict: (body as Record<string, unknown>).subDistrict,
    });
    if (!locationFieldsValidation.success) {
      return apiError('Validation Error', 400, locationFieldsValidation.error.format());
    }
    const locationFields = locationFieldsValidation.data;
    const hasLocationFieldEdit =
      locationFields.province !== undefined ||
      locationFields.district !== undefined ||
      locationFields.subDistrict !== undefined;

    // CAM-613: target the Location of the camp that was ACTUALLY authorised
    // above (`existing.locationId`, a plain scalar column requireCampSitePermission
    // already fetched and proved belongs to the path's `id`) - never a
    // body-supplied `data.locationId`. The old code read `data.locationId`
    // here, so a host owning camp A could send `{ locationId: <camp B's
    // locationId>, province: "", ... }` on a PUT to their OWN camp A and
    // blank camp B's location - authorisation and the write concerned two
    // different objects. A body-supplied `locationId` is now silently
    // ignored for this purpose (see tech.md's ignore-vs-reject decision);
    // it remains a valid field on `campSiteSchema` for POST /api/campsites
    // (create), an unrelated, unaffected operation.
    if (hasLocationFieldEdit) {
      await prisma.location.update({
        where: { id: existing!.locationId },
        data: {
          ...(locationFields.province !== undefined && {
            province: locationFields.province === '' ? null : locationFields.province,
          }),
          ...(locationFields.district !== undefined && {
            district: locationFields.district === '' ? null : locationFields.district,
          }),
          ...(locationFields.subDistrict !== undefined && {
            subDistrict: locationFields.subDistrict === '' ? null : locationFields.subDistrict,
          }),
          // CAM-575: lat/lon are never set here - Location.lat/lon is derived
          // from CampSite.latitude/longitude by the campsite_coords_sync DB
          // trigger, fired by the campSite.update below.
        }
      });
    }

    const updated = await prisma.campSite.update({
      where: { id },
      data: {
        ...(data.nameTh && { nameTh: data.nameTh }),
        // CAM-615: nameEn/description/address/directions/feeInfo/toiletInfo
        // never had the `|| undefined` collapse bug (they always forwarded
        // the raw value) — clearableWrite is applied here anyway so every
        // clearable field shares the SAME mapping, not "some fields happen to
        // already be correct" left as an unexplained inconsistency.
        ...(data.nameEn !== undefined && { nameEn: clearableWrite(data.nameEn) }),
        ...(data.description !== undefined && { description: clearableWrite(data.description) }),
        // CAM-520: single required scalar enum on the shared schema; PUT's
        // `.partial()` makes it optional here — presence-guarded, written
        // verbatim (no [0]/"CAMPGROUND" coercion).
        ...(data.campSiteType !== undefined && { campSiteType: data.campSiteType }),
        // CAM-526 fix (same clearing-bug class as CAM-341/CAM-360): the old
        // `?.length` guard treated an intentional "host cleared every
        // selection" (an explicit `[]`) identically to "field omitted" — an
        // empty array is falsy on `.length` so the write was skipped and a
        // previously-set value could never be removed. Gate on RAW BODY
        // presence (`'accommodationTypes' in body`), NOT `data.accommodationTypes
        // !== undefined` — the schema's `z.array(...).default([])` makes the
        // PARSED value always-present (`[]` when the key is omitted; see the
        // `replacesOptions` comment above for the same documented pitfall),
        // so a `!== undefined` check would incorrectly fire — and WIPE the
        // column — on every unrelated partial edit (e.g. a price-only PUT).
        // The column is a non-nullable `String` (no relation involved), so an
        // explicit empty array must write `''`, not `undefined` —
        // `arrayToCsv([])` returns `undefined`, which Prisma treats as "leave
        // untouched", so the `?? ''` fallback is required for the clear to
        // actually persist.
        ...('accommodationTypes' in body && {
          accommodationTypes: arrayToCsv(data.accommodationTypes) ?? '',
        }),
        // S4a: only replace the options relation when the request actually carried a taxonomy
        // field (`replacesOptions`/`resolvedOptionsConnect` resolved once above, CAM-365 I-1 —
        // reused here so the write and the publish-gate projection can never disagree).
        ...(replacesOptions && {
          options: {
            set: resolvedOptionsConnect ?? [],
          },
        }),

        ...(data.address !== undefined && { address: clearableWrite(data.address) }),
        ...(data.directions !== undefined && { directions: clearableWrite(data.directions) }),
        // CAM-615: videoUrl/phone/lineId/facebookUrl/facebookMessageUrl/
        // tiktokUrl/partner/nationalPark all carried the SAME `x || undefined`
        // collapse — the form already sends a real '' when a host clears one
        // of these (no client bug), but this mapping turned that '' back into
        // `undefined`, which the outer `!== undefined` guard had already let
        // through as "present" — so the column was never actually written to
        // NULL. clearableWrite is the one shared replacement (see
        // lib/api-utils.ts) for every field in this group.
        ...(data.videoUrl !== undefined && { videoUrl: clearableWrite(data.videoUrl) }),
        ...(data.feeInfo !== undefined && { feeInfo: clearableWrite(data.feeInfo) }),

        // Contact Information
        ...(data.phone !== undefined && { phone: clearableWrite(data.phone) }),
        ...(data.lineId !== undefined && { lineId: clearableWrite(data.lineId) }),
        ...(data.facebookUrl !== undefined && { facebookUrl: clearableWrite(data.facebookUrl) }),
        ...(data.facebookMessageUrl !== undefined && { facebookMessageUrl: clearableWrite(data.facebookMessageUrl) }),
        ...(data.tiktokUrl !== undefined && { tiktokUrl: clearableWrite(data.tiktokUrl) }),
        ...(data.toiletInfo !== undefined && { toiletInfo: clearableWrite(data.toiletInfo) }),
        ...(data.minimumAge !== undefined && { minimumAge: clearableWrite(data.minimumAge) }),

        // PREP-2 (CAM-268) + CAM-341/CAM-360/CAM-615 clearing fix: undefined
        // (key omitted) means skip - a partial update must never touch a
        // field it did not send. An explicit null (or '') means clear the
        // column, via the one shared clearableWrite mapping (lib/api-utils.ts)
        // instead of three near-identical hand-rolled versions.
        ...(data.extraFeeAmount !== undefined && { extraFeeAmount: clearableWrite(data.extraFeeAmount) }),
        ...(data.extraFeeLabel !== undefined && { extraFeeLabel: clearableWrite(data.extraFeeLabel) }),
        ...(data.cancellationPolicy !== undefined && { cancellationPolicy: clearableWrite(data.cancellationPolicy) }),

        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.checkInTime && { checkInTime: data.checkInTime }),
        ...(data.checkOutTime && { checkOutTime: data.checkOutTime }),
        ...(data.bookingMethod && { bookingMethod: data.bookingMethod }),
        ...(data.priceLow !== undefined && { priceLow: clearableWrite(data.priceLow) }),
        ...(data.priceHigh !== undefined && { priceHigh: clearableWrite(data.priceHigh) }),
        ...('images' in body && { images: imageReplaceNested(data.images) }),
        ...(data.logo !== undefined && { logo: clearableWrite(data.logo) }),
        // CAM-615: `arrayToCsv([])` returns `undefined` (its documented "empty
        // in, nothing to store" contract) — mapping that straight into the
        // write let a host's "remove every tag" silently skip, the SAME shape
        // CAM-526 already fixed for accommodationTypes (`?? ''`, a non-null
        // column). `tags` is nullable, so the empty case maps to `?? null`.
        ...(data.tags !== undefined && { tags: arrayToCsv(data.tags) ?? null }),
        ...(data.partner !== undefined && { partner: clearableWrite(data.partner) }),
        ...(data.nationalPark !== undefined && { nationalPark: clearableWrite(data.nationalPark) }),
        ...(data.isVerified !== undefined && { isVerified: data.isVerified }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.isPublished !== undefined && { isPublished: data.isPublished }),

        // Capacity & Ground Type
        // CAM-615: maxGuestsPerDay/maxTentsPerDay forward the value as-is (no
        // `|| undefined` bug here) — an explicit `null` now round-trips to
        // NULL ("unbounded", per lib/campsite-filters.ts) now that the zod
        // schema accepts it; the WHOLE-CAMP form still requires a stated
        // value >= 1 to save (CAM-351 BR-2/AC-11, an intentional product rule
        // this story does not change) — null is reachable via a PER-SPOT save
        // and via the API contract directly.
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
  const { error: authError, session } = await requireCampSitePermission(id, "CAMPSITE_DELETE");
  if (authError) return authError;

  // CAM-619: DELETE had no rate limit at all — mirrors POST create's cadence
  // (a rare, deliberate, one-shot action per camp; see the shared reasoning
  // comment above the constants at the top of this file).
  const rl = checkRateLimit(`campsite:delete:${session.user?.id ?? 'unknown'}`, {
    limit: CAMPSITE_DELETE_RATE_LIMIT,
    windowMs: CAMPSITE_DELETE_RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: 'rate_limited', message: 'ถึงขีดจำกัดการลบแคมป์แล้ว กรุณาลองใหม่ภายหลัง' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

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
