/**
 * cam-304-listing-completeness.test.ts — CAM-304 deterministic, rule-based
 * listing completeness score (lib) + owner/ADMIN/team-member-only GET
 * endpoint (route).
 *
 * AC -> test matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * AC-1  partial camp (no photos, no policy) -> missing has the exact Thai
 *       labels, score < 100 (unit: lib) + 200 response reflects it (integration).
 * AC-2  after a field becomes satisfied, score increases by exactly that
 *       criteria's weight — every call recomputes fresh, no stale/memoized state.
 * AC-3  fully-complete camp -> score = 100, missing = [] (unit + integration);
 *       isFree=true with priceLow null still satisfies price.
 * AC-4  several missing at once -> itemized distinct {key,label} entries,
 *       emitted in fixed weight-table order (stable key for CAM-305 deep-link).
 * BR-1  determinism (same input twice -> identical output) + never
 *       cached (Cache-Control: no-store) + read-only (no Prisma write call).
 * BR-3  weight table sums to exactly 100; MIN_PHOTOS_FOR_COMPLETE = 1.
 * BR-4  authz mirrors the holds route via requireCampSitePermission
 *       (CAMPSITE_UPDATE) — 403 non-authorized, 404 unknown/soft-deleted.
 * BR-5  extra-fee transparency: satisfied when both amount+label present OR
 *       both empty; unsatisfied only on a partial fill (EC-3/EC-5).
 * BR-6  missing-item shape {key,label}; verbatim Thai labels.
 * EC-1  non-owner/ADMIN/team-member caller -> 403, no listing data disclosed.
 * EC-2  empty camp -> floor score, never negative/NaN; all applicable fields missing.
 * EC-3  amount set / label empty (or vice versa) -> extraFee unsatisfied.
 * EC-4  unknown or soft-deleted camp id -> 404, no score computed.
 * EC-5  both fee fields empty -> extraFee satisfied, absent from missing.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findUnique: vi.fn(),
    },
    spot: {
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  requireCampSitePermission: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireCampSitePermission } from '@/lib/auth-utils';
import { GET as completenessGET } from '@/app/api/campsites/[id]/completeness/route';

import {
  computeListingCompleteness,
  LISTING_COMPLETENESS_WEIGHTS,
  MIN_PHOTOS_FOR_COMPLETE,
  type ListingCompletenessInput,
} from '@/lib/listing-completeness';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const CAMPSITE_ID = '550e8400-e29b-41d4-a716-446655440020';

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });
const getReq = () => new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/completeness`);

const unauthorizedResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const forbiddenResponse = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
const notFoundResponse = NextResponse.json({ error: 'Camp site not found' }, { status: 404 });

function baseCampSite(overrides: Record<string, unknown> = {}) {
  return {
    id: CAMPSITE_ID,
    deletedAt: null,
    priceLow: null,
    isFree: false,
    extraFeeAmount: null,
    extraFeeLabel: null,
    cancellationPolicy: null,
    ...overrides,
  };
}

function mockAllowed(campSite: ReturnType<typeof baseCampSite> = baseCampSite()) {
  (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: null,
    campSite: campSite as never,
    session: { user: { id: 'host-1' } } as never,
  });
}
function mockUnauthorized() {
  (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: unauthorizedResponse,
    campSite: null,
    session: null,
  });
}
function mockForbidden() {
  (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: forbiddenResponse,
    campSite: null,
    session: null,
  });
}
function mockUnknown() {
  (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: notFoundResponse,
    campSite: null,
    session: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

const emptyInput: ListingCompletenessInput = {
  imageCount: 0,
  priceLow: null,
  isFree: false,
  extraFeeAmount: null,
  extraFeeLabel: null,
  cancellationPolicy: null,
  spotCount: 0,
  optionsCount: 0,
};

const fullInput: ListingCompletenessInput = {
  imageCount: 3,
  priceLow: 500,
  isFree: false,
  extraFeeAmount: 50,
  extraFeeLabel: 'ค่าเข้าอุทยาน',
  cancellationPolicy: 'MODERATE',
  spotCount: 2,
  optionsCount: 4,
};

// ===========================================================================
// Group A: lib/listing-completeness.ts — weight table constant (BR-3)
// ===========================================================================

describe('LISTING_COMPLETENESS_WEIGHTS — BR-3 constant guard', () => {
  it('[boundary] sums to exactly 100', () => {
    const sum = LISTING_COMPLETENESS_WEIGHTS.reduce((acc, c) => acc + c.weight, 0);
    expect(sum).toBe(100);
  });

  it('[order] fixed weight-table order matches BR-6 emission order', () => {
    expect(LISTING_COMPLETENESS_WEIGHTS.map((c) => c.key)).toEqual([
      'photos',
      'price',
      'cancellationPolicy',
      'extraFee',
      'zones',
      'amenities',
    ]);
  });

  it('MIN_PHOTOS_FOR_COMPLETE is 1 (BR-3)', () => {
    expect(MIN_PHOTOS_FOR_COMPLETE).toBe(1);
  });
});

// ===========================================================================
// Group B: computeListingCompleteness — AC-1..4
// ===========================================================================

describe('computeListingCompleteness — AC-1: partial camp (no photos, no policy)', () => {
  it('[ac1] missing includes the exact Thai labels, score below 100', () => {
    const result = computeListingCompleteness({ ...fullInput, imageCount: 0, cancellationPolicy: null });

    expect(result.missing.map((m) => m.label)).toContain('ยังไม่มีรูปภาพ');
    expect(result.missing.map((m) => m.label)).toContain('ยังไม่ระบุนโยบายยกเลิก');
    expect(result.score).toBeLessThan(100);
  });
});

describe('computeListingCompleteness — AC-2: recompute after a field becomes satisfied', () => {
  it('[ac2] score increases by exactly the newly-satisfied criteria weights', () => {
    const before = computeListingCompleteness({ ...fullInput, imageCount: 0, cancellationPolicy: null });
    const after = computeListingCompleteness(fullInput);

    // photos (25) + cancellationPolicy (20) newly satisfied = +45.
    expect(after.score - before.score).toBe(45);
  });

  it('[ac2] recomputes fresh from input every call — no memoized/stale state carries over', () => {
    const first = computeListingCompleteness(emptyInput);
    const second = computeListingCompleteness(fullInput);
    const third = computeListingCompleteness(emptyInput);

    expect(first.score).toBe(third.score);
    expect(second.score).not.toBe(first.score);
  });
});

describe('computeListingCompleteness — AC-3: fully complete camp', () => {
  it('[ac3] score = 100 and missing is empty', () => {
    const result = computeListingCompleteness(fullInput);
    expect(result.score).toBe(100);
    expect(result.missing).toEqual([]);
  });

  it('[ac3] isFree=true with priceLow null still satisfies the price criterion', () => {
    const result = computeListingCompleteness({ ...fullInput, priceLow: null, isFree: true });
    expect(result.missing.some((m) => m.key === 'price')).toBe(false);
  });
});

describe('computeListingCompleteness — AC-4: several missing at once, itemized + ordered', () => {
  it('[ac4] each missing criterion is its own distinct {key,label} entry, never merged into one string', () => {
    const result = computeListingCompleteness(emptyInput);

    result.missing.forEach((item) => {
      expect(typeof item.key).toBe('string');
      expect(typeof item.label).toBe('string');
    });
    expect(new Set(result.missing.map((m) => m.key)).size).toBe(result.missing.length);
  });

  it('[ac4] missing items are emitted in fixed weight-table order (stable key for CAM-305 deep-link)', () => {
    const result = computeListingCompleteness(emptyInput);
    const orderedKeys = LISTING_COMPLETENESS_WEIGHTS.map((c) => c.key).filter((key) =>
      result.missing.some((m) => m.key === key)
    );
    expect(result.missing.map((m) => m.key)).toEqual(orderedKeys);
  });
});

// ===========================================================================
// Group C: EC-2 (floor), EC-3/EC-5 (extra-fee transparency, BR-5)
// ===========================================================================

describe('computeListingCompleteness — EC-2: empty camp floors non-negative, non-NaN', () => {
  it('[ec2] zero photos + no other completable data -> floor score (only extraFee inherently satisfied)', () => {
    const result = computeListingCompleteness(emptyInput);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(result.score)).toBe(false);
    expect(result.score).toBe(15); // only extraFee (both empty, BR-5) is satisfied
  });

  it('[ec2] every unsatisfied field appears in missing (5 of 6 criteria; extraFee absent)', () => {
    const result = computeListingCompleteness(emptyInput);
    expect(result.missing).toHaveLength(5);
    expect(result.missing.some((m) => m.key === 'extraFee')).toBe(false);
  });
});

describe('computeListingCompleteness — EC-3/BR-5: extra-fee partial fill is unsatisfied', () => {
  it('[ec3] amount set, label empty -> extraFee unsatisfied + exact Thai label present', () => {
    const result = computeListingCompleteness({ ...fullInput, extraFeeAmount: 50, extraFeeLabel: null });
    expect(result.missing).toEqual(
      expect.arrayContaining([{ key: 'extraFee', label: 'ค่าธรรมเนียมเพิ่มเติมยังระบุไม่ครบ' }])
    );
  });

  it('[ec3] label set, amount empty -> extraFee unsatisfied (symmetric)', () => {
    const result = computeListingCompleteness({
      ...fullInput,
      extraFeeAmount: null,
      extraFeeLabel: 'ค่าเข้าอุทยาน',
    });
    expect(result.missing.some((m) => m.key === 'extraFee')).toBe(true);
  });

  it('[boundary] empty-string label (not null) is treated as absent — still a partial fill', () => {
    const result = computeListingCompleteness({ ...fullInput, extraFeeAmount: 50, extraFeeLabel: '' });
    expect(result.missing.some((m) => m.key === 'extraFee')).toBe(true);
  });
});

describe('computeListingCompleteness — EC-5/BR-5: both fee fields empty is a valid, truthful state', () => {
  it('[ec5] extraFee satisfied and absent from missing when both are empty', () => {
    const result = computeListingCompleteness({ ...fullInput, extraFeeAmount: null, extraFeeLabel: null });
    expect(result.missing.some((m) => m.key === 'extraFee')).toBe(false);
  });
});

// ===========================================================================
// Group D: determinism (BR-1) + boundary thresholds
// ===========================================================================

describe('computeListingCompleteness — determinism (BR-1)', () => {
  it('[determinism] the same input run twice yields an identical result', () => {
    const first = computeListingCompleteness(fullInput);
    const second = computeListingCompleteness(fullInput);
    expect(second).toEqual(first);
  });
});

describe('computeListingCompleteness — boundary photos/zones/amenities thresholds', () => {
  it('[boundary] exactly MIN_PHOTOS_FOR_COMPLETE photos satisfies photos', () => {
    const result = computeListingCompleteness({ ...emptyInput, imageCount: MIN_PHOTOS_FOR_COMPLETE });
    expect(result.missing.some((m) => m.key === 'photos')).toBe(false);
  });

  it('[boundary] exactly 1 non-deleted spot satisfies zones', () => {
    const result = computeListingCompleteness({ ...emptyInput, spotCount: 1 });
    expect(result.missing.some((m) => m.key === 'zones')).toBe(false);
  });

  it('[boundary] exactly 1 option satisfies amenities', () => {
    const result = computeListingCompleteness({ ...emptyInput, optionsCount: 1 });
    expect(result.missing.some((m) => m.key === 'amenities')).toBe(false);
  });

  it('[null/empty] 0 spots/options/photos leaves all three in missing', () => {
    const result = computeListingCompleteness(emptyInput);
    expect(result.missing.map((m) => m.key)).toEqual(
      expect.arrayContaining(['photos', 'zones', 'amenities'])
    );
  });
});

// ===========================================================================
// Group E: GET /api/campsites/[id]/completeness — authz (BR-4, EC-1, EC-4)
// ===========================================================================

describe('GET /api/campsites/[id]/completeness — authz (BR-4, EC-1, EC-4)', () => {
  it('401 — unauthenticated caller is rejected before any DB access', async () => {
    mockUnauthorized();
    const res = await completenessGET(getReq(), makeParams(CAMPSITE_ID));

    expect(res.status).toBe(401);
    expect(prisma.campSite.findUnique).not.toHaveBeenCalled();
    expect(prisma.spot.count).not.toHaveBeenCalled();
  });

  it('403 — a caller who is not the owner/ADMIN/team member is rejected, no listing data disclosed (EC-1)', async () => {
    mockForbidden();
    const res = await completenessGET(getReq(), makeParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).not.toHaveProperty('score');
    expect(prisma.campSite.findUnique).not.toHaveBeenCalled();
  });

  it('404 — unknown camp id (EC-4)', async () => {
    mockUnknown();
    const res = await completenessGET(getReq(), makeParams(CAMPSITE_ID));

    expect(res.status).toBe(404);
    expect(prisma.campSite.findUnique).not.toHaveBeenCalled();
  });

  it('404 — a soft-deleted camp is treated as not-found, no score computed (BR-4/EC-4)', async () => {
    mockAllowed(baseCampSite({ deletedAt: new Date() }));
    const res = await completenessGET(getReq(), makeParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).not.toHaveProperty('score');
    expect(prisma.campSite.findUnique).not.toHaveBeenCalled();
    expect(prisma.spot.count).not.toHaveBeenCalled();
  });

  it('uses requireCampSitePermission with CAMPSITE_UPDATE', async () => {
    mockForbidden();
    await completenessGET(getReq(), makeParams(CAMPSITE_ID));
    expect(requireCampSitePermission).toHaveBeenCalledWith(CAMPSITE_ID, 'CAMPSITE_UPDATE');
  });
});

// ===========================================================================
// Group F: GET /api/campsites/[id]/completeness — 200 contract (AC-1..4, BR-1)
// ===========================================================================

describe('GET /api/campsites/[id]/completeness — 200 contract', () => {
  it('200 — returns { score, missing } computed from the current field state (AC-1)', async () => {
    mockAllowed(baseCampSite());
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      _count: { images: 0, options: 0 },
    });
    (prisma.spot.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const res = await completenessGET(getReq(), makeParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.missing.map((m: { label: string }) => m.label)).toContain('ยังไม่มีรูปภาพ');
    expect(body.missing.map((m: { label: string }) => m.label)).toContain('ยังไม่ระบุนโยบายยกเลิก');
    expect(body.score).toBeLessThan(100);
  });

  it('200 — a fully-complete camp returns score 100 and an empty missing array (AC-3)', async () => {
    mockAllowed(
      baseCampSite({
        priceLow: 500,
        extraFeeAmount: null,
        extraFeeLabel: null,
        cancellationPolicy: 'MODERATE',
      })
    );
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      _count: { images: 2, options: 3 },
    });
    (prisma.spot.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

    const res = await completenessGET(getReq(), makeParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.score).toBe(100);
    expect(body.missing).toEqual([]);
  });

  it('scopes the relation-count query + spot count to this campsite id (no over-fetch)', async () => {
    mockAllowed(baseCampSite());
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      _count: { images: 1, options: 1 },
    });
    (prisma.spot.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    await completenessGET(getReq(), makeParams(CAMPSITE_ID));

    expect(prisma.campSite.findUnique).toHaveBeenCalledWith({
      where: { id: CAMPSITE_ID },
      select: { _count: { select: { images: true, options: true } } },
    });
    expect(prisma.spot.count).toHaveBeenCalledWith({
      where: { campSiteId: CAMPSITE_ID, deletedAt: null },
    });
  });

  it('[no-n+1] exactly 1 campSite counts query + 1 spot count query per call', async () => {
    mockAllowed(baseCampSite());
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      _count: { images: 0, options: 0 },
    });
    (prisma.spot.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    await completenessGET(getReq(), makeParams(CAMPSITE_ID));

    expect(prisma.campSite.findUnique).toHaveBeenCalledOnce();
    expect(prisma.spot.count).toHaveBeenCalledOnce();
  });

  it('sets Cache-Control: no-store — never cached (BR-1)', async () => {
    mockAllowed(baseCampSite());
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      _count: { images: 0, options: 0 },
    });
    (prisma.spot.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const res = await completenessGET(getReq(), makeParams(CAMPSITE_ID));
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('500 — a Prisma failure returns a generic message, no internals leaked', async () => {
    mockAllowed(baseCampSite());
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));
    (prisma.spot.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const res = await completenessGET(getReq(), makeParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect('details' in body).toBe(false);
  });
});

// ===========================================================================
// Group G: source-inspection — read-only guarantee, no persisted score (BR-1)
// ===========================================================================

describe('source-inspection — read-only guarantee (no score/field written, BR-1)', () => {
  const routeSrc = fs.readFileSync(
    path.join(process.cwd(), 'app/api/campsites/[id]/completeness/route.ts'),
    'utf-8'
  );
  const libSrc = fs.readFileSync(path.join(process.cwd(), 'lib/listing-completeness.ts'), 'utf-8');

  it('the route never calls a Prisma write method', () => {
    expect(routeSrc).not.toMatch(
      /prisma\.\w+\.(create|update|upsert|delete|createMany|updateMany|deleteMany)\(/
    );
  });

  it('the lib module never imports the Prisma client (pure function, no DB access)', () => {
    expect(libSrc).not.toContain("from '@/lib/prisma'");
    expect(libSrc).not.toContain('@prisma/client');
  });
});
