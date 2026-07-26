/**
 * cam-563-campsites-route-province-id.test.ts — CAM-563
 * (platform-hardening/taxonomy-ui-foundation)
 *
 * `GET /api/campsites` (the live public catalog list/pagination endpoint)
 * now resolves an incoming `province` query param to its AdminArea subtree
 * BEFORE calling `buildCampSiteWhere`, so a camp stored in the other
 * language for the same real province is no longer silently invisible
 * (CAM-559 root cause). This suite proves the wiring end-to-end: the
 * resolver is called with the right name, its result reaches
 * `prisma.campSite.findMany`'s `where`, and a resolution failure fails OPEN
 * (never blocks the catalog — the legacy string match still applies).
 *
 * Mock shape follows the established precedent for invoking this route's
 * GET handler directly (`__tests__/cam-534-catalog-rate-limit.test.ts`,
 * `__tests__/cam-344-availability-badge.test.ts`).
 *
 * Coverage matrix (qa.md §7): normal · null/empty · error/validation
 * (fail-open) · boundary (no province param at all).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockCampSiteFindMany = vi.fn();
const mockAdminAreaFindFirst = vi.fn();
const mockAdminAreaFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: { findMany: (...args: unknown[]) => mockCampSiteFindMany(...args) },
    adminArea: {
      findFirst: (...args: unknown[]) => mockAdminAreaFindFirst(...args),
      findMany: (...args: unknown[]) => mockAdminAreaFindMany(...args),
    },
  },
}));

vi.mock('@/lib/auth-utils', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));

const { GET: campsiteGET } = await import('@/app/api/campsites/route');

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/campsites${query}`, {
    headers: { 'x-forwarded-for': '9.9.9.9' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCampSiteFindMany.mockResolvedValue([]);
  mockAdminAreaFindFirst.mockResolvedValue({ id: 'prov-cnx' });
  // CAM-580: this single mock now backs BOTH "no districts/sub-districts
  // under this fake province" AND getProvinceThaiNameMap's PROVINCE-level
  // query (moved off the dropped ThailandLocation table) — an empty array
  // satisfies both call shapes, and this suite asserts neither.
  mockAdminAreaFindMany.mockResolvedValue([]);
});

describe('CAM-563 — GET /api/campsites: province resolution wired into the real endpoint', () => {
  it('[normal] a province query param resolves via the AdminArea tree and the resulting id-set reaches the Prisma where clause', async () => {
    const res = await campsiteGET(makeRequest('?province=Chiang%20Mai'));

    expect(res.status).toBe(200);
    expect(mockAdminAreaFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ level: 'PROVINCE' }) })
    );
    const call = mockCampSiteFindMany.mock.calls[0][0];
    expect(call.where.location.OR).toEqual([
      { province: 'Chiang Mai' },
      { adminAreaId: { in: ['prov-cnx'] } },
    ]);
  });

  it('[boundary] no province query param at all -> the resolver is never called, base behavior unaffected', async () => {
    const res = await campsiteGET(makeRequest(''));

    expect(res.status).toBe(200);
    expect(mockAdminAreaFindFirst).not.toHaveBeenCalled();
    const call = mockCampSiteFindMany.mock.calls[0][0];
    expect(call.where.location).toBeUndefined();
  });

  it('[error/validation] a resolver failure fails OPEN — the request still succeeds using the legacy string-only match', async () => {
    mockAdminAreaFindFirst.mockRejectedValue(new Error('db down'));
    const res = await campsiteGET(makeRequest('?province=Chiang%20Mai'));

    expect(res.status).toBe(200);
    const call = mockCampSiteFindMany.mock.calls[0][0];
    expect(call.where.location.province).toBe('Chiang Mai');
    expect(call.where.location.OR).toBeUndefined();
  });

  it('[null/empty] an unresolvable province name (no AdminArea match) still succeeds — legacy string match is the only path, never a thrown error', async () => {
    mockAdminAreaFindFirst.mockResolvedValue(null);
    const res = await campsiteGET(makeRequest('?province=Atlantis'));

    expect(res.status).toBe(200);
    const call = mockCampSiteFindMany.mock.calls[0][0];
    expect(call.where.location.province).toBe('Atlantis');
    expect(call.where.location.OR).toBeUndefined();
  });
});
