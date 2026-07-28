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
// CAM-619 BR-2 CORRECTION — PUT does NOT enforce priceLow<=priceHigh
//
// Regression caught in CI (PR 700): e2e/regression/ac1-edit-round-trip.spec.ts
// bumps a real seeded camp's priceLow from 250 to 777 in ONE save WITHOUT
// touching priceHigh (600) — `components/CampgroundForm.tsx` always submits
// the full current form state (both price fields), so this is an ordinary
// single-field host edit, not a malformed request. Reproduced directly
// against the route handler + the real seeded row before this fix:
// `{ nameTh: 'repro edit', priceLow: 777, priceHigh: 600 }` ->
// `400 { "error": "ราคาต่ำสุดไม่สามารถมากกว่าราคาสูงสุดได้" }`.
// The ordering rule stays on POST /api/campsites (create) only — see
// cam-619-campsites-create-price-order.test.ts — where there is no prior
// saved state a host could be mid-way through reconciling.
// ═══════════════════════════════════════════════════════════════════════════

describe('PUT /api/campsites/[id] — does NOT enforce priceLow<=priceHigh (CAM-619 BR-2 correction)', () => {
  it('[Prove-It regression, was 400] the EXACT e2e repro shape (priceLow raised above the stored priceHigh, priceHigh unchanged) now saves', async () => {
    allowedFor('user-price-1', { priceLow: 250, priceHigh: 600 });
    const res = await campSitePUT(putRequest({ nameTh: 'repro edit', priceLow: 777, priceHigh: 600 }), makeParams(CAMP_ID));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('[normal] a partial update sending ONLY the new priceLow (priceHigh omitted from the request) still saves, even against a lower stored priceHigh', async () => {
    allowedFor('user-price-2', { priceLow: 250, priceHigh: 600 });
    const res = await campSitePUT(putRequest({ priceLow: 777 }), makeParams(CAMP_ID));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('[normal] an ordinary, already-correctly-ordered pair still saves (unaffected)', async () => {
    allowedFor('user-price-3');
    const res = await campSitePUT(putRequest({ priceLow: 500, priceHigh: 1200 }), makeParams(CAMP_ID));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('[boundary] the .min(0)/.max(100000) RANGE bound is still enforced on PUT (only the cross-field ORDER rule was dropped)', async () => {
    allowedFor('user-price-4');
    const negative = await campSitePUT(putRequest({ priceLow: -1 }), makeParams(CAMP_ID));
    expect(negative.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();

    const tooHigh = await campSitePUT(putRequest({ priceHigh: 100001 }), makeParams(CAMP_ID));
    expect(tooHigh.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
