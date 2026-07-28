/**
 * cam-619-coordinate-trigger-guard.test.ts — CAM-619 AC-1 (the hole this
 * story actually closes)
 *
 * The zod-layer rejection (cam-619-coordinates-and-price.test.ts) and the
 * mocked-Prisma route proof (cam-619-campsites-rate-limit.test.ts) both show
 * `prisma.campSite.update`/`create` is never called for an out-of-range
 * coordinate. This suite closes the loop for REAL: it runs the actual
 * `PUT /api/campsites/[id]` route handler against the real local dev
 * Postgres DB (never mocked Prisma) and proves the CAM-575
 * `campsite_coords_sync` DB trigger — which fires as a side effect of
 * `prisma.campSite.update` and derives `Location.lat/lon` FROM
 * `CampSite.latitude/longitude` with NO range check of its own (see
 * __tests__/cam-575-coordinate-sync-invariant.test.ts, which writes 99.5
 * directly via Prisma and shows the trigger propagates it verbatim) — never
 * sees the bad value, because the write it depends on never happens.
 *
 * Gated on `DATABASE_URL` being a real, reachable Postgres — same pattern as
 * cam-575-coordinate-sync-invariant.test.ts: SKIPS in CI (no Postgres
 * service for the `npm test` job), RUNS for real on localhost (dev DB),
 * exactly where this story's AC must be verified before merge (CLAUDE.md
 * Definition of Done). Every created row is a throwaway scratch pair,
 * deleted in `afterAll` regardless of pass/fail.
 *
 * Only `@/lib/auth` is mocked (to supply a session for the real, unmocked
 * `requireCampSitePermission` in lib/auth-utils.ts to resolve against the
 * real DB) — `@/lib/prisma` is NEVER mocked in this file.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const hasRealDb = !!process.env.DATABASE_URL;

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { PUT as campSitePUT } from '@/app/api/campsites/[id]/route';
import { _store } from '@/lib/rate-limit';

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

describe.skipIf(!hasRealDb)('CAM-619 (invariant) — a rejected out-of-range coordinate never reaches the campsite_coords_sync trigger', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  let userId: string;
  let locationId: string;
  let campSiteId: string;

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();

    const anyUser = await prisma.user.findFirst({ select: { id: true, role: true } });
    if (!anyUser) throw new Error('CAM-619 trigger-guard test needs at least one User row in the dev DB to attach a scratch CampSite to');
    userId = anyUser.id;

    const location = await prisma.location.create({
      data: { country: 'Thailand', province: 'CAM-619 test province', lat: 10, lon: 20 }, // provisional — overwritten below
    });
    locationId = location.id;

    // CAM-575's own suite (cam-575-coordinate-sync-invariant.test.ts) proves
    // a CampSite CREATE fires campsite_coords_sync too — so Location.lat/lon
    // is ALREADY 13.75/100.5 (not the provisional 10/20 above) by the time
    // this beforeAll returns.
    const campSite = await prisma.campSite.create({
      data: {
        nameTh: 'CAM-619 trigger-guard scratch', nameEn: 'CAM-619 trigger-guard scratch',
        nameThSlug: `cam619-guard-th-${Date.now()}`, nameEnSlug: `cam619-guard-en-${Date.now()}`,
        campSiteType: 'CAGD', accommodationTypes: 'TENT',
        latitude: 13.75, longitude: 100.5, // the canonical, VALID starting value
        checkInTime: '12:00', checkOutTime: '12:00', bookingMethod: 'ONST',
        locationId: location.id, operatorId: userId,
      },
    });
    campSiteId = campSite.id;
  });

  afterAll(async () => {
    if (campSiteId) await prisma.campSite.delete({ where: { id: campSiteId } }).catch(() => {});
    if (locationId) await prisma.location.delete({ where: { id: locationId } }).catch(() => {});
    await prisma?.$disconnect();
  });

  beforeEach(() => {
    _store.clear();
    mockAuth.mockResolvedValue({ user: { id: userId, role: 'HOST' } });
  });

  function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  function putRequest(id: string, body: Record<string, unknown>) {
    return new NextRequest(`http://localhost/api/campsites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
  }

  it('[Critical, teeth] latitude 999 via the REAL PUT route is 400 and never propagates through the trigger', async () => {
    const res = await campSitePUT(putRequest(campSiteId, { latitude: 999 }), makeParams(campSiteId));
    expect(res.status).toBe(400);

    const campSite = await prisma.campSite.findUnique({ where: { id: campSiteId } });
    const location = await prisma.location.findUnique({ where: { id: locationId } });

    // The write never happened at all — CampSite keeps its original valid
    // value, and Location (already synced to that SAME valid value by the
    // trigger firing on the scratch CREATE in beforeAll — CAM-575's own
    // suite proves CREATE fires it too) stays exactly there: never 999,
    // never Infinity, never anything the rejected write tried to send.
    expect(campSite.latitude).toBe(13.75);
    expect(location.lat).toBe(13.75);
  });

  it('[Critical, teeth] Infinity via the REAL PUT route is 400 and never propagates through the trigger', async () => {
    const res = await campSitePUT(putRequest(campSiteId, { longitude: Infinity }), makeParams(campSiteId));
    expect(res.status).toBe(400);

    const campSite = await prisma.campSite.findUnique({ where: { id: campSiteId } });
    expect(campSite.longitude).toBe(100.5);
  });

  it('[normal, control] a VALID coordinate update via the REAL PUT route DOES reach the trigger and syncs Location', async () => {
    const res = await campSitePUT(putRequest(campSiteId, { latitude: 18.79, longitude: 98.98 }), makeParams(campSiteId));
    expect(res.status).toBe(200);

    const campSite = await prisma.campSite.findUnique({ where: { id: campSiteId } });
    const location = await prisma.location.findUnique({ where: { id: locationId } });
    expect(campSite.latitude).toBe(18.79);
    expect(location.lat).toBe(18.79); // the trigger DID fire this time — proves the suite isn't just permanently red/misconfigured
    expect(location.lon).toBe(98.98);
  });
});
