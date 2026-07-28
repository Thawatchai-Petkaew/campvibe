/**
 * cam-617-location-exclusivity-real-db.test.ts — CAM-617 (real-DB proof)
 *
 * Closes the loop for REAL, against the actual local dev Postgres DB (never
 * mocked Prisma) — same pattern and reasoning as
 * __tests__/cam-619-coordinate-trigger-guard.test.ts:
 *
 *  1. A second camp cannot silently attach to a Location another camp
 *     already uses (the actual CAM-617 attack: read another camp's
 *     `locationId` off `GET /api/campsites/[id]` and hand it to
 *     `POST /api/campsites` as your own new camp's `locationId`) — and the
 *     shared Location's coordinates are never touched by the blocked
 *     attempt. This is the sharpest symptom named in the ticket: the
 *     CAM-575 `campsite_coords_sync` trigger fires per-CampSite-row and
 *     unconditionally overwrites `Location.lat/lon` with the writing row's
 *     own coordinates — two camps sharing one Location would otherwise
 *     fight over it, last writer wins.
 *  2. The legitimate, single-camp-per-location create path still works
 *     end-to-end THROUGH THE REAL ROUTE, including the coordinate trigger
 *     actually syncing a fresh Location — the part most likely to break
 *     quietly from an over-broad guard.
 *
 * Gated on `DATABASE_URL` being a real, reachable Postgres: SKIPS in CI (no
 * Postgres service for the `npm test` job), RUNS for real on localhost (dev
 * DB) — exactly where this story's AC must be verified before merge
 * (CLAUDE.md Definition of Done). Every created row is a throwaway scratch
 * row, deleted in `afterAll` regardless of pass/fail.
 *
 * Only `@/lib/auth` is mocked (to supply a session for the real, unmocked
 * `requireAuth` in lib/auth-utils.ts to resolve against) — `@/lib/prisma` is
 * NEVER mocked in this file.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const hasRealDb = !!process.env.DATABASE_URL;

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { POST as campSitePOST } from '@/app/api/campsites/route';
import { _store } from '@/lib/rate-limit';

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

const VALID_BASE = {
  nameTh: 'ทดสอบ CAM-617 (real DB)',
  campSiteType: 'CAGD',
  checkInTime: '12:00',
  checkOutTime: '12:00',
  bookingMethod: 'ONST',
};

function postRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/campsites', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe.skipIf(!hasRealDb)('CAM-617 (real DB) — a new camp cannot silently attach to another camp\'s Location', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  let hostAId: string;
  let hostBId: string;

  // Scenario A — sharing attempt.
  let sharedLocationId: string;
  let campAId: string; // pre-existing camp, already attached to sharedLocationId

  // Scenario B — the legitimate control path.
  let freshLocationId: string;
  let campBId: string; // created via the real route inside the control test

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();

    const users = await prisma.user.findMany({ select: { id: true }, take: 2 });
    if (users.length === 0) throw new Error('CAM-617 real-DB test needs at least one User row in the dev DB');
    hostAId = users[0].id;
    // Falls back to the SAME user when the dev DB only seeded one — still a
    // valid proof of this story's actual rule (exclusivity, not ownership;
    // see the "same operator" case in cam-617-location-exclusivity.test.ts).
    hostBId = users[1]?.id ?? users[0].id;

    const sharedLocation = await prisma.location.create({
      data: { country: 'Thailand', province: 'CAM-617 shared test province', lat: 10, lon: 20 },
    });
    sharedLocationId = sharedLocation.id;

    // CAM-575's own suite proves a CampSite CREATE fires campsite_coords_sync
    // too — so sharedLocation.lat/lon is already 13.75/100.5 (not the
    // provisional 10/20 above) by the time this beforeAll returns.
    const campA = await prisma.campSite.create({
      data: {
        nameTh: 'CAM-617 existing camp (host A)', nameEn: 'CAM-617 existing camp',
        nameThSlug: `cam617-a-th-${Date.now()}`, nameEnSlug: `cam617-a-en-${Date.now()}`,
        campSiteType: 'CAGD', accommodationTypes: 'TENT',
        latitude: 13.75, longitude: 100.5,
        checkInTime: '12:00', checkOutTime: '12:00', bookingMethod: 'ONST',
        locationId: sharedLocationId, operatorId: hostAId,
      },
    });
    campAId = campA.id;

    // A fresh, never-linked Location — mirrors what POST /api/location
    // actually produces on the legitimate create flow.
    const freshLocation = await prisma.location.create({
      data: { country: 'Thailand', province: 'CAM-617 fresh test province', lat: 10, lon: 20 },
    });
    freshLocationId = freshLocation.id;
  });

  afterAll(async () => {
    if (campBId) await prisma.campSite.delete({ where: { id: campBId } }).catch(() => {});
    if (campAId) await prisma.campSite.delete({ where: { id: campAId } }).catch(() => {});
    if (freshLocationId) await prisma.location.delete({ where: { id: freshLocationId } }).catch(() => {});
    if (sharedLocationId) await prisma.location.delete({ where: { id: sharedLocationId } }).catch(() => {});
    await prisma?.$disconnect();
  });

  beforeEach(() => {
    _store.clear();
  });

  it('[Critical, teeth] a NEW camp cannot attach to a Location another camp already uses — the shared row is never touched', async () => {
    mockAuth.mockResolvedValue({ user: { id: hostBId, role: 'HOST' } });

    const res = await campSitePOST(postRequest({
      ...VALID_BASE,
      locationId: sharedLocationId,
      latitude: 18.79, // host B's would-be new pin — deliberately different from host A's
      longitude: 98.98,
    }));

    expect(res.status).toBe(409);

    // No second camp was created against the shared Location.
    const attachedCount = await prisma.campSite.count({ where: { locationId: sharedLocationId } });
    expect(attachedCount).toBe(1);

    // The sharpest symptom (tech.md): had this NOT been blocked,
    // campsite_coords_sync would have overwritten Location.lat/lon with
    // host B's coordinates the moment a second CampSite row pointed at it.
    // Because the create never happened, the Location keeps host A's own,
    // already-synced value.
    const location = await prisma.location.findUnique({ where: { id: sharedLocationId } });
    expect(location.lat).toBe(13.75);
    expect(location.lon).toBe(100.5);
  });

  it('[normal, control] the legitimate create path still works end-to-end, including the coordinate trigger', async () => {
    mockAuth.mockResolvedValue({ user: { id: hostAId, role: 'HOST' } });

    const res = await campSitePOST(postRequest({
      ...VALID_BASE,
      locationId: freshLocationId,
      latitude: 15.5,
      longitude: 101.2,
    }));

    expect(res.status).toBe(201);
    const created = await res.json();
    campBId = created.id;

    const campSite = await prisma.campSite.findUnique({ where: { id: campBId } });
    expect(campSite.latitude).toBe(15.5);
    expect(campSite.longitude).toBe(101.2);
    expect(campSite.locationId).toBe(freshLocationId);

    // The campsite_coords_sync trigger DID fire through the real route —
    // Location's provisional 10/20 is now overwritten to match the created
    // CampSite's own coordinates.
    const location = await prisma.location.findUnique({ where: { id: freshLocationId } });
    expect(location.lat).toBe(15.5);
    expect(location.lon).toBe(101.2);
  });
});
