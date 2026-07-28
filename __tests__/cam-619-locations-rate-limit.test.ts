/**
 * cam-619-locations-rate-limit.test.ts — CAM-619 AC-5/BR-5
 *
 * `GET /api/locations/search` and `GET /api/admin-areas/subdistricts` were
 * public, unauthenticated, AND fully unthrottled (an ILIKE `contains` scan
 * over up to 7,452 `AdminArea` rows with no floor guard) — the exact gap
 * their two siblings (`POST /api/ai/chat`, `GET /api/ai/camp-detail/[id]`)
 * already close, per that route's own comment: "a public read-only route
 * still needs a floor guard against scraping/abuse". Both now share a
 * 100/15min per-IP limit (the general baseline `.claude/rules/security.md`
 * states).
 *
 * Layer: integration — direct route invocation with mocked Prisma + the REAL
 * in-process `checkRateLimit` store (never mock the layer under test, per
 * qa.md §6). Precedent: __tests__/cam-534-catalog-rate-limit.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminArea: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { GET as locationsSearchGET } from '@/app/api/locations/search/route';
import { GET as subdistrictsGET } from '@/app/api/admin-areas/subdistricts/route';
import { _store } from '@/lib/rate-limit';

const mockFindMany = prisma.adminArea.findMany as unknown as ReturnType<typeof vi.fn>;

function makeRequest(url: string, ip: string): NextRequest {
  return new NextRequest(url, { headers: { 'x-forwarded-for': ip } });
}

beforeEach(() => {
  vi.clearAllMocks();
  _store.clear();
  mockFindMany.mockResolvedValue([]);
});

describe('GET /api/locations/search — per-IP rate limit (locations:search:<ip>)', () => {
  it('[normal] a fresh IP is served normally (200, array shape)', async () => {
    const res = await locationsSearchGET(makeRequest('http://localhost/api/locations/search?type=province&q=a', '10.0.0.1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('[boundary] the 100th request in-window is still allowed', async () => {
    _store.set('locations:search:10.0.0.2', Array.from({ length: 99 }, (_, i) => Date.now() - i));
    const res = await locationsSearchGET(makeRequest('http://localhost/api/locations/search?type=province&q=a', '10.0.0.2'));
    expect(res.status).toBe(200);
  });

  it('[error/validation, teeth] the 101st request in-window is 429 with Retry-After — was unthrottled before', async () => {
    _store.set('locations:search:10.0.0.3', Array.from({ length: 100 }, (_, i) => Date.now() - i));
    const res = await locationsSearchGET(makeRequest('http://localhost/api/locations/search?type=province&q=a', '10.0.0.3'));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('rate_limited');
    expect(res.headers.get('Retry-After')).not.toBeNull();
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('[concurrent] a different IP is unaffected by another IP being rate-limited', async () => {
    _store.set('locations:search:10.0.0.4', Array.from({ length: 100 }, (_, i) => Date.now() - i));
    await locationsSearchGET(makeRequest('http://localhost/api/locations/search?type=province&q=a', '10.0.0.4'));

    const res = await locationsSearchGET(makeRequest('http://localhost/api/locations/search?type=province&q=a', '10.0.0.5'));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/admin-areas/subdistricts — per-IP rate limit (admin-areas:subdistricts:<ip>)', () => {
  it('[normal] a fresh IP is served normally (200, array shape)', async () => {
    const res = await subdistrictsGET(makeRequest('http://localhost/api/admin-areas/subdistricts?districtCode=1001', '20.0.0.1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('[boundary] the 100th request in-window is still allowed', async () => {
    _store.set('admin-areas:subdistricts:20.0.0.2', Array.from({ length: 99 }, (_, i) => Date.now() - i));
    const res = await subdistrictsGET(makeRequest('http://localhost/api/admin-areas/subdistricts?districtCode=1001', '20.0.0.2'));
    expect(res.status).toBe(200);
  });

  it('[error/validation, teeth] the 101st request in-window is 429 with Retry-After — was unthrottled before', async () => {
    _store.set('admin-areas:subdistricts:20.0.0.3', Array.from({ length: 100 }, (_, i) => Date.now() - i));
    const res = await subdistrictsGET(makeRequest('http://localhost/api/admin-areas/subdistricts?districtCode=1001', '20.0.0.3'));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('rate_limited');
    expect(res.headers.get('Retry-After')).not.toBeNull();
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('[error] a rate-limited request never reaches Prisma (checked before zod/param parsing)', async () => {
    _store.set('admin-areas:subdistricts:20.0.0.4', Array.from({ length: 100 }, (_, i) => Date.now() - i));
    // No districtCode at all — would normally 400 at the zod layer; the rate
    // limiter must win FIRST (mirrors the ai/camp-detail ordering).
    const res = await subdistrictsGET(makeRequest('http://localhost/api/admin-areas/subdistricts', '20.0.0.4'));
    expect(res.status).toBe(429);
  });
});
