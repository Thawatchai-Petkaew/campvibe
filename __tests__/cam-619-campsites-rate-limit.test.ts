/**
 * cam-619-campsites-rate-limit.test.ts — CAM-619 AC-4/BR-4 (+ AC-1/AC-2 route-level proof)
 *
 * `PUT`/`DELETE /api/campsites/[id]` had NO rate limit at all while their
 * sibling `POST /api/campsites` is capped at 10/hour/user — this closes that
 * gap (PUT: 30/hour, DELETE: 10/hour, both per-user).
 *
 * Also proves, at the ROUTE level (not just the zod unit layer in
 * cam-619-coordinates-and-price.test.ts), that a rejected out-of-range
 * coordinate or inverted price NEVER reaches `prisma.campSite.update` — the
 * one Prisma call that fires the `campsite_coords_sync` DB trigger in
 * production. A mocked `prisma.campSite.update` that is provably never
 * called is the causal proof the real-DB test
 * (cam-619-coordinate-trigger-guard.test.ts) closes end-to-end.
 *
 * Layer: integration — direct route invocation with mocked Prisma +
 * mocked `requireCampSitePermission`/`auth` + the REAL in-process
 * `checkRateLimit` store (never mock the layer under test, per qa.md §6).
 * Precedent: __tests__/cam-520-campsitetype-single-select.test.ts,
 * __tests__/cam-534-catalog-rate-limit.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  requireCampSitePermission: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireCampSitePermission } from '@/lib/auth-utils';
import { PUT as campSitePUT, DELETE as campSiteDELETE } from '@/app/api/campsites/[id]/route';
import { _store } from '@/lib/rate-limit';

const mockUpdate = prisma.campSite.update as unknown as ReturnType<typeof vi.fn>;
const mockDelete = prisma.campSite.delete as unknown as ReturnType<typeof vi.fn>;
const mockPermission = requireCampSitePermission as unknown as ReturnType<typeof vi.fn>;

const CAMP_ID = '550e8400-e29b-41d4-a716-446655440619';
const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function allowedFor(userId: string, extra: Record<string, unknown> = {}) {
  mockPermission.mockResolvedValue({
    error: null,
    campSite: {
      id: CAMP_ID,
      operatorId: userId,
      isPublished: false,
      priceLow: null,
      priceHigh: null,
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

function putRequest(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/campsites/${CAMP_ID}`, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function deleteRequest() {
  return new NextRequest(`http://localhost/api/campsites/${CAMP_ID}`, { method: 'DELETE' });
}

beforeEach(() => {
  vi.clearAllMocks();
  _store.clear();
  mockUpdate.mockResolvedValue({ id: CAMP_ID, nameThSlug: 'test-th', nameEnSlug: 'test-en' });
  mockDelete.mockResolvedValue({ id: CAMP_ID, nameThSlug: 'test-th', nameEnSlug: 'test-en' });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-4/BR-4 — PUT rate limit (30/hour/user)
// ═══════════════════════════════════════════════════════════════════════════

describe('PUT /api/campsites/[id] — per-user rate limit (campsite:update:<userId>)', () => {
  it('[normal] a fresh user is served normally', async () => {
    allowedFor('user-put-1');
    const res = await campSitePUT(putRequest({ nameTh: 'ok' }), makeParams(CAMP_ID));
    expect(res.status).toBe(200);
  });

  it('[boundary] the 30th PUT in the window is still allowed', async () => {
    allowedFor('user-put-2');
    _store.set('campsite:update:user-put-2', Array.from({ length: 29 }, (_, i) => Date.now() - i));
    const res = await campSitePUT(putRequest({ nameTh: 'ok' }), makeParams(CAMP_ID));
    expect(res.status).toBe(200);
  });

  it('[error/validation, teeth] the 31st PUT in the window is 429 with Retry-After — was unlimited before', async () => {
    allowedFor('user-put-3');
    _store.set('campsite:update:user-put-3', Array.from({ length: 30 }, (_, i) => Date.now() - i));
    const res = await campSitePUT(putRequest({ nameTh: 'ok' }), makeParams(CAMP_ID));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('rate_limited');
    expect(res.headers.get('Retry-After')).not.toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('[concurrent] a different user is unaffected by another user being rate-limited', async () => {
    allowedFor('user-put-4');
    _store.set('campsite:update:user-put-4', Array.from({ length: 30 }, (_, i) => Date.now() - i));
    await campSitePUT(putRequest({ nameTh: 'ok' }), makeParams(CAMP_ID)); // consumes user-put-4's limit

    allowedFor('user-put-5');
    const res = await campSitePUT(putRequest({ nameTh: 'ok' }), makeParams(CAMP_ID));
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-4/BR-4 — DELETE rate limit (10/hour/user)
// ═══════════════════════════════════════════════════════════════════════════

describe('DELETE /api/campsites/[id] — per-user rate limit (campsite:delete:<userId>)', () => {
  it('[normal] a fresh user is served normally', async () => {
    allowedFor('user-del-1');
    const res = await campSiteDELETE(deleteRequest(), makeParams(CAMP_ID));
    expect(res.status).toBe(200);
  });

  it('[boundary] the 10th DELETE in the window is still allowed', async () => {
    allowedFor('user-del-2');
    _store.set('campsite:delete:user-del-2', Array.from({ length: 9 }, (_, i) => Date.now() - i));
    const res = await campSiteDELETE(deleteRequest(), makeParams(CAMP_ID));
    expect(res.status).toBe(200);
  });

  it('[error/validation, teeth] the 11th DELETE in the window is 429 with Retry-After — was unlimited before', async () => {
    allowedFor('user-del-3');
    _store.set('campsite:delete:user-del-3', Array.from({ length: 10 }, (_, i) => Date.now() - i));
    const res = await campSiteDELETE(deleteRequest(), makeParams(CAMP_ID));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('rate_limited');
    expect(res.headers.get('Retry-After')).not.toBeNull();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-1 (route-level) — an out-of-range coordinate never reaches the write
// that fires campsite_coords_sync
// ═══════════════════════════════════════════════════════════════════════════

describe('PUT /api/campsites/[id] — rejected coordinate never reaches prisma.campSite.update (CAM-619 AC-1)', () => {
  it('[error/validation, teeth] latitude 999 is 400 and prisma.campSite.update is NEVER called', async () => {
    allowedFor('user-coord-1');
    const res = await campSitePUT(putRequest({ latitude: 999 }), makeParams(CAMP_ID));
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('[normal] a valid latitude update DOES reach prisma.campSite.update', async () => {
    allowedFor('user-coord-2');
    const res = await campSitePUT(putRequest({ latitude: 13.75, longitude: 100.5 }), makeParams(CAMP_ID));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-2 (route-level) — priceLow<=priceHigh IS enforced on PUT, including the
// partial-update projection against the STORED value
//
// History (owner-overridden): a persisted priceLow>priceHigh is a real
// defect (the card renders an inverted range) — this order rule stays on
// BOTH create and update. `e2e/regression/ac1-edit-round-trip.spec.ts`
// briefly 400'd because its OWN fixture (priceLow raised to 777 against the
// seeded camp's priceHigh of 600) was itself an inverted band, not because
// the guard was wrong; the fixture was corrected (450, in-band) instead of
// weakening this check. See lib/validations/campsite.ts's
// `isPriceOrderValid` doc comment for the full account + the recorded
// client-side follow-up (tech.md) so a host editing one field doesn't see a
// 400 naming the field they didn't touch.
// ═══════════════════════════════════════════════════════════════════════════

describe('PUT /api/campsites/[id] — priceLow<=priceHigh order (CAM-619 AC-2)', () => {
  it('[error/validation, teeth] priceLow=5000 > priceHigh=1000 in the SAME request is 400, no write', async () => {
    allowedFor('user-price-1');
    const res = await campSitePUT(putRequest({ priceLow: 5000, priceHigh: 1000 }), makeParams(CAMP_ID));
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('[error/validation, teeth, pinned regression] the e2e fixture shape BEFORE its correction (priceLow raised above the stored priceHigh) is correctly REJECTED — the fixture was the defect, not this guard', async () => {
    allowedFor('user-price-2', { priceLow: 250, priceHigh: 600 });
    const res = await campSitePUT(putRequest({ nameTh: 'repro edit', priceLow: 777, priceHigh: 600 }), makeParams(CAMP_ID));
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('[normal, pinned regression] the e2e fixture shape AFTER its correction (priceLow raised to 450, still <= the stored priceHigh of 600) saves', async () => {
    allowedFor('user-price-3', { priceLow: 250, priceHigh: 600 });
    const res = await campSitePUT(putRequest({ nameTh: 'repro edit', priceLow: 450 }), makeParams(CAMP_ID));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('[error/validation, teeth] a partial update sending ONLY priceHigh=100 against a STORED priceLow=200 is 400 (post-save projection)', async () => {
    allowedFor('user-price-4', { priceLow: 200, priceHigh: null });
    const res = await campSitePUT(putRequest({ priceHigh: 100 }), makeParams(CAMP_ID));
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('[normal] a partial update sending ONLY priceLow=50 against a STORED priceHigh=1000 is accepted', async () => {
    allowedFor('user-price-5', { priceLow: null, priceHigh: 1000 });
    const res = await campSitePUT(putRequest({ priceLow: 50 }), makeParams(CAMP_ID));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('[boundary] the .min(0)/.max(100000) RANGE bound is still enforced on PUT alongside the ORDER rule', async () => {
    allowedFor('user-price-6');
    const negative = await campSitePUT(putRequest({ priceLow: -1 }), makeParams(CAMP_ID));
    expect(negative.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();

    const tooHigh = await campSitePUT(putRequest({ priceHigh: 100001 }), makeParams(CAMP_ID));
    expect(tooHigh.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
