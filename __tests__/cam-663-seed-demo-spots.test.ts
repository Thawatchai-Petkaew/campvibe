/**
 * cam-663-seed-demo-spots.test.ts — CAM-663
 * (platform-hardening — "Camp detail and spot booking")
 *
 * `scripts/seed-demo-spots.mjs` picks one real, published staging camp and
 * curates 9 of its existing live pitches so every branch a spot-detail
 * screen (CAM-664) must handle has a real example. This suite exercises the
 * pure logic + the plan builder against an in-memory fake Prisma client —
 * never a real DB (this script targets staging only; the guard is proven by
 * env-var tests below, not by connecting anywhere).
 *
 * Coverage matrix (qa.md §7): normal · null/empty · boundary · error/
 * validation · concurrent/ordering (idempotent re-run / dry-run determinism).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  LOCAL_HOSTS,
  hostOf,
  checkGuard,
  MIN_LIVE_PITCHES,
  MIN_CAMP_IMAGES,
  MIN_ZONES,
  computeCompletenessScore,
  pickCamp,
  ROLE_ORDER,
  DEMO_SPOT_COUNT,
  CAPACITIES,
  priceUnitForIndex,
  capacityForIndex,
  assignSpotsToRoles,
  neededPhotoCount,
  PANORAMA_URLS,
  PHOTO_URL_POOL,
  LONG_NAME,
  DEMO_BOOKING_CHECK_IN,
  DEMO_BOOKING_CHECK_OUT,
  DEMO_BLOCKED_START,
  DEMO_BLOCKED_END,
  buildPlan,
  summarizePlan,
  applyPlan,
  undoPlan,
  parseArgs,
} from '../scripts/seed-demo-spots.mjs';

// ===========================================================================
// Fake Prisma — in-memory, tailored to exactly the calls this script makes.
// ===========================================================================

type FakeCamp = {
  id: string; nameTh: string; nameThSlug: string; useSpotView: boolean;
  isPublished: boolean; deletedAt: null;
  description?: string | null; logo?: string | null; videoUrl?: string | null;
  phone?: string | null; lineId?: string | null; facebookUrl?: string | null;
  address?: string | null; directions?: string | null; feeInfo?: string | null;
  toiletInfo?: string | null; groundType?: string | null; cancellationPolicy?: string | null;
  tags?: string | null; partner?: string | null; nationalPark?: string | null;
  ownershipType?: string | null; minimumAge?: number | null; maxGuestsPerDay?: number | null;
  maxTentsPerDay?: number | null; priceLow?: number | null; priceHigh?: number | null;
  avgRating?: number | null; reviewCount?: number;
};
type FakeZone = { id: string; campSiteId: string; name: string; sortOrder: number; deletedAt: null };
type FakeImage = { id: string; spotId: string; url: string; kind: 'PHOTO' | 'PANORAMA'; alt: null };
type FakeBooking = { id: string; spotId: string; campSiteId: string; userId: string; checkInDate: Date; checkOutDate: Date; guests: number; totalPrice: number; currency: string; status: string; deletedAt: null };
type FakeBlockedDate = { id: string; spotId: string; campSiteId: string; startDate: Date; endDate: Date; reason: string; deletedAt: null };
type FakeSpot = { id: string; campSiteId: string; name: string; priceUnit: string; maxCampers: number | null; pricePerNight: number; zoneId: string | null; deletedAt: null };
type FakeUser = { id: string; role: string; deletedAt: null };

function makeFakePrisma(fixture: {
  camps: FakeCamp[]; zones: FakeZone[]; spots: FakeSpot[]; images: FakeImage[];
  bookings: FakeBooking[]; blockedDates: FakeBlockedDate[]; users: FakeUser[]; campImageCounts: Record<string, number>;
}) {
  const camps = fixture.camps.map((c) => ({ ...c }));
  const zones = fixture.zones.map((z) => ({ ...z }));
  const spots = fixture.spots.map((s) => ({ ...s }));
  const images = fixture.images.map((i) => ({ ...i }));
  const bookings = fixture.bookings.map((b) => ({ ...b }));
  const blockedDates = fixture.blockedDates.map((b) => ({ ...b }));
  const users = fixture.users.map((u) => ({ ...u }));
  let idCounter = 0;
  const nextId = (prefix: string) => `${prefix}-${(idCounter += 1)}`;

  const campSelectShape = (c: FakeCamp) => ({ ...c });

  return {
    _store: { camps, zones, spots, images, bookings, blockedDates, users },
    campSite: {
      findMany: async ({ where }: any) => {
        return camps
          .filter((c) => (where?.isPublished !== undefined ? c.isPublished === where.isPublished : true) && c.deletedAt === where?.deletedAt)
          .map((c) => ({
            ...campSelectShape(c),
            _count: {
              spots: spots.filter((s) => s.campSiteId === c.id && s.deletedAt === null).length,
              images: fixture.campImageCounts[c.id] ?? 0,
              zones: zones.filter((z) => z.campSiteId === c.id && z.deletedAt === null).length,
            },
          }));
      },
      findFirst: async ({ where }: any) => {
        const c = camps.find((x) => x.nameThSlug === where.nameThSlug && x.deletedAt === where.deletedAt);
        return c ? campSelectShape(c) : null;
      },
      update: async ({ where, data }: any) => {
        const c = camps.find((x) => x.id === where.id);
        if (!c) throw new Error(`no camp ${where.id}`);
        Object.assign(c, data);
        return { ...c };
      },
    },
    zone: {
      findMany: async ({ where }: any) => {
        return zones
          .filter((z) => z.campSiteId === where.campSiteId && z.deletedAt === where.deletedAt)
          .sort((a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : 1))
          .map((z) => ({ id: z.id, name: z.name }));
      },
    },
    spot: {
      findMany: async ({ where }: any) => {
        return spots
          .filter((s) => s.campSiteId === where.campSiteId && s.deletedAt === where.deletedAt)
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
          .map((s) => ({
            id: s.id, name: s.name, priceUnit: s.priceUnit, maxCampers: s.maxCampers,
            pricePerNight: s.pricePerNight, zoneId: s.zoneId,
            images: images.filter((i) => i.spotId === s.id).map((i) => ({ id: i.id, kind: i.kind, url: i.url })),
            bookings: bookings.filter((b) => b.spotId === s.id && b.deletedAt === null && b.status !== 'CANCELLED').map((b) => ({ id: b.id })),
            blockedDates: blockedDates.filter((b) => b.spotId === s.id && b.deletedAt === null).map((b) => ({ id: b.id })),
          }));
      },
      update: async ({ where, data }: any) => {
        const s = spots.find((x) => x.id === where.id);
        if (!s) throw new Error(`no spot ${where.id}`);
        Object.assign(s, data);
        return { ...s };
      },
    },
    image: {
      create: async ({ data }: any) => {
        const row: FakeImage = { id: nextId('img'), spotId: data.spotId, url: data.url, kind: data.kind, alt: data.alt ?? null };
        images.push(row);
        return { ...row };
      },
      deleteMany: async ({ where }: any) => {
        const before = images.length;
        const keep = images.filter((i) => !(where.spotId.in.includes(i.spotId) && where.url.in.includes(i.url)));
        const removed = before - keep.length;
        images.length = 0;
        images.push(...keep);
        return { count: removed };
      },
    },
    blockedDate: {
      create: async ({ data }: any) => {
        const row: FakeBlockedDate = { id: nextId('blk'), spotId: data.spotId, campSiteId: data.campSiteId, startDate: data.startDate, endDate: data.endDate, reason: data.reason, deletedAt: null };
        blockedDates.push(row);
        return { ...row };
      },
      deleteMany: async ({ where }: any) => {
        const before = blockedDates.length;
        const keep = blockedDates.filter(
          (b) =>
            !(
              where.spotId.in.includes(b.spotId) &&
              b.startDate.getTime() === where.startDate.getTime() &&
              b.endDate.getTime() === where.endDate.getTime()
            )
        );
        const removed = before - keep.length;
        blockedDates.length = 0;
        blockedDates.push(...keep);
        return { count: removed };
      },
    },
    booking: {
      create: async ({ data }: any) => {
        const row: FakeBooking = {
          id: nextId('bkg'), spotId: data.spotId, campSiteId: data.campSiteId, userId: data.userId,
          checkInDate: data.checkInDate, checkOutDate: data.checkOutDate, guests: data.guests,
          totalPrice: data.totalPrice, currency: data.currency, status: data.status, deletedAt: null,
        };
        bookings.push(row);
        return { ...row };
      },
      deleteMany: async ({ where }: any) => {
        const before = bookings.length;
        const keep = bookings.filter(
          (b) =>
            !(
              where.spotId.in.includes(b.spotId) &&
              b.checkInDate.getTime() === where.checkInDate.getTime() &&
              b.checkOutDate.getTime() === where.checkOutDate.getTime()
            )
        );
        const removed = before - keep.length;
        bookings.length = 0;
        bookings.push(...keep);
        return { count: removed };
      },
    },
    user: {
      findFirst: async ({ where }: any) => {
        const u = users
          .filter((x) => x.role === where.role && x.deletedAt === where.deletedAt)
          .sort((a, b) => (a.id < b.id ? -1 : 1))[0];
        return u ? { id: u.id } : null;
      },
    },
  };
}

/** A fresh camp with `spotCount` live spots, `zoneCount` live zones, all images/bookings/blockedDates empty. */
function makeFreshFixture({ spotCount = 12, zoneCount = 3, campImages = 25 } = {}) {
  const campId = 'camp-1';
  const camps: FakeCamp[] = [
    {
      id: campId, nameTh: 'แคมป์สาธิต', nameThSlug: 'demo-camp', useSpotView: false,
      isPublished: true, deletedAt: null,
      description: 'สถานที่กางเต็นท์ริมน้ำ', logo: 'https://example.com/logo.png', videoUrl: null,
      phone: '0812345678', lineId: '@democamp', facebookUrl: 'https://fb.com/democamp',
      address: '123 หมู่ 4', directions: 'เลี้ยวซ้ายที่ปากทาง', feeInfo: '50 บาทต่อคัน',
      toiletInfo: 'ห้องน้ำรวม', groundType: '{"GRASS":10}', cancellationPolicy: 'FLEXIBLE',
      tags: 'ริมน้ำ,ครอบครัว', partner: null, nationalPark: null, ownershipType: 'PRIVATE',
      minimumAge: 5, maxGuestsPerDay: 100, maxTentsPerDay: 30, priceLow: 300, priceHigh: 900,
      avgRating: 4.5, reviewCount: 12,
    },
  ];
  const zones: FakeZone[] = Array.from({ length: zoneCount }, (_, i) => ({
    id: `zone-${i + 1}`, campSiteId: campId, name: `โซน ${i + 1}`, sortOrder: i, deletedAt: null,
  }));
  const spots: FakeSpot[] = Array.from({ length: spotCount }, (_, i) => ({
    id: `spot-${String(i + 1).padStart(2, '0')}`, campSiteId: campId, name: `จุดกางเต็นท์ ${i + 1}`,
    priceUnit: 'PER_SITE', maxCampers: 4, pricePerNight: 500 + i * 10, zoneId: zones[0].id, deletedAt: null,
  }));
  return {
    camps, zones, spots, images: [] as FakeImage[], bookings: [] as FakeBooking[], blockedDates: [] as FakeBlockedDate[],
    users: [{ id: 'user-camper-1', role: 'CAMPER', deletedAt: null }] as FakeUser[],
    campImageCounts: { [campId]: campImages } as Record<string, number>,
  };
}

// ===========================================================================
// (a) guard — checkGuard / hostOf
// ===========================================================================
describe('CAM-663 (a) — checkGuard: refuses localhost, requires DATABASE_URL', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('[error/validation] refuses when DATABASE_URL is unset', () => {
    vi.stubEnv('DATABASE_URL', '');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('DATABASE_URL is not set');
  });

  it('[Critical, teeth] refuses when DATABASE_URL resolves to localhost (mirror of db-sync-from-staging)', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pw@localhost:5432/campvibe_dev');
    const result = checkGuard();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('STAGING only');
  });

  it('[boundary] refuses for every LOCAL_HOSTS entry (127.0.0.1, ::1)', () => {
    for (const host of LOCAL_HOSTS) {
      vi.stubEnv('DATABASE_URL', `postgresql://user:pw@${host === '::1' ? '[::1]' : host}:5432/db`);
      expect(checkGuard().ok).toBe(false);
    }
  });

  it('[normal] allows a real staging-shaped host', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pw@db.staging.example.com:5432/campvibe?api_key=secret');
    const result = checkGuard();
    expect(result.ok).toBe(true);
  });

  it('[null/empty] hostOf returns null for an unparseable URL', () => {
    expect(hostOf('not-a-url')).toBeNull();
  });
});

// ===========================================================================
// (b) computeCompletenessScore — pure
// ===========================================================================
describe('CAM-663 (b) — computeCompletenessScore', () => {
  it('[normal] scores every filled field', () => {
    const fixture = makeFreshFixture();
    const score = computeCompletenessScore(fixture.camps[0]);
    expect(score).toBeGreaterThan(0);
  });

  it('[null/empty] an all-null camp scores 0', () => {
    const empty = { reviewCount: 0 } as Record<string, unknown>;
    expect(computeCompletenessScore(empty)).toBe(0);
  });

  it('[boundary] reviewCount only counts when > 0', () => {
    expect(computeCompletenessScore({ reviewCount: 0 })).toBe(0);
    expect(computeCompletenessScore({ reviewCount: 1 })).toBe(1);
  });
});

// ===========================================================================
// (c) pickCamp — selection rule + override
// ===========================================================================
describe('CAM-663 (c) — pickCamp: rule-based selection + --camp override', () => {
  it('[normal] picks the only eligible published camp', async () => {
    const fixture = makeFreshFixture();
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, {});
    expect(camp.nameThSlug).toBe('demo-camp');
    expect(camp.overridden).toBe(false);
  });

  it('[normal, teeth] picks the HIGHER completeness score between two eligible camps', async () => {
    const fixture = makeFreshFixture();
    const sparseCamp: FakeCamp = {
      ...fixture.camps[0], id: 'camp-2', nameThSlug: 'sparse-camp', description: null, logo: null,
      videoUrl: null, phone: null, lineId: null, facebookUrl: null, address: null, directions: null,
      feeInfo: null, toiletInfo: null, groundType: null, cancellationPolicy: null, tags: null,
      partner: null, nationalPark: null, ownershipType: null, minimumAge: null, maxGuestsPerDay: null,
      maxTentsPerDay: null, priceLow: null, priceHigh: null, avgRating: null, reviewCount: 0,
    };
    fixture.camps.push(sparseCamp);
    fixture.zones.push(...Array.from({ length: 3 }, (_, i) => ({ id: `z2-${i}`, campSiteId: 'camp-2', name: `z${i}`, sortOrder: i, deletedAt: null })));
    fixture.spots.push(...Array.from({ length: 10 }, (_, i) => ({ id: `s2-${i}`, campSiteId: 'camp-2', name: `s${i}`, priceUnit: 'PER_SITE', maxCampers: 4, pricePerNight: 300, zoneId: `z2-0`, deletedAt: null })));
    fixture.campImageCounts['camp-2'] = 25;

    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, {});
    expect(camp.nameThSlug).toBe('demo-camp'); // higher completeness wins
  });

  it('[error/validation, teeth] throws when no camp meets the hard minimums', async () => {
    const fixture = makeFreshFixture({ spotCount: 5 }); // below MIN_LIVE_PITCHES
    const prisma = makeFakePrisma(fixture);
    await expect(pickCamp(prisma as any, {})).rejects.toThrow(/no camp on this target/);
  });

  it('[boundary] exactly MIN_LIVE_PITCHES / MIN_ZONES / MIN_CAMP_IMAGES qualifies', async () => {
    const fixture = makeFreshFixture({ spotCount: MIN_LIVE_PITCHES, zoneCount: MIN_ZONES, campImages: MIN_CAMP_IMAGES });
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, {});
    expect(camp.nameThSlug).toBe('demo-camp');
  });

  it('[normal] --camp override bypasses the rule entirely', async () => {
    const fixture = makeFreshFixture({ spotCount: 5 }); // would fail the rule
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, { overrideSlug: 'demo-camp' });
    expect(camp.overridden).toBe(true);
  });

  it('[error/validation] --camp override with an unknown slug throws', async () => {
    const fixture = makeFreshFixture();
    const prisma = makeFakePrisma(fixture);
    await expect(pickCamp(prisma as any, { overrideSlug: 'does-not-exist' })).rejects.toThrow(/not found/);
  });
});

// ===========================================================================
// (d) pure role-assignment logic
// ===========================================================================
describe('CAM-663 (d) — role assignment: deterministic, covers every variety branch', () => {
  it('[boundary] ROLE_ORDER has exactly DEMO_SPOT_COUNT (9) roles, 4 buckets', () => {
    expect(ROLE_ORDER).toHaveLength(9);
    expect(DEMO_SPOT_COUNT).toBe(9);
  });

  it('[normal] priceUnitForIndex alternates PER_SITE / PER_PERSON', () => {
    expect(priceUnitForIndex(0)).toBe('PER_SITE');
    expect(priceUnitForIndex(1)).toBe('PER_PERSON');
  });

  it('[boundary] capacityForIndex cycles through all 3 CAPACITIES (2/4/8)', () => {
    const seen = new Set(Array.from({ length: 9 }, (_, i) => capacityForIndex(i)));
    expect(seen).toEqual(new Set(CAPACITIES));
  });

  it('[error/validation, teeth] assignSpotsToRoles throws when fewer than 9 live spots', () => {
    const spots = Array.from({ length: 8 }, (_, i) => ({ id: `s${i}` }));
    expect(() => assignSpotsToRoles(spots as any)).toThrow(/at least 9/);
  });

  it('[normal] neededPhotoCount: multi-photo targets 3, one-photo targets 1, no-image targets 0', () => {
    expect(neededPhotoCount('multi-photo-1', 0)).toBe(3);
    expect(neededPhotoCount('one-photo-1', 0)).toBe(1);
    expect(neededPhotoCount('no-image-1', 0)).toBe(0);
  });

  it('[boundary] neededPhotoCount tops up, never goes negative when already satisfied', () => {
    expect(neededPhotoCount('multi-photo-1', 2)).toBe(1);
    expect(neededPhotoCount('multi-photo-1', 5)).toBe(0);
    expect(neededPhotoCount('one-photo-1', 3)).toBe(0);
  });

  it('[Critical] no demo URL ever points at /uploads (public/uploads* 404s on staging)', () => {
    for (const url of [...PANORAMA_URLS, ...PHOTO_URL_POOL]) {
      expect(url).not.toContain('uploads');
      expect(url).toMatch(/^https:\/\/images\.unsplash\.com\//);
    }
  });

  it('[boundary] the panorama crop is ~4.6:1 (2400x520)', () => {
    for (const url of PANORAMA_URLS) {
      expect(url).toContain('w=2400');
      expect(url).toContain('h=520');
    }
  });

  it('[normal] LONG_NAME is long enough to exercise truncation', () => {
    expect(LONG_NAME.length).toBeGreaterThan(80);
  });
});

// ===========================================================================
// (e) buildPlan + summarizePlan — the full variety matrix
// ===========================================================================
describe('CAM-663 (e) — buildPlan: produces every branch of the variety list', () => {
  it('[normal, teeth] a fresh camp produces the full count table', async () => {
    const fixture = makeFreshFixture();
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, {});
    const plan = await buildPlan(prisma as any, camp);
    const summary = summarizePlan(plan);

    expect(summary['panorama (2)']).toBe(2);
    expect(summary['several photos, 3+ each (3)']).toBe(3);
    expect(summary['exactly one photo (2)']).toBe(2);
    expect(summary['no image at all (2)']).toBe(2);
    expect(summary['priceUnit = PER_SITE']).toBe(5);
    expect(summary['priceUnit = PER_PERSON']).toBe(4);
    expect(summary['priced 0 (free)']).toBe(1);
    expect(summary['distinct capacities (want 2/4/8 = 3)']).toBe(3);
    expect(summary['distinct zones (want >=3)']).toBeGreaterThanOrEqual(3);
    expect(summary['host BlockedDate on spotId']).toBe(1);
    expect(summary['existing non-cancelled Booking on spotId']).toBe(1);
    expect(summary['very long name']).toBe(1);
  });

  it('[concurrent/ordering, teeth] dry-run twice (no writes in between) prints an IDENTICAL plan', async () => {
    const fixture = makeFreshFixture();
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, {});

    const planA = await buildPlan(prisma as any, camp);
    const planB = await buildPlan(prisma as any, camp);

    expect(summarizePlan(planA)).toEqual(summarizePlan(planB));
    expect(planA.rows.map((r) => ({ spotId: r.spotId, role: r.role }))).toEqual(
      planB.rows.map((r) => ({ spotId: r.spotId, role: r.role }))
    );
  });

  it('[error/validation] throws when the camp has fewer than MIN_ZONES live zones', async () => {
    const fixture = makeFreshFixture({ zoneCount: 2 });
    const prisma = makeFakePrisma(fixture);
    const camp = { id: 'camp-1', nameThSlug: 'demo-camp', useSpotView: false, overridden: false, score: 0 };
    await expect(buildPlan(prisma as any, camp)).rejects.toThrow(/live zones/);
  });

  it('[null/empty, teeth] a pitch that already has a live non-cancelled Booking is NOT re-booked', async () => {
    const fixture = makeFreshFixture();
    // spot-07 is the "one-photo-2" role (index 6, 0-based) — pre-seed it with a real booking.
    fixture.bookings.push({
      id: 'existing-bkg', spotId: 'spot-07', campSiteId: 'camp-1', userId: 'user-camper-1',
      checkInDate: new Date('2026-12-01'), checkOutDate: new Date('2026-12-03'),
      guests: 2, totalPrice: 1000, currency: 'THB', status: 'CONFIRMED', deletedAt: null,
    });
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, {});
    const plan = await buildPlan(prisma as any, camp);
    const row = plan.rows.find((r: any) => r.role === 'one-photo-2')!;
    expect(row.needsBooking).toBe(false);
    expect(row.alreadyHasNonCancelledBooking).toBe(true);
    expect(summarizePlan(plan)['existing non-cancelled Booking on spotId']).toBe(1);
  });

  it('[null/empty] a CANCELLED booking on the role spot does NOT satisfy the bucket — a new one is still planned', async () => {
    const fixture = makeFreshFixture();
    fixture.bookings.push({
      id: 'cancelled-bkg', spotId: 'spot-07', campSiteId: 'camp-1', userId: 'user-camper-1',
      checkInDate: new Date('2026-12-01'), checkOutDate: new Date('2026-12-03'),
      guests: 2, totalPrice: 1000, currency: 'THB', status: 'CANCELLED', deletedAt: null,
    });
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, {});
    const plan = await buildPlan(prisma as any, camp);
    const row = plan.rows.find((r: any) => r.role === 'one-photo-2')!;
    expect(row.needsBooking).toBe(true);
  });
});

// ===========================================================================
// (f) applyPlan — writes exactly the planned rows, idempotent on a 2nd apply
// ===========================================================================
describe('CAM-663 (f) — applyPlan: writes correctly, idempotent on re-apply', () => {
  it('[normal, teeth] creates the expected image/blockedDate/booking counts + sets useSpotView', async () => {
    const fixture = makeFreshFixture();
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, {});
    const plan = await buildPlan(prisma as any, camp);

    const created = await applyPlan(prisma as any, plan);

    // 2 panorama + 3*3 multi-photo + 2*1 one-photo = 2 + 9 + 2 = 13 images
    expect(created.images).toBe(13);
    expect(created.blockedDates).toBe(1);
    expect(created.bookings).toBe(1);

    const updatedCamp = prisma._store.camps.find((c) => c.id === camp.id)!;
    expect(updatedCamp.useSpotView).toBe(true);

    const freeSpot = prisma._store.spots.find((s) => s.id === 'spot-09')!; // no-image-2 role (index 8)
    expect(Number(freeSpot.pricePerNight)).toBe(0);
    const longNameSpot = prisma._store.spots.find((s) => s.id === 'spot-08')!; // no-image-1 role (index 7)
    expect(longNameSpot.name).toBe(LONG_NAME);
  });

  it('[concurrent/ordering, teeth] a SECOND apply on the same state creates ZERO additional rows', async () => {
    const fixture = makeFreshFixture();
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, {});

    const plan1 = await buildPlan(prisma as any, camp);
    const first = await applyPlan(prisma as any, plan1);
    expect(first.images).toBe(13);

    const camp2 = await pickCamp(prisma as any, {});
    const plan2 = await buildPlan(prisma as any, camp2);
    const second = await applyPlan(prisma as any, plan2);

    expect(second.images).toBe(0);
    expect(second.blockedDates).toBe(0);
    expect(second.bookings).toBe(0);
  });

  it('[error/validation, Critical] throws when no CAMPER user exists to attach the demo booking to', async () => {
    const fixture = makeFreshFixture();
    fixture.users = [];
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, {});
    const plan = await buildPlan(prisma as any, camp);
    await expect(applyPlan(prisma as any, plan)).rejects.toThrow(/no CAMPER user/);
  });
});

// ===========================================================================
// (g) undoPlan — removes exactly the tagged rows, nothing else
// ===========================================================================
describe('CAM-663 (g) — undoPlan: removes exactly the rows this script creates', () => {
  it('[normal, teeth] removes the created images/booking/blockedDate and resets useSpotView', async () => {
    const fixture = makeFreshFixture();
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, {});
    const plan = await buildPlan(prisma as any, camp);
    await applyPlan(prisma as any, plan);

    const removed = await undoPlan(prisma as any, plan);
    expect(removed.images).toBe(13);
    expect(removed.bookings).toBe(1);
    expect(removed.blockedDates).toBe(1);

    expect(prisma._store.images.filter((i) => plan.rows.some((r: any) => r.spotId === i.spotId))).toHaveLength(0);
    expect(prisma._store.bookings).toHaveLength(0);
    expect(prisma._store.blockedDates).toHaveLength(0);
    expect(prisma._store.camps.find((c) => c.id === camp.id)!.useSpotView).toBe(false);
  });

  it('[Critical, teeth] never touches a real image/booking that is NOT one of this scripts own URLs/dates', async () => {
    const fixture = makeFreshFixture();
    // A real, pre-existing photo on a DIFFERENT, unrelated URL + a real booking on unrelated dates.
    fixture.images.push({ id: 'real-img', spotId: 'spot-01', url: 'https://images.unsplash.com/photo-REAL-USER-UPLOAD?w=1200', kind: 'PHOTO', alt: null });
    fixture.bookings.push({
      id: 'real-bkg', spotId: 'spot-01', campSiteId: 'camp-1', userId: 'user-camper-1',
      checkInDate: new Date('2026-08-01'), checkOutDate: new Date('2026-08-03'),
      guests: 2, totalPrice: 1000, currency: 'THB', status: 'CONFIRMED', deletedAt: null,
    });
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, {});
    const plan = await buildPlan(prisma as any, camp);
    await applyPlan(prisma as any, plan);

    await undoPlan(prisma as any, plan);

    expect(prisma._store.images.some((i) => i.id === 'real-img')).toBe(true);
    expect(prisma._store.bookings.some((b) => b.id === 'real-bkg')).toBe(true);
  });

  it('[boundary] the demo booking/blockedDate identity keys are the fixed dates exported by the module', () => {
    expect(DEMO_BOOKING_CHECK_IN.getTime()).toBeLessThan(DEMO_BOOKING_CHECK_OUT.getTime());
    expect(DEMO_BLOCKED_START.getTime()).toBeLessThan(DEMO_BLOCKED_END.getTime());
  });
});

// ===========================================================================
// (h) CLI parsing
// ===========================================================================
describe('CAM-663 (h) — parseArgs: default dry-run, explicit --apply/--undo, --camp override', () => {
  it('[normal] no flags = dry run by default', () => {
    expect(parseArgs([])).toMatchObject({ apply: false, undo: false, dryRun: true, campSlug: undefined });
  });

  it('[normal] --dry-run explicitly is still dry run', () => {
    expect(parseArgs(['--dry-run'])).toMatchObject({ dryRun: true, apply: false });
  });

  it('[normal] --apply switches to write mode', () => {
    expect(parseArgs(['--apply'])).toMatchObject({ apply: true, dryRun: false, undo: false });
  });

  it('[normal] --undo switches to undo mode', () => {
    expect(parseArgs(['--undo'])).toMatchObject({ undo: true, dryRun: false });
  });

  it('[normal] --camp <slug> is captured alongside any mode', () => {
    expect(parseArgs(['--apply', '--camp', 'my-camp-slug'])).toMatchObject({ apply: true, campSlug: 'my-camp-slug' });
  });

  it('[null/empty] --camp with no following value yields undefined, not a crash', () => {
    expect(parseArgs(['--camp'])).toMatchObject({ campSlug: undefined });
  });
});
