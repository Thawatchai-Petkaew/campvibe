/**
 * cam-654-price-unit-write-path.test.ts — CAM-654 (epic CAM-648, ADR-014)
 *
 * CAM-650/651/652/653 landed the column, the engine, and the captions — but
 * nothing could ever be anything other than `PER_SITE` because no write path
 * accepted `priceUnit`. This story makes it settable; this file proves the
 * write path, not the engine (already proven by
 * __tests__/cam-652-charge-the-chosen-unit.test.ts) or the schema defaults
 * (already proven by __tests__/cam-650-pricing-unit-schema.test.ts).
 *
 * Coverage:
 *  1. Zod boundary (campSiteSchema/spotSchema) — PER_PERSON/PER_SITE accepted,
 *     PER_TENT rejected (ADR-014 §1: gated at the zod layer, not the enum).
 *  2. PUT /api/campsites/[id] — a set round-trips into the Prisma write, an
 *     omitted priceUnit never reaches the write (no clear path — matches
 *     campSiteType/ownershipType's existing shape).
 *  3. POST /api/campsites — priceUnit forwarded verbatim when sent.
 *  4. POST/PUT /api/campsites/[id]/spots(/[spotId]) — same shape, spot-level.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { campSiteSchema } from '@/lib/validations/campsite';
import { spotSchema } from '@/lib/validations/spot';

// ---------------------------------------------------------------------------
// 1. Zod boundary — shared by both schemas (PriceUnitEnum, campsite.ts)
// ---------------------------------------------------------------------------
const CAMP_VALID_BASE = {
  nameTh: 'ทดสอบ',
  campSiteType: 'CAGD' as const,
  latitude: 13.75,
  longitude: 100.5,
  checkInTime: '12:00',
  checkOutTime: '12:00',
  bookingMethod: 'ONST' as const,
  locationId: '550e8400-e29b-41d4-a716-446655440000',
};

const SPOT_VALID_BASE = {
  name: 'จุด A1',
  pricePerNight: 350,
  campSiteId: '550e8400-e29b-41d4-a716-446655440000',
};

describe('campSiteSchema.priceUnit — CAM-654 boundary (ADR-014 §1)', () => {
  it('[normal] PER_PERSON is accepted', () => {
    expect(campSiteSchema.safeParse({ ...CAMP_VALID_BASE, priceUnit: 'PER_PERSON' }).success).toBe(true);
  });

  it('[normal] PER_SITE is accepted', () => {
    expect(campSiteSchema.safeParse({ ...CAMP_VALID_BASE, priceUnit: 'PER_SITE' }).success).toBe(true);
  });

  it('[error/validation, teeth] PER_TENT is REJECTED even though it is a real Prisma enum value', () => {
    const result = campSiteSchema.safeParse({ ...CAMP_VALID_BASE, priceUnit: 'PER_TENT' });
    expect(result.success).toBe(false);
  });

  it('[normal] omitted priceUnit still passes (no create-time requirement — DB column default covers it)', () => {
    expect(campSiteSchema.safeParse(CAMP_VALID_BASE).success).toBe(true);
  });

  it('[error/validation] an unrecognised string is REJECTED', () => {
    expect(campSiteSchema.safeParse({ ...CAMP_VALID_BASE, priceUnit: 'PER_NIGHT' }).success).toBe(false);
  });
});

describe('spotSchema.priceUnit — CAM-654 boundary, same shared enum', () => {
  it('[normal] PER_PERSON and PER_SITE are both accepted', () => {
    expect(spotSchema.safeParse({ ...SPOT_VALID_BASE, priceUnit: 'PER_PERSON' }).success).toBe(true);
    expect(spotSchema.safeParse({ ...SPOT_VALID_BASE, priceUnit: 'PER_SITE' }).success).toBe(true);
  });

  it('[error/validation, teeth] PER_TENT is REJECTED', () => {
    expect(spotSchema.safeParse({ ...SPOT_VALID_BASE, priceUnit: 'PER_TENT' }).success).toBe(false);
  });

  it('[normal] spotSchema.partial() (the PUT shape) leaves priceUnit absent when the request omits it', () => {
    const result = spotSchema.partial().safeParse({ name: 'renamed' });
    expect(result.success).toBe(true);
    expect(result.success && 'priceUnit' in result.data).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2/3/4. Route-level — ONE shared prisma mock (campSite + location + spot)
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: { update: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    location: { update: vi.fn() },
    spot: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
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
import { POST as spotPOST } from '@/app/api/campsites/[id]/spots/route';
import { PUT as spotPUT } from '@/app/api/campsites/[id]/spots/[spotId]/route';
import { _store } from '@/lib/rate-limit';

const mockUpdate = prisma.campSite.update as unknown as ReturnType<typeof vi.fn>;
const mockCreate = prisma.campSite.create as unknown as ReturnType<typeof vi.fn>;
const mockFindFirst = prisma.campSite.findFirst as unknown as ReturnType<typeof vi.fn>;
const mockSpotCreate = prisma.spot.create as unknown as ReturnType<typeof vi.fn>;
const mockSpotUpdate = prisma.spot.update as unknown as ReturnType<typeof vi.fn>;
const mockSpotFindFirst = prisma.spot.findFirst as unknown as ReturnType<typeof vi.fn>;
const mockPermission = requireCampSitePermission as unknown as ReturnType<typeof vi.fn>;
const mockRequireAuth = requireAuth as unknown as ReturnType<typeof vi.fn>;

const CAMP_ID = '550e8400-e29b-41d4-a716-446655440654';
const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function allowedFor(userId: string, extra: Record<string, unknown> = {}) {
  mockPermission.mockResolvedValue({
    error: null,
    campSite: {
      id: CAMP_ID,
      operatorId: userId,
      isPublished: false,
      priceLow: 250,
      priceHigh: 250,
      priceUnit: 'PER_SITE',
      extraFeeAmount: null,
      extraFeeLabel: null,
      cancellationPolicy: null,
      useSpotView: false,
      maxGuestsPerDay: null,
      nameThSlug: 'test-th',
      nameEnSlug: 'test-en',
      locationId: '550e8400-e29b-41d4-a716-446655440001',
      ...extra,
    },
    session: { user: { id: userId, role: 'HOST' } },
  });
}

function putRequest(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function postRequest(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  _store.clear();
  mockUpdate.mockResolvedValue({ id: CAMP_ID, nameThSlug: 'test-th', nameEnSlug: 'test-en' });
  mockFindFirst.mockResolvedValue(null); // no other camp already linked to this location (POST path)
});

describe('PUT /api/campsites/[id] — priceUnit round-trip (CAM-654)', () => {
  it('[normal] setting priceUnit: PER_PERSON reaches prisma.campSite.update with that exact value', async () => {
    allowedFor('user-pu-1');
    const res = await campSitePUT(
      putRequest(`http://localhost/api/campsites/${CAMP_ID}`, { priceUnit: 'PER_PERSON' }),
      makeParams(CAMP_ID)
    );
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ priceUnit: 'PER_PERSON' }) })
    );
  });

  it('[error/validation, teeth] PER_TENT is rejected 400 and prisma.campSite.update is NEVER called', async () => {
    allowedFor('user-pu-2');
    const res = await campSitePUT(
      putRequest(`http://localhost/api/campsites/${CAMP_ID}`, { priceUnit: 'PER_TENT' }),
      makeParams(CAMP_ID)
    );
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('[normal] omitting priceUnit on an unrelated field-only PUT leaves the stored value untouched (no key in the write at all)', async () => {
    allowedFor('user-pu-3', { priceUnit: 'PER_PERSON' }); // camp already set to PER_PERSON
    const res = await campSitePUT(
      putRequest(`http://localhost/api/campsites/${CAMP_ID}`, { nameTh: 'ชื่อใหม่' }),
      makeParams(CAMP_ID)
    );
    expect(res.status).toBe(200);
    const call = mockUpdate.mock.calls[0][0];
    expect('priceUnit' in call.data).toBe(false); // never written -> Prisma leaves the column as-is
  });

  it('[boundary] a camp left alone (no priceUnit sent, no other price field touched) still totals as before — priceLow/priceHigh also absent from the write (CAM-651 I2 golden numbers untouched)', async () => {
    allowedFor('user-pu-4');
    const res = await campSitePUT(
      putRequest(`http://localhost/api/campsites/${CAMP_ID}`, { nameTh: 'ไม่แตะราคา' }),
      makeParams(CAMP_ID)
    );
    expect(res.status).toBe(200);
    const call = mockUpdate.mock.calls[0][0];
    expect('priceUnit' in call.data).toBe(false);
    expect('priceLow' in call.data).toBe(false);
    expect('priceHigh' in call.data).toBe(false);
  });
});

describe('POST /api/campsites — priceUnit forwarded verbatim (CAM-654)', () => {
  const CREATE_BODY = {
    nameTh: 'แคมป์ใหม่',
    nameThSlug: 'camp-new',
    nameEnSlug: 'camp-new-en',
    campSiteType: 'CAGD',
    latitude: 13.75,
    longitude: 100.5,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    bookingMethod: 'ONST',
    locationId: '550e8400-e29b-41d4-a716-446655440002',
    priceUnit: 'PER_PERSON',
  };

  beforeEach(() => {
    mockRequireAuth.mockResolvedValue({ error: null, session: { user: { id: 'user-create-1', role: 'HOST' } } });
    mockCreate.mockResolvedValue({ id: 'new-camp-1', nameThSlug: 'camp-new', nameEnSlug: 'camp-new-en' });
  });

  it('[normal] a create sending priceUnit: PER_PERSON (the form default for a NEW camp, ADR-014 §2) writes it verbatim', async () => {
    const res = await campSitePOST(postRequest('http://localhost/api/campsites', CREATE_BODY));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ priceUnit: 'PER_PERSON' }) })
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Spot POST/PUT — same shape, spot-level (ADR-014 §2: inert today, wired
//    for symmetry so a later spot-selection story never needs its own
//    migration).
// ---------------------------------------------------------------------------
const SPOT_CAMP_ID = '550e8400-e29b-41d4-a716-446655440700';
const SPOT_ID = '550e8400-e29b-41d4-a716-446655440701';
const spotParams = (id: string) => ({ params: Promise.resolve({ id }) });
const spotIdParams = (id: string, spotId: string) => ({ params: Promise.resolve({ id, spotId }) });

describe('POST /api/campsites/[id]/spots — priceUnit forwarded verbatim (CAM-654)', () => {
  beforeEach(() => {
    mockPermission.mockResolvedValue({
      error: null,
      campSite: { id: SPOT_CAMP_ID, nameThSlug: 'test-th', nameEnSlug: 'test-en' },
      session: { user: { id: 'user-spot-1', role: 'HOST' } },
    });
    mockSpotCreate.mockResolvedValue({ id: 'spot-new-1' });
  });

  it('[normal] a create sending priceUnit: PER_PERSON writes it verbatim', async () => {
    const res = await spotPOST(
      postRequest(`http://localhost/api/campsites/${SPOT_CAMP_ID}/spots`, {
        name: 'จุด A1',
        pricePerNight: 350,
        priceUnit: 'PER_PERSON',
      }),
      spotParams(SPOT_CAMP_ID)
    );
    expect(res.status).toBe(201);
    expect(mockSpotCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ priceUnit: 'PER_PERSON' }) })
    );
  });

  it('[error/validation, teeth] PER_TENT is rejected 400 and prisma.spot.create is NEVER called', async () => {
    const res = await spotPOST(
      postRequest(`http://localhost/api/campsites/${SPOT_CAMP_ID}/spots`, {
        name: 'จุด A2',
        pricePerNight: 350,
        priceUnit: 'PER_TENT',
      }),
      spotParams(SPOT_CAMP_ID)
    );
    expect(res.status).toBe(400);
    expect(mockSpotCreate).not.toHaveBeenCalled();
  });
});

describe('PUT /api/campsites/[id]/spots/[spotId] — priceUnit round-trip (CAM-654)', () => {
  beforeEach(() => {
    mockPermission.mockResolvedValue({
      error: null,
      campSite: { id: SPOT_CAMP_ID, nameThSlug: 'test-th', nameEnSlug: 'test-en' },
      session: { user: { id: 'user-spot-2', role: 'HOST' } },
    });
    mockSpotFindFirst.mockResolvedValue({ id: SPOT_ID });
    mockSpotUpdate.mockResolvedValue({ id: SPOT_ID });
  });

  it('[normal] setting priceUnit: PER_PERSON reaches prisma.spot.update with that exact value', async () => {
    const res = await spotPUT(
      putRequest(`http://localhost/api/campsites/${SPOT_CAMP_ID}/spots/${SPOT_ID}`, { priceUnit: 'PER_PERSON' }),
      spotIdParams(SPOT_CAMP_ID, SPOT_ID)
    );
    expect(res.status).toBe(200);
    expect(mockSpotUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ priceUnit: 'PER_PERSON' }) })
    );
  });

  it('[normal] omitting priceUnit on an unrelated field-only PUT never writes the key at all', async () => {
    const res = await spotPUT(
      putRequest(`http://localhost/api/campsites/${SPOT_CAMP_ID}/spots/${SPOT_ID}`, { name: 'renamed' }),
      spotIdParams(SPOT_CAMP_ID, SPOT_ID)
    );
    expect(res.status).toBe(200);
    const call = mockSpotUpdate.mock.calls[0][0];
    expect('priceUnit' in call.data).toBe(false);
  });

  it('[error/validation, teeth] PER_TENT is rejected 400 and prisma.spot.update is NEVER called', async () => {
    const res = await spotPUT(
      putRequest(`http://localhost/api/campsites/${SPOT_CAMP_ID}/spots/${SPOT_ID}`, { priceUnit: 'PER_TENT' }),
      spotIdParams(SPOT_CAMP_ID, SPOT_ID)
    );
    expect(res.status).toBe(400);
    expect(mockSpotUpdate).not.toHaveBeenCalled();
  });
});
