/**
 * cam-365-publish-gate.test.ts — CAM-365
 *
 * The publish gate: an unpublished→published transition is rejected
 * server-side (BR-5) when the POST-SAVE PROJECTED listing-completeness score
 * (lib/listing-completeness.ts, CAM-304, unchanged here) is below the single
 * exported floor `PUBLISH_MIN_COMPLETENESS` (BR-1). The client (CampgroundForm)
 * mirrors the same rule for UX only (disables the switch + shows the missing
 * list) — the server is always the sole authority (BR-5, ux.md rule 1).
 *
 * IMPORTANT reachability note (documented, not a bug): CAM-304's weight table
 * (LISTING_COMPLETENESS_WEIGHTS, frozen/unchanged by this story) is
 * {25,20,20,15,10,10} — every criterion weight is a multiple of 5, so every
 * achievable score is ALSO a multiple of 5. The story's illustrative AC/EC
 * copy uses "79%"/"81%"/"60%" purely as narrative flavor; 79 and 81 are not
 * literally producible by the real scoring function (the nearest achievable
 * values that straddle the 80 floor are 75/80/85). The route-level boundary
 * tests below use real, achievable scores (60/75/80/85) to exercise the same
 * `score < PUBLISH_MIN_COMPLETENESS` comparison the spec describes; a
 * dedicated unit test on `publishGateBlockedMessage` proves the verbatim copy
 * template is correct for ANY N, including the spec's literal example numbers
 * (60, 79), independent of achievability.
 *
 * Layer: unit (lib/listing-completeness.ts additions) + mocked-Prisma route
 * integration (PUT app/api/campsites/[id]/route.ts, POST
 * app/api/campsites/route.ts — same precedent as
 * __tests__/cam-360-logo-clear-persists.test.ts /
 * __tests__/cam-352-image-kind-groundwork.test.ts) + source-inspection for
 * components/CampgroundForm.tsx's client-side UX gate (no jsdom in this repo
 * — same precedent as __tests__/cam-341-fee-policy-form.test.ts /
 * __tests__/cam-305-listing-completeness-card.test.ts).
 *
 * AC/BR/EC -> test matrix
 * ───────────────────────────────────────────────────────────────────────────
 * BR-1        PUBLISH_MIN_COMPLETENESS === 80, single-source constant.
 * BR-5        publishGateBlockedMessage(N) verbatim copy for arbitrary N.
 * AC-4/EC-1   PUT: below-floor direct publish attempt -> 400 + copy + missing[].
 * AC-2/EC-2   PUT: score exactly 80 (inclusive boundary) -> 200.
 * EC-3        PUT: score above 80 (85) -> 200.
 * AC-3        PUT: THE key test — post-save projection. Existing camp is
 *             missing ONLY photos (stored score 75); the same PUT request
 *             both replaces the image gallery AND sets isPublished:true ->
 *             the projection counts THIS request's images (not the stale
 *             live count) -> score 100 -> 200.
 * AC-6        PUT: true->false (unpublish) is never gated, any score.
 * AC-5        PUT: already-published camp, unrelated edit, score dips below
 *             80 -> stays published, gate not evaluated (no wasted queries).
 * EC-5        PUT: ADMIN session gated identically — no role bypass.
 * (EC, no #)  PUT: omitted isPublished -> gate never evaluated (no wasted
 *             queries — the gate-only findUnique/spot.count are NOT called).
 * EC-7        PUT: unpublish then a SEPARATE re-publish attempt while still
 *             below 80 is gated again (a fresh transition every time).
 * EC-4/BR-6   POST: create with isPublished:true below the floor -> 400,
 *             nothing created.
 * (coverage)  POST: create with isPublished:true at/above the floor -> 201.
 * (coverage)  POST: omitted isPublished never evaluates the gate (create
 *             always succeeds regardless of score).
 * BR-8        Form: disabled state + helper text + missing list + anchor
 *             jump wiring, source-inspected; threshold imported (no
 *             hardcoded literal 80 for the publish gate).
 * ───────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';
import translations from '../locales/translations.json';
import {
  PUBLISH_MIN_COMPLETENESS,
  publishGateBlockedMessage,
} from '@/lib/listing-completeness';

const root = path.resolve(__dirname, '..');
const src = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

// ===========================================================================
// 1. lib/listing-completeness.ts additions (unit)
// ===========================================================================

describe('CAM-365 BR-1 — PUBLISH_MIN_COMPLETENESS single-source constant', () => {
  it('[normal] the floor is exactly 80', () => {
    expect(PUBLISH_MIN_COMPLETENESS).toBe(80);
  });
});

describe('CAM-365 BR-5 — publishGateBlockedMessage verbatim copy', () => {
  it('[normal] interpolates the score exactly per the spec template (N=60, the spec\'s own AC-1/AC-4 example)', () => {
    expect(publishGateBlockedMessage(60)).toBe(
      'ยังเผยแพร่ไม่ได้ ต้องกรอกข้อมูลให้ครบอย่างน้อย 80% ก่อน ตอนนี้ 60%'
    );
  });

  it('[boundary] works for the spec\'s literal EC-1 example (N=79), independent of weight-table achievability', () => {
    expect(publishGateBlockedMessage(79)).toBe(
      'ยังเผยแพร่ไม่ได้ ต้องกรอกข้อมูลให้ครบอย่างน้อย 80% ก่อน ตอนนี้ 79%'
    );
  });

  it('[boundary] N=0 renders cleanly (no NaN/undefined)', () => {
    expect(publishGateBlockedMessage(0)).toBe(
      'ยังเผยแพร่ไม่ได้ ต้องกรอกข้อมูลให้ครบอย่างน้อย 80% ก่อน ตอนนี้ 0%'
    );
  });
});

// ===========================================================================
// 2. Route integration — PUT /api/campsites/[id] (mocked Prisma)
// ===========================================================================

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      update: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    spot: {
      count: vi.fn(),
    },
    masterData: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    location: {
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  requireCampSitePermission: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireCampSitePermission, requireAuth } from '@/lib/auth-utils';
import { PUT as campSitePUT } from '@/app/api/campsites/[id]/route';
import { POST as campSitePOST } from '@/app/api/campsites/route';
import { _store } from '@/lib/rate-limit';

const CAMP_ID = '550e8400-e29b-41d4-a716-446655440365';
const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

type ExistingOverrides = Partial<{
  priceLow: number | null;
  isFree: boolean;
  extraFeeAmount: number | null;
  extraFeeLabel: string | null;
  cancellationPolicy: string | null;
  useSpotView: boolean;
  maxGuestsPerDay: number | null;
  isPublished: boolean;
}>;

function mockAllowed(overrides: ExistingOverrides, role: string = 'OPERATOR') {
  (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: null,
    campSite: {
      id: CAMP_ID,
      operatorId: 'op-1',
      priceLow: null,
      isFree: false,
      extraFeeAmount: null,
      extraFeeLabel: null,
      cancellationPolicy: null,
      useSpotView: false,
      maxGuestsPerDay: null,
      isPublished: false,
      ...overrides,
    } as never,
    session: { user: { id: 'op-1', role } } as never,
  });
}

// Live relation-count + spot-count mocks read by the gate (only invoked when
// this request is an actual false->true transition — see the "no wasted
// queries" test below).
function mockLiveCounts(imageCount: number, optionsCount: number, spotCount: number) {
  (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    _count: { images: imageCount, options: optionsCount },
  });
  (prisma.spot.count as ReturnType<typeof vi.fn>).mockResolvedValue(spotCount);
}

function putRequest(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/campsites/${CAMP_ID}`, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  _store.clear();
  (prisma.campSite.update as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: CAMP_ID,
    nameThSlug: 'test-camp-th',
    nameEnSlug: 'test-camp-en',
  });
});

describe('PUT /api/campsites/[id] — publish gate (AC-4/EC-1): below-floor direct publish is rejected', () => {
  it('[error/validation] score=60 (missing price+cancellationPolicy, the spec\'s own example) + isPublished:true -> 400, verbatim copy, missing[] details, no write', async () => {
    mockAllowed({
      priceLow: null,
      isFree: false,
      cancellationPolicy: null,
      extraFeeAmount: null,
      extraFeeLabel: null,
      useSpotView: false,
      maxGuestsPerDay: 5,
      isPublished: false,
    });
    mockLiveCounts(1, 2, 1); // photos + amenities + zones all satisfied

    const res = await campSitePUT(putRequest({ isPublished: true }), makeParams(CAMP_ID));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe(
      'ยังเผยแพร่ไม่ได้ ต้องกรอกข้อมูลให้ครบอย่างน้อย 80% ก่อน ตอนนี้ 60%'
    );
    expect(body.details.missing).toHaveLength(2);
    expect(body.details.missing.map((m: { key: string }) => m.key).sort()).toEqual([
      'cancellationPolicy',
      'price',
    ]);
    expect(prisma.campSite.update).not.toHaveBeenCalled();
  });
});

describe('PUT /api/campsites/[id] — publish gate boundary (AC-2/EC-2, EC-3): inclusive >= 80', () => {
  it('[boundary] score exactly 80 (missing cancellationPolicy only) -> 200, published', async () => {
    mockAllowed({
      priceLow: 1000,
      isFree: false,
      cancellationPolicy: null,
      extraFeeAmount: null,
      extraFeeLabel: null,
      useSpotView: false,
      maxGuestsPerDay: 5,
      isPublished: false,
    });
    mockLiveCounts(1, 2, 1);

    const res = await campSitePUT(putRequest({ isPublished: true }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.isPublished).toBe(true);
  });

  it('[normal] score 85 (missing extraFee only, above the floor) -> 200, published', async () => {
    mockAllowed({
      priceLow: 1000,
      isFree: false,
      cancellationPolicy: 'FLEXIBLE',
      extraFeeAmount: 100, // partial (label missing) -> extraFee criterion unsatisfied
      extraFeeLabel: null,
      useSpotView: false,
      maxGuestsPerDay: 5,
      isPublished: false,
    });
    mockLiveCounts(1, 2, 1);

    const res = await campSitePUT(putRequest({ isPublished: true }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.isPublished).toBe(true);
  });
});

describe('PUT /api/campsites/[id] — AC-3 (THE key test): post-save projection accepts a same-save complete+publish', () => {
  it('[normal] stored score 75 (missing photos only) + this PUT replaces images AND sets isPublished:true -> projected score 100 -> 200', async () => {
    mockAllowed({
      priceLow: 1000,
      isFree: false,
      cancellationPolicy: 'FLEXIBLE',
      extraFeeAmount: null,
      extraFeeLabel: null,
      useSpotView: false,
      maxGuestsPerDay: 5,
      isPublished: false,
    });
    // Live pre-write count is 0 photos (stored score would be 75) — the
    // projection must NOT use this stale count once 'images' is in the body.
    mockLiveCounts(0, 2, 1);

    const res = await campSitePUT(
      putRequest({
        images: [{ url: 'https://cdn.example.com/new-photo.jpg' }],
        isPublished: true,
      }),
      makeParams(CAMP_ID)
    );

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.isPublished).toBe(true);
    expect(call.data.images).toEqual({
      deleteMany: {},
      create: [{ url: 'https://cdn.example.com/new-photo.jpg', sortOrder: 0, kind: 'PHOTO' }],
    });
    // Proves the gate actually ran (transition detected) and read live counts.
    expect(prisma.campSite.findUnique).toHaveBeenCalledWith({
      where: { id: CAMP_ID },
      select: { _count: { select: { images: true, options: true } } },
    });
    expect(prisma.spot.count).toHaveBeenCalled();
  });

  it('[error/validation] the SAME stored-75 camp WITHOUT replacing images -> stale live count (0) still applies -> 400', async () => {
    mockAllowed({
      priceLow: 1000,
      isFree: false,
      cancellationPolicy: 'FLEXIBLE',
      extraFeeAmount: null,
      extraFeeLabel: null,
      useSpotView: false,
      maxGuestsPerDay: 5,
      isPublished: false,
    });
    mockLiveCounts(0, 2, 1);

    const res = await campSitePUT(putRequest({ isPublished: true }), makeParams(CAMP_ID));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('ตอนนี้ 75%');
    expect(prisma.campSite.update).not.toHaveBeenCalled();
  });
});

describe('PUT /api/campsites/[id] — G3 I-1 fix: the options projection mirrors the images special-case (both directions)', () => {
  it('[normal] same-save FIRST amenity + publish: stale pre-write live count is 0 (would 400 pre-fix) but the request\'s own resolved set makes it 200', async () => {
    mockAllowed({
      priceLow: 1000,
      isFree: false,
      cancellationPolicy: 'FLEXIBLE',
      extraFeeAmount: 100, // partial (label missing) -> extraFee stays unsatisfied throughout
      extraFeeLabel: null,
      useSpotView: false,
      maxGuestsPerDay: 5,
      isPublished: false,
    });
    // Live pre-write options count is 0 (amenities unsatisfied) -> stored/live
    // score would be 75 (missing extraFee 15 + amenities 10). The SAME save
    // adds the first facility - resolveOptionConnect must validate it against
    // masterData, so mock that lookup for THIS test only.
    mockLiveCounts(1, 0, 1);
    // .Once — never leaks into a later test (this repo's beforeEach only
    // clears call history via vi.clearAllMocks(), it does not reset a mocked
    // resolved value; see .claude/rules/qa.md "keep tests order-independent").
    (prisma.masterData.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ code: 'WIFI' }]);

    const res = await campSitePUT(
      putRequest({ facilities: ['WIFI'], isPublished: true }),
      makeParams(CAMP_ID)
    );

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.isPublished).toBe(true);
    // The write's options.set reuses the SAME resolved array the gate scored
    // against - proven by asserting the exact connect payload here.
    expect(call.data.options).toEqual({ set: [{ code: 'WIFI' }] });
  });

  it('[error/validation] same-save CLEAR amenities + publish, where amenities was the margin: stale live count is satisfied (would wrongly 200 pre-fix) but the cleared request makes it 400', async () => {
    mockAllowed({
      priceLow: 1000,
      isFree: false,
      // cancellationPolicy missing -> with amenities counted (live=2) this
      // camp would sit exactly at the 80 floor (100 - 20 cancellationPolicy).
      cancellationPolicy: null,
      extraFeeAmount: null,
      extraFeeLabel: null,
      useSpotView: false,
      maxGuestsPerDay: 5,
      isPublished: false,
    });
    // Live pre-write options count is 2 (amenities SATISFIED) — this is the
    // stale count the pre-fix code would have used. `facilities: []` is an
    // explicit empty array in the RAW body -> replacesOptions is true and
    // resolveOptionConnect short-circuits to [] with no masterData call.
    mockLiveCounts(1, 2, 1);

    const res = await campSitePUT(
      putRequest({ facilities: [], isPublished: true }),
      makeParams(CAMP_ID)
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    // 100 - cancellationPolicy(20) - amenities(10, now cleared) = 70. The
    // pre-fix bug would have used the stale live count (2, satisfied) and
    // computed 80 (>=80) -> wrongly allowed. This locks the fixed math.
    expect(body.error).toContain('ตอนนี้ 70%');
    expect(prisma.campSite.update).not.toHaveBeenCalled();
    expect(prisma.masterData.findMany).not.toHaveBeenCalled();
  });
});

describe('PUT /api/campsites/[id] — EC-2 (CAM-515): a partial PUT that omits annotatedFeatures never wipes the Annotated features relation', () => {
  it('[edge] a price-only PUT (no taxonomy key in the raw body at all) never touches the options relation — same replacesOptions guard the facilities test above proves, keyed to the NEW group', async () => {
    mockAllowed({});

    const res = await campSitePUT(putRequest({ priceLow: 999 }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // The update payload carries NO `options` key at all (never `{ set: [] }`,
    // which WOULD wipe the relation) — proves replacesOptions correctly
    // stayed false for a body that never mentioned annotatedFeatures.
    expect(call.data).not.toHaveProperty('options');
    expect(prisma.masterData.findMany).not.toHaveBeenCalled();
  });

  it('[normal] a PUT carrying ONLY annotatedFeatures resolves+replaces the options relation via resolveOptionConnect (mirrors the facilities:["WIFI"] case above)', async () => {
    mockAllowed({});
    (prisma.masterData.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ code: 'ALCO' }]);

    const res = await campSitePUT(putRequest({ annotatedFeatures: ['ALCO'] }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.options).toEqual({ set: [{ code: 'ALCO' }] });
  });

  it('[edge] an explicit empty annotatedFeatures:[] in the raw body IS a taxonomy key present -> clears the relation (replacesOptions true, resolveOptionConnect short-circuits to [], no masterData call)', async () => {
    mockAllowed({});

    const res = await campSitePUT(putRequest({ annotatedFeatures: [] }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.options).toEqual({ set: [] });
    expect(prisma.masterData.findMany).not.toHaveBeenCalled();
  });
});

describe('PUT /api/campsites/[id] — EC-2 (CAM-516): a partial PUT that omits camperStyle never wipes the Camper style relation', () => {
  it('[edge] a price-only PUT (no taxonomy key in the raw body at all) never touches the options relation — same replacesOptions guard, keyed to the SECOND new group', async () => {
    mockAllowed({});

    const res = await campSitePUT(putRequest({ priceLow: 999 }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data).not.toHaveProperty('options');
    expect(prisma.masterData.findMany).not.toHaveBeenCalled();
  });

  it('[normal] a PUT carrying ONLY camperStyle resolves+replaces the options relation via resolveOptionConnect (mirrors the annotatedFeatures:["ALCO"] case above)', async () => {
    mockAllowed({});
    (prisma.masterData.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ code: 'CHIC' }]);

    const res = await campSitePUT(putRequest({ camperStyle: ['CHIC'] }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.options).toEqual({ set: [{ code: 'CHIC' }] });
  });

  it('[edge] an explicit empty camperStyle:[] in the raw body IS a taxonomy key present -> clears the relation (replacesOptions true, resolveOptionConnect short-circuits to [], no masterData call)', async () => {
    mockAllowed({});

    const res = await campSitePUT(putRequest({ camperStyle: [] }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.options).toEqual({ set: [] });
    expect(prisma.masterData.findMany).not.toHaveBeenCalled();
  });
});

describe('PUT /api/campsites/[id] — EC-2 (CAM-521): a partial PUT that omits stayConnected/markingMethod/driveway never wipes their relation', () => {
  it('[edge] a price-only PUT (no taxonomy key in the raw body at all) never touches the options relation — same replacesOptions guard, keyed to the final taxonomy slice', async () => {
    mockAllowed({});

    const res = await campSitePUT(putRequest({ priceLow: 999 }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data).not.toHaveProperty('options');
    expect(prisma.masterData.findMany).not.toHaveBeenCalled();
  });

  it('[normal] a PUT carrying ONLY stayConnected resolves+replaces the options relation via resolveOptionConnect (mirrors the camperStyle:["CHIC"] case above)', async () => {
    mockAllowed({});
    (prisma.masterData.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ code: 'SAIS' }]);

    const res = await campSitePUT(putRequest({ stayConnected: ['SAIS'] }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.options).toEqual({ set: [{ code: 'SAIS' }] });
  });

  it('[edge] an explicit empty markingMethod:[] in the raw body IS a taxonomy key present -> clears the relation (replacesOptions true, resolveOptionConnect short-circuits to [], no masterData call)', async () => {
    mockAllowed({});

    const res = await campSitePUT(putRequest({ markingMethod: [] }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.options).toEqual({ set: [] });
    expect(prisma.masterData.findMany).not.toHaveBeenCalled();
  });

  it('[edge] an explicit empty driveway:[] in the raw body IS a taxonomy key present -> clears the relation', async () => {
    mockAllowed({});

    const res = await campSitePUT(putRequest({ driveway: [] }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.options).toEqual({ set: [] });
    expect(prisma.masterData.findMany).not.toHaveBeenCalled();
  });
});

describe('PUT /api/campsites/[id] — G3 test gap: clearing a load-bearing field in the SAME publish request is honored (null-overlay)', () => {
  it('[error/validation] an at-80 camp, this request clears cancellationPolicy (null) AND publishes -> 400 (the clear is NOT ignored)', async () => {
    // Stored (if cancellationPolicy stayed as-is): missing zones(10, PER-SPOT
    // with 0 live spots) + amenities(10, live options=0) = 80 exactly. This
    // request clears cancellationPolicy in the SAME save.
    mockAllowed({
      priceLow: 1000,
      isFree: false,
      cancellationPolicy: 'FLEXIBLE',
      extraFeeAmount: null,
      extraFeeLabel: null,
      useSpotView: true, // PER-SPOT — the whole-camp fallback does not apply
      maxGuestsPerDay: null,
      isPublished: false,
    });
    mockLiveCounts(1, 0, 0); // photos ok; options=0 (amenities missing); spots=0 (zones missing)

    const res = await campSitePUT(
      putRequest({ cancellationPolicy: null, isPublished: true }),
      makeParams(CAMP_ID)
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    // 80 (zones+amenities already missing) - cancellationPolicy(20, cleared) = 60.
    expect(body.error).toContain('ตอนนี้ 60%');
    expect(prisma.campSite.update).not.toHaveBeenCalled();
  });

  it('[error/validation] the same at-80 camp, this request clears extraFeeLabel (\'\') instead AND publishes -> 400 (partial-fee overlay honored)', async () => {
    mockAllowed({
      priceLow: 1000,
      isFree: false,
      cancellationPolicy: 'FLEXIBLE',
      extraFeeAmount: 100,
      extraFeeLabel: 'ค่าเข้าอุทยาน', // fully specified — extraFee currently satisfied
      useSpotView: true,
      maxGuestsPerDay: null,
      isPublished: false,
    });
    mockLiveCounts(1, 0, 0); // amenities + zones already missing -> stored 80 (extraFee still satisfied)

    const res = await campSitePUT(
      putRequest({ extraFeeLabel: '', isPublished: true }),
      makeParams(CAMP_ID)
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    // 80 - extraFee(15, now partial/unsatisfied since amount stays set) = 65.
    expect(body.error).toContain('ตอนนี้ 65%');
    expect(prisma.campSite.update).not.toHaveBeenCalled();
  });
});

describe('PUT /api/campsites/[id] — G3 test gap: explicit isPublished:true on an already-published camp skips the gate', () => {
  it('[normal] isPublished:true sent explicitly (unchanged from stored true) -> no gate queries fired, 200', async () => {
    mockAllowed({
      priceLow: null, // very incomplete — would fail the gate if it ran
      isFree: false,
      cancellationPolicy: null,
      isPublished: true,
    });

    const res = await campSitePUT(putRequest({ isPublished: true }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    expect(prisma.campSite.findUnique).not.toHaveBeenCalled();
    expect(prisma.spot.count).not.toHaveBeenCalled();
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.isPublished).toBe(true);
  });
});

describe('PUT /api/campsites/[id] — AC-6: unpublish (true->false) is never gated', () => {
  it('[normal] already-published, very-incomplete score (60) -> unpublish still succeeds, gate not evaluated', async () => {
    mockAllowed({
      priceLow: null,
      isFree: false,
      cancellationPolicy: null,
      isPublished: true,
    });

    const res = await campSitePUT(putRequest({ isPublished: false }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    expect(prisma.campSite.findUnique).not.toHaveBeenCalled();
    expect(prisma.spot.count).not.toHaveBeenCalled();
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.isPublished).toBe(false);
  });
});

describe('PUT /api/campsites/[id] — AC-5: an already-published camp is never re-gated on an unrelated edit', () => {
  it('[normal] published camp, score dips to 60 on an unrelated priceLow edit, isPublished omitted -> stays published, no gate queries', async () => {
    mockAllowed({
      priceLow: null,
      isFree: false,
      cancellationPolicy: null,
      isPublished: true,
    });

    const res = await campSitePUT(putRequest({ priceLow: 999 }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    expect(prisma.campSite.findUnique).not.toHaveBeenCalled();
    expect(prisma.spot.count).not.toHaveBeenCalled();
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.priceLow).toBe(999);
    expect('isPublished' in call.data).toBe(false);
  });
});

describe('PUT /api/campsites/[id] — EC-5: no ADMIN bypass', () => {
  it('[error/validation] ADMIN session, below-floor publish attempt -> 400, identical to a host', async () => {
    mockAllowed(
      {
        priceLow: null,
        isFree: false,
        cancellationPolicy: null,
        isPublished: false,
      },
      'ADMIN'
    );
    mockLiveCounts(1, 2, 1);

    const res = await campSitePUT(putRequest({ isPublished: true }), makeParams(CAMP_ID));

    expect(res.status).toBe(400);
    expect(prisma.campSite.update).not.toHaveBeenCalled();
  });
});

describe('PUT /api/campsites/[id] — omitted isPublished: the gate never evaluates (no wasted queries)', () => {
  it('[null/empty] a plain price-only edit on an unpublished, very-incomplete camp never touches the gate-only queries', async () => {
    mockAllowed({
      priceLow: null,
      isFree: false,
      cancellationPolicy: null,
      isPublished: false,
    });

    const res = await campSitePUT(putRequest({ priceLow: 700 }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    expect(prisma.campSite.findUnique).not.toHaveBeenCalled();
    expect(prisma.spot.count).not.toHaveBeenCalled();
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.priceLow).toBe(700);
  });
});

describe('PUT /api/campsites/[id] — EC-7: re-publishing after an unpublish is a fresh transition, gated again', () => {
  it('[concurrent/ordering] unpublish succeeds, then a later re-publish attempt while still below 80 is blocked', async () => {
    // Call 1: unpublish a currently-published camp (never gated).
    mockAllowed({
      priceLow: 1000,
      cancellationPolicy: 'FLEXIBLE',
      isPublished: true,
    });
    const res1 = await campSitePUT(putRequest({ isPublished: false }), makeParams(CAMP_ID));
    expect(res1.status).toBe(200);

    // Call 2: the persisted state is now isPublished=false (simulated) and
    // still below 80 — a fresh false->true transition is gated again.
    vi.clearAllMocks();
    (prisma.campSite.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CAMP_ID,
      nameThSlug: 'test-camp-th',
      nameEnSlug: 'test-camp-en',
    });
    mockAllowed({
      priceLow: null,
      isFree: false,
      cancellationPolicy: null,
      isPublished: false,
    });
    mockLiveCounts(1, 2, 1);

    const res2 = await campSitePUT(putRequest({ isPublished: true }), makeParams(CAMP_ID));
    expect(res2.status).toBe(400);
    expect(prisma.campSite.update).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 3. Route integration — POST /api/campsites (mocked Prisma)
// ===========================================================================

const LOCATION_ID = '550e8400-e29b-41d4-a716-446655440001';

function baseCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    nameTh: 'ทดสอบแคมป์',
    latitude: 13.75,
    longitude: 100.5,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    bookingMethod: 'ONLI',
    locationId: LOCATION_ID,
    // CAM-520: campSiteType is now required on create — unrelated to this
    // file's publish-gate concern, so a valid code is included by default.
    campSiteType: 'CAGD',
    ...overrides,
  };
}

function postRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/campsites', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function mockAuthAllowed(userId = 'op-create-1') {
  (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: null,
    session: { user: { id: userId, role: 'OPERATOR' } } as never,
  });
}

describe('POST /api/campsites — EC-4/BR-6: create-with-publish is gated identically', () => {
  it('[error/validation] isPublished:true with no photos/price/policy (very low score) -> 400, nothing created', async () => {
    mockAuthAllowed();

    const res = await campSitePOST(postRequest(baseCreateBody({ isPublished: true })));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('ยังเผยแพร่ไม่ได้');
    expect(prisma.campSite.create).not.toHaveBeenCalled();
  });

  it('[normal] isPublished:true at/above the floor (score 90 — only amenities missing) -> 201, created as published', async () => {
    mockAuthAllowed();
    (prisma.campSite.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'new-camp-1',
      isPublished: true,
    });

    const res = await campSitePOST(
      postRequest(
        baseCreateBody({
          images: [{ url: 'https://cdn.example.com/a.jpg' }],
          priceLow: 1000,
          cancellationPolicy: 'FLEXIBLE',
          useSpotView: false,
          maxGuestsPerDay: 5,
          isPublished: true,
        })
      )
    );

    expect(res.status).toBe(201);
    const call = (prisma.campSite.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.isPublished).toBe(true);
  });

  it('[null/empty] omitted isPublished never evaluates the gate — create always succeeds regardless of score', async () => {
    mockAuthAllowed();
    (prisma.campSite.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'new-camp-2',
      isPublished: false,
    });

    // Deliberately a very-low-score body (no photos/price/policy) — proves
    // the gate is skipped entirely, not just "passed".
    const res = await campSitePOST(postRequest(baseCreateBody()));

    expect(res.status).toBe(201);
    const call = (prisma.campSite.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.isPublished).toBe(false);
  });
});

// ===========================================================================
// 4. components/CampgroundForm.tsx — client UX gate (source-inspection; no
//    jsdom in this repo, same precedent as cam-341/cam-305 above).
// ===========================================================================

const formSrc = src('components/CampgroundForm.tsx');
const en = (translations as { en: Record<string, unknown> }).en as {
  newCampground: Record<string, string>;
};
const th = (translations as { th: Record<string, unknown> }).th as {
  newCampground: Record<string, string>;
};

describe('CAM-365 BR-1/BR-8 — CampgroundForm imports the single-source threshold (no hardcoded 80)', () => {
  it('[normal] imports PUBLISH_MIN_COMPLETENESS from lib/listing-completeness', () => {
    expect(formSrc).toContain(
      "import { computeListingCompleteness, PUBLISH_MIN_COMPLETENESS } from \"@/lib/listing-completeness\";"
    );
  });

  it('[normal] imports the shared ANCHOR_BY_KEY map (reuse, not a parallel copy)', () => {
    expect(formSrc).toContain('import { ANCHOR_BY_KEY } from "@/components/ListingCompletenessCard";');
  });

  it('[error/validation] no hardcoded numeric-literal threshold for the publish gate (only via the imported constant)', () => {
    expect(formSrc).not.toMatch(/currentCompleteness\.score\s*<\s*80\b/);
    expect(formSrc).toContain('currentCompleteness.score < PUBLISH_MIN_COMPLETENESS');
  });
});

describe('CAM-365 BR-8 — CampgroundForm publish-toggle disabled state + helper + missing list', () => {
  it('[normal] publishLocked = stored-unpublished AND live score below the floor (mirrors BR-3 transition detection)', () => {
    expect(formSrc).toContain('const storedIsPublished: boolean = initialData?.isPublished ?? false;');
    expect(formSrc).toContain(
      'const publishLocked = !storedIsPublished && currentCompleteness.score < PUBLISH_MIN_COMPLETENESS;'
    );
  });

  it('[normal] the publish switch button binds disabled/aria-disabled to publishLocked', () => {
    expect(formSrc).toContain('disabled={publishLocked}');
    expect(formSrc).toContain('aria-disabled={publishLocked}');
    expect(formSrc).toContain('data-testid="btn--campground-publish-toggle"');
  });

  it('[normal] clicking the switch while locked is a no-op (guarded in the click handler, not just the disabled attribute)', () => {
    expect(formSrc).toMatch(/onClick=\{\(\) => \{\s*if \(publishLocked\) return;/);
  });

  it('[normal] the helper text renders the verbatim locale copy with the live score substituted for {N}', () => {
    expect(formSrc).toContain(
      't.newCampground.publishGateHelper.replace(\n                                                    "{N}",\n                                                    String(currentCompleteness.score)\n                                                )'
    );
  });

  it('[normal] the missing list renders one row per item, verbatim label + a CAM-305 anchor jump (never a re-derived label)', () => {
    expect(formSrc).toContain('currentCompleteness.missing.map((item) =>');
    expect(formSrc).toContain('<span>{item.label}</span>');
    expect(formSrc).toContain('jumpToPublishGateSection(ANCHOR_BY_KEY[item.key])');
  });

  it('[normal] the missing-list block is rendered only while publishLocked (never for an already-published camp)', () => {
    expect(formSrc).toMatch(/\{publishLocked && \(/);
  });
});

describe('CAM-365 — locale copy (TH verbatim + EN present)', () => {
  it('[normal] TH copy matches the spec verbatim exactly, including the {N} placeholder', () => {
    expect(th.newCampground.publishGateHelper).toBe(
      'ต้องกรอกข้อมูลให้ครบอย่างน้อย 80% ก่อนเผยแพร่ ตอนนี้ {N}%'
    );
  });

  it('[normal] EN copy exists (client-rendered copy must never be hardcoded outside the locale layer)', () => {
    expect(typeof en.newCampground.publishGateHelper).toBe('string');
    expect(en.newCampground.publishGateHelper.length).toBeGreaterThan(0);
    expect(en.newCampground.publishGateHelper).toContain('{N}');
  });
});

describe('CAM-365 BR-8 — ANCHOR_BY_KEY reuse (components/ListingCompletenessCard.tsx)', () => {
  it('[normal] the anchor map is exported (not a private const) so CampgroundForm can import it directly', () => {
    const cardSrc = src('components/ListingCompletenessCard.tsx');
    expect(cardSrc).toContain('export const ANCHOR_BY_KEY: Record<ListingCompletenessKey, string> = {');
  });
});
