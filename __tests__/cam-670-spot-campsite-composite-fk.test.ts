/**
 * cam-670-spot-campsite-composite-fk.test.ts — CAM-670 (real-DB proof)
 *
 * CAM-668 closed this hole at the APPLICATION layer (POST /api/bookings
 * rejects a spotId that doesn't belong to campSiteId, inside its Serializable
 * transaction). This story adds the DATABASE-level guarantee a future code
 * path cannot bypass (ADR-012 §4): a composite FK —
 * `Booking_spotId_campSiteId_fkey` — ties Booking(spotId, campSiteId) to
 * Spot(id, campSiteId), so `spotId` can only ever name a pitch on the SAME
 * camp as the booking. This FK is ADDITIVE (Booking's original
 * spotId->Spot.id FK is untouched) and uses Postgres 15+'s column-scoped
 * `ON DELETE SET NULL ("spotId")` so deleting a referenced Spot nulls ONLY
 * spotId, never the required campSiteId — preserving the existing delete
 * behaviour `app/api/scrape-seed` and `app/api/bulk-seed` rely on
 * (`prisma.spot.deleteMany()`, verified by this file's 4th test).
 *
 * This file proves the CONSTRAINT ITSELF, against a REAL Postgres — `prisma`
 * is NEVER mocked here (same pattern as
 * __tests__/cam-617-location-exclusivity-real-db.test.ts /
 * __tests__/cam-619-coordinate-trigger-guard.test.ts). It writes directly via
 * Prisma (not through the API route — CAM-668's route-level test already
 * covers that layer); the point here is that the DB refuses the row even if
 * some future path skips the application check entirely.
 *
 * Gated on `DATABASE_URL` being a real, reachable Postgres that already
 * carries migration 20260729155918_cam670_spot_campsite_composite_fk: SKIPS
 * when unset (CI has no Postgres service for `npm test`; this repo's ambient
 * test shell leaves DATABASE_URL unset by default) — RUNS for real when
 * pointed at such a database. Every created row is a throwaway scratch row,
 * deleted in `afterAll` regardless of pass/fail.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const hasRealDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasRealDb)(
  "CAM-670 (real DB) — Booking.spotId must share Booking's own campSiteId (composite FK, DB-enforced)",
  () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- real PrismaClient, dynamically imported (never mocked in this file)
    let prisma: any;
    let userId: string;
    let locationId: string;
    let campAId: string;
    let campBId: string;
    let spotOnCampAId: string; // lives on campA
    let spotOnCampBId: string; // lives on campB — the "foreign" pitch for campA's bookings
    let spotToDeleteId: string; // a THIRD spot on campA, consumed by the delete test itself
    const bookingIds: string[] = [];

    beforeAll(async () => {
      const { PrismaClient } = await import('@prisma/client');
      prisma = new PrismaClient();

      const user = await prisma.user.create({
        data: { email: `cam670-${Date.now()}@test.local`, role: 'CAMPER' },
      });
      userId = user.id;

      const location = await prisma.location.create({
        data: { country: 'Thailand', province: 'CAM-670 test province', lat: 10, lon: 20 },
      });
      locationId = location.id;

      const campA = await prisma.campSite.create({
        data: {
          nameTh: 'CAM-670 camp A', nameEn: 'CAM-670 camp A',
          nameThSlug: `cam670-a-th-${Date.now()}`, nameEnSlug: `cam670-a-en-${Date.now()}`,
          campSiteType: 'CAGD', accommodationTypes: 'TENT',
          latitude: 13.75, longitude: 100.5,
          checkInTime: '12:00', checkOutTime: '12:00', bookingMethod: 'ONST',
          locationId, operatorId: userId,
        },
      });
      campAId = campA.id;

      const campB = await prisma.campSite.create({
        data: {
          nameTh: 'CAM-670 camp B', nameEn: 'CAM-670 camp B',
          nameThSlug: `cam670-b-th-${Date.now()}`, nameEnSlug: `cam670-b-en-${Date.now()}`,
          campSiteType: 'CAGD', accommodationTypes: 'TENT',
          latitude: 14.0, longitude: 101.0,
          checkInTime: '12:00', checkOutTime: '12:00', bookingMethod: 'ONST',
          locationId, operatorId: userId,
        },
      });
      campBId = campB.id;

      const spotA = await prisma.spot.create({
        data: { name: 'CAM-670 spot A', pricePerNight: 500, campSiteId: campAId },
      });
      spotOnCampAId = spotA.id;

      const spotB = await prisma.spot.create({
        data: { name: 'CAM-670 spot B', pricePerNight: 500, campSiteId: campBId },
      });
      spotOnCampBId = spotB.id;

      const spotToDelete = await prisma.spot.create({
        data: { name: 'CAM-670 spot to delete', pricePerNight: 500, campSiteId: campAId },
      });
      spotToDeleteId = spotToDelete.id;
    });

    afterAll(async () => {
      for (const id of bookingIds) {
        await prisma.booking.delete({ where: { id } }).catch(() => {});
      }
      if (spotOnCampAId) await prisma.spot.delete({ where: { id: spotOnCampAId } }).catch(() => {});
      if (spotOnCampBId) await prisma.spot.delete({ where: { id: spotOnCampBId } }).catch(() => {});
      if (campAId) await prisma.campSite.delete({ where: { id: campAId } }).catch(() => {});
      if (campBId) await prisma.campSite.delete({ where: { id: campBId } }).catch(() => {});
      if (locationId) await prisma.location.delete({ where: { id: locationId } }).catch(() => {});
      if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      await prisma?.$disconnect();
    });

    it('[Critical, teeth] a booking whose spotId belongs to ANOTHER camp is rejected by the DATABASE itself', async () => {
      let caught: unknown;
      try {
        await prisma.booking.create({
          data: {
            checkInDate: new Date('2027-03-01'),
            checkOutDate: new Date('2027-03-03'),
            totalPrice: 1000,
            userId,
            campSiteId: campAId, // this booking claims camp A...
            spotId: spotOnCampBId, // ...but this pitch belongs to camp B
          },
        });
      } catch (err) {
        caught = err;
      }

      // Prisma's known-request error for a violated foreign-key constraint —
      // this is a REAL DB rejection (P2003), not an application-layer 400.
      expect(caught).toBeDefined();
      expect((caught as { code?: string }).code).toBe('P2003');

      // No row was written for the rejected attempt.
      const count = await prisma.booking.count({
        where: { campSiteId: campAId, spotId: spotOnCampBId },
      });
      expect(count).toBe(0);
    });

    it('[normal, control] spotId = NULL still inserts, unchanged — MATCH SIMPLE skips the check when any FK column is NULL', async () => {
      const booking = await prisma.booking.create({
        data: {
          checkInDate: new Date('2027-03-01'),
          checkOutDate: new Date('2027-03-03'),
          totalPrice: 1000,
          userId,
          campSiteId: campAId,
          spotId: null,
        },
      });
      bookingIds.push(booking.id);

      expect(booking.spotId).toBeNull();
      expect(booking.campSiteId).toBe(campAId);
    });

    it('[normal] a valid camp+pitch pair (spotId belongs to the SAME campSiteId) inserts successfully', async () => {
      const booking = await prisma.booking.create({
        data: {
          checkInDate: new Date('2027-03-01'),
          checkOutDate: new Date('2027-03-03'),
          totalPrice: 1000,
          userId,
          campSiteId: campAId,
          spotId: spotOnCampAId,
        },
      });
      bookingIds.push(booking.id);

      expect(booking.spotId).toBe(spotOnCampAId);
      expect(booking.campSiteId).toBe(campAId);
    });

    it('[normal, control] deleting a Spot that a Booking references succeeds and leaves the booking with spotId = NULL', async () => {
      // The exact behaviour app/api/scrape-seed and app/api/bulk-seed rely on
      // (`prisma.spot.deleteMany()` wiping every Spot) — this composite FK's
      // column-scoped `ON DELETE SET NULL ("spotId")` must preserve it.
      const booking = await prisma.booking.create({
        data: {
          checkInDate: new Date('2027-03-01'),
          checkOutDate: new Date('2027-03-03'),
          totalPrice: 1000,
          userId,
          campSiteId: campAId,
          spotId: spotToDeleteId,
        },
      });
      bookingIds.push(booking.id);

      await prisma.spot.delete({ where: { id: spotToDeleteId } });

      const reloaded = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(reloaded.spotId).toBeNull();
      expect(reloaded.campSiteId).toBe(campAId); // untouched — never nulled alongside spotId
    });
  }
);
