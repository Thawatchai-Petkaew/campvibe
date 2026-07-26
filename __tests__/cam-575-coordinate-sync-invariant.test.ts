import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * CAM-575 — the enforcement invariant, proven BEHAVIORALLY against the real
 * local dev Postgres DB, never by source inspection. A guard test that only
 * greps for the trigger's SQL in the migration file would pass even if the
 * trigger were silently dropped or miswired (the exact "source-inspection
 * guard passed while the real bug persisted" failure mode qa.md warns
 * against) — this suite instead performs real writes through Prisma and
 * reads the ACTUAL row back.
 *
 * Gated on `DATABASE_URL` being a real, reachable Postgres — the CI
 * `quality-gate` job that runs `npm test` has no Postgres service (see
 * `.github/workflows/ci.yml`), so this suite SKIPS there (no DATABASE_URL is
 * set for that job) and RUNS for real on localhost (dev DB) — exactly where
 * this story's own AC must be verified before merge, per CLAUDE.md's
 * Definition of Done. Every created row is a throwaway scratch pair, deleted
 * in `afterAll` regardless of pass/fail, and is never a real seeded camp.
 */
const hasRealDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasRealDb)('CAM-575 (invariant) — the campsite_coords_sync DB trigger keeps CampSite/Location coordinates equal', () => {
  // Imported lazily inside the gated describe so a Postgres-less CI job
  // never even attempts to load @prisma/client's generated engine.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  let userId: string;
  let locationId: string;
  let campSiteId: string;

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();

    const anyUser = await prisma.user.findFirst({ select: { id: true } });
    if (!anyUser) throw new Error('CAM-575 invariant test needs at least one User row in the dev DB to attach a scratch CampSite to');
    userId = anyUser.id;
  });

  afterAll(async () => {
    if (campSiteId) await prisma.campSite.delete({ where: { id: campSiteId } }).catch(() => {});
    if (locationId) await prisma.location.delete({ where: { id: locationId } }).catch(() => {});
    await prisma?.$disconnect();
  });

  it('[Critical, teeth] a CampSite CREATE derives Location.lat/lon to match, overwriting whatever provisional value Location held', async () => {
    const location = await prisma.location.create({
      data: { country: 'Thailand', province: 'CAM-575 test province', lat: 10, lon: 20 }, // provisional value
    });
    locationId = location.id;

    const campSite = await prisma.campSite.create({
      data: {
        nameTh: 'CAM-575 invariant scratch', nameEn: 'CAM-575 invariant scratch',
        nameThSlug: `cam575-invariant-th-${Date.now()}`, nameEnSlug: `cam575-invariant-en-${Date.now()}`,
        campSiteType: 'CAGD', accommodationTypes: 'TENT',
        latitude: 1.111, longitude: 2.222, // the canonical value
        checkInTime: '12:00', checkOutTime: '12:00', bookingMethod: 'ONST',
        locationId: location.id, operatorId: userId,
      },
    });
    campSiteId = campSite.id;

    const syncedLocation = await prisma.location.findUnique({ where: { id: location.id } });
    expect(syncedLocation.lat).toBe(1.111);
    expect(syncedLocation.lon).toBe(2.222);
  });

  it('[Critical, teeth] a CampSite UPDATE that writes ONLY latitude/longitude (no Location write at all) still keeps Location in sync', async () => {
    await prisma.campSite.update({ where: { id: campSiteId }, data: { latitude: 99.5, longitude: 88.5 } });

    const location = await prisma.location.findUnique({ where: { id: locationId } });
    expect(location.lat).toBe(99.5);
    expect(location.lon).toBe(88.5);
  });

  it('[concurrent/ordering] a SECOND, different UPDATE tracks the LATEST value, not just the first sync', async () => {
    await prisma.campSite.update({ where: { id: campSiteId }, data: { latitude: 13.75, longitude: 100.5 } });
    const first = await prisma.location.findUnique({ where: { id: locationId } });
    expect(first.lat).toBe(13.75);

    await prisma.campSite.update({ where: { id: campSiteId }, data: { latitude: 18.79, longitude: 98.98 } });
    const second = await prisma.location.findUnique({ where: { id: locationId } });
    expect(second.lat).toBe(18.79);
    expect(second.lon).toBe(98.98);
  });

  it('[boundary] an UPDATE that writes an unrelated field (not latitude/longitude) does not disturb Location\'s coordinates', async () => {
    const before = await prisma.location.findUnique({ where: { id: locationId } });
    await prisma.campSite.update({ where: { id: campSiteId }, data: { feeInfo: 'no coordinate change here' } });
    const after = await prisma.location.findUnique({ where: { id: locationId } });
    expect(after.lat).toBe(before.lat);
    expect(after.lon).toBe(before.lon);
  });

  it('[normal] the real 4 divergent camps found on 2026-07-26 stay reconciled: 0 rows disagree fleet-wide', async () => {
    const camps = await prisma.campSite.findMany({
      where: { location: { lat: { not: null }, lon: { not: null } } },
      select: { id: true, latitude: true, longitude: true, location: { select: { lat: true, lon: true } } },
    });
    const divergent = camps.filter((c: { latitude: number; longitude: number; location: { lat: number; lon: number } }) => c.latitude !== c.location.lat || c.longitude !== c.location.lon);
    expect(divergent).toHaveLength(0);
  });

  it('[AC] the Chiang Mai province-filter canary still returns 18 (this suite never touches province/adminAreaId)', async () => {
    const count = await prisma.campSite.count({ where: { location: { province: 'Chiang Mai' } } });
    expect(count).toBe(18);
  });
});
