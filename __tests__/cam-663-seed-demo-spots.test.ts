/**
 * cam-663-seed-demo-spots.test.ts — CAM-663
 * (platform-hardening — "Camp detail and spot booking")
 *
 * `scripts/seed-demo-spots.mjs` picks one real, published staging camp and
 * CREATES 9 brand-new demo pitches on it (never mutates an existing pitch)
 * so every branch a spot-detail screen (CAM-664) must handle has a real
 * example. This suite exercises the pure logic + the plan builder against an
 * in-memory fake Prisma client — never a real DB (this script targets
 * staging only; the guard is proven by env-var tests below, not by
 * connecting anywhere).
 *
 * Coverage matrix (qa.md §7): normal · null/empty · boundary · error/
 * validation · concurrent/ordering (idempotent re-run / dry-run determinism
 * / apply-undo round trip).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { getEffectiveCapacity } from '@/lib/campsite-availability';
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
  neededPhotoCount,
  DEMO_NAME_PREFIX,
  nameForRole,
  priceForRole,
  LONG_NAME,
  PANORAMA_URLS,
  PHOTO_URL_POOL,
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
// Fake Prisma — in-memory, tailored to exactly the calls this script (and
// the REAL getEffectiveCapacity/calculateSpotCapacity it is round-trip-
// tested against below) make.
// ===========================================================================

type FakeCamp = {
  id: string; nameTh: string; nameThSlug: string; useSpotView: boolean;
  isPublished: boolean; deletedAt: null;
  maxGuestsPerDay: number | null; maxTentsPerDay: number | null;
  description?: string | null; logo?: string | null; videoUrl?: string | null;
  phone?: string | null; lineId?: string | null; facebookUrl?: string | null;
  address?: string | null; directions?: string | null; feeInfo?: string | null;
  toiletInfo?: string | null; groundType?: string | null; cancellationPolicy?: string | null;
  tags?: string | null; partner?: string | null; nationalPark?: string | null;
  ownershipType?: string | null; minimumAge?: number | null;
  priceLow?: number | null; priceHigh?: number | null;
  avgRating?: number | null; reviewCount?: number;
};
type FakeZone = { id: string; campSiteId: string; name: string; sortOrder: number; deletedAt: null };
type FakeImage = { id: string; spotId: string; url: string; kind: 'PHOTO' | 'PANORAMA'; alt: null };
type FakeBooking = { id: string; spotId: string; campSiteId: string; userId: string; checkInDate: Date; checkOutDate: Date; guests: number; totalPrice: number; currency: string; status: string; deletedAt: null };
type FakeBlockedDate = { id: string; spotId: string; campSiteId: string; startDate: Date; endDate: Date; reason: string; deletedAt: null };
type FakeSpot = {
  id: string; campSiteId: string; name: string; priceUnit: string; maxCampers: number | null;
  maxTents: number | null; pricePerNight: number; zoneId: string | null;
  viewType: string | null; environment: string | null; nearFacilities: string | null; deletedAt: null;
};
type FakeUser = { id: string; role: string; deletedAt: null };

function matchesNameFilter(name: string, filter: any): boolean {
  if (filter === undefined) return true;
  if (filter.startsWith !== undefined) return name.startsWith(filter.startsWith);
  if (filter.not?.startsWith !== undefined) return !name.startsWith(filter.not.startsWith);
  return true;
}

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

  return {
    _store: { camps, zones, spots, images, bookings, blockedDates, users },
    campSite: {
      findMany: async ({ where }: any) => {
        return camps
          .filter(
            (c) =>
              (where?.isPublished !== undefined ? c.isPublished === where.isPublished : true) &&
              c.deletedAt === where?.deletedAt &&
              (where?.useSpotView !== undefined ? c.useSpotView === where.useSpotView : true)
          )
          .map((c) => ({
            ...c,
            _count: {
              spots: spots.filter((s) => s.campSiteId === c.id && s.deletedAt === null).length,
              images: fixture.campImageCounts[c.id] ?? 0,
              zones: zones.filter((z) => z.campSiteId === c.id && z.deletedAt === null).length,
            },
          }));
      },
      findFirst: async ({ where }: any) => {
        const c = camps.find((x) => x.nameThSlug === where.nameThSlug && x.deletedAt === where.deletedAt);
        return c ? { ...c } : null;
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
      // Serves 3 distinct call shapes: buildPlan's sibling lookup (name.not.startsWith),
      // buildPlan/undoPlan's demo-pitch lookup (name.startsWith), and the REAL
      // calculateSpotCapacity's plain campSiteId+deletedAt lookup (no name filter).
      findMany: async ({ where }: any) => {
        return spots
          .filter(
            (s) =>
              s.campSiteId === where.campSiteId &&
              s.deletedAt === where.deletedAt &&
              matchesNameFilter(s.name, where.name)
          )
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
          .map((s) => ({
            ...s,
            images: images.filter((i) => i.spotId === s.id).map((i) => ({ id: i.id, kind: i.kind, url: i.url })),
            bookings: bookings.filter((b) => b.spotId === s.id && b.deletedAt === null && b.status !== 'CANCELLED').map((b) => ({ id: b.id })),
            blockedDates: blockedDates.filter((b) => b.spotId === s.id && b.deletedAt === null).map((b) => ({ id: b.id })),
          }));
      },
      create: async ({ data }: any) => {
        const row: FakeSpot = {
          id: nextId('spot'), campSiteId: data.campSiteId, name: data.name, priceUnit: data.priceUnit,
          maxCampers: data.maxCampers ?? null, maxTents: null, pricePerNight: data.pricePerNight,
          zoneId: data.zoneId ?? null, viewType: data.viewType ?? null, environment: data.environment ?? null,
          nearFacilities: data.nearFacilities ?? null, deletedAt: null,
        };
        spots.push(row);
        return { ...row };
      },
      deleteMany: async ({ where }: any) => {
        const ids: string[] = where.id.in;
        const before = spots.length;
        const keep = spots.filter((s) => !ids.includes(s.id));
        spots.length = 0;
        spots.push(...keep);
        return { count: before - keep.length };
      },
      // Never called by this script (create-only design) — throws loudly if
      // it ever is, so a regression back to mutating a real pitch fails LOUD.
      update: async () => {
        throw new Error('spot.update must never be called — this script only ever creates demo pitches (CAM-663 design change)');
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
        const keep = images.filter((i) => !where.spotId.in.includes(i.spotId));
        images.length = 0;
        images.push(...keep);
        return { count: before - keep.length };
      },
    },
    blockedDate: {
      create: async ({ data }: any) => {
        const row: FakeBlockedDate = { id: nextId('blk'), spotId: data.spotId, campSiteId: data.campSiteId, startDate: data.startDate, endDate: data.endDate, reason: data.reason, deletedAt: null };
        blockedDates.push(row);
        return { ...row };
      },
      findFirst: async ({ where }: any) => {
        const row = blockedDates.find(
          (b) =>
            where.spotId.in.includes(b.spotId) &&
            b.startDate.getTime() === where.startDate.getTime() &&
            b.endDate.getTime() === where.endDate.getTime()
        );
        return row ? { reason: row.reason } : null;
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

/** A fresh camp with `spotCount` REAL sibling live spots, `zoneCount` live zones, useSpotView false, no demo pitches yet. */
function makeFreshFixture({ spotCount = 12, zoneCount = 3, campImages = 25 } = {}) {
  const campId = 'camp-1';
  const camps: FakeCamp[] = [
    {
      id: campId, nameTh: 'แคมป์สาธิต', nameThSlug: 'demo-camp', useSpotView: false,
      isPublished: true, deletedAt: null, maxGuestsPerDay: 40, maxTentsPerDay: 20,
      description: 'สถานที่กางเต็นท์ริมน้ำ', logo: 'https://example.com/logo.png', videoUrl: null,
      phone: '0812345678', lineId: '@democamp', facebookUrl: 'https://fb.com/democamp',
      address: '123 หมู่ 4', directions: 'เลี้ยวซ้ายที่ปากทาง', feeInfo: '50 บาทต่อคัน',
      toiletInfo: 'ห้องน้ำรวม', groundType: '{"GRASS":10}', cancellationPolicy: 'FLEXIBLE',
      tags: 'ริมน้ำ,ครอบครัว', partner: null, nationalPark: null, ownershipType: 'PRIVATE',
      minimumAge: 5, priceLow: 300, priceHigh: 900, avgRating: 4.5, reviewCount: 12,
    },
  ];
  const zones: FakeZone[] = Array.from({ length: zoneCount }, (_, i) => ({
    id: `zone-${i + 1}`, campSiteId: campId, name: `โซน ${i + 1}`, sortOrder: i, deletedAt: null,
  }));
  const spots: FakeSpot[] = Array.from({ length: spotCount }, (_, i) => ({
    id: `spot-${String(i + 1).padStart(2, '0')}`, campSiteId: campId, name: `จุดกางเต็นท์ ${i + 1}`,
    priceUnit: 'PER_SITE', maxCampers: 4, maxTents: 2, pricePerNight: 500 + i * 10, zoneId: zones[0].id,
    viewType: 'MOUNTAIN', environment: 'GRASS', nearFacilities: 'SHOW,WIFI', deletedAt: null,
  }));
  return {
    camps, zones, spots, images: [] as FakeImage[], bookings: [] as FakeBooking[], blockedDates: [] as FakeBlockedDate[],
    users: [{ id: 'user-camper-1', role: 'CAMPER', deletedAt: null }] as FakeUser[],
    campImageCounts: { [campId]: campImages } as Record<string, number>,
  };
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

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
// (c) pickCamp — selection rule (incl. useSpotView=false) + override
// ===========================================================================
describe('CAM-663 (c) — pickCamp: rule-based selection + --camp override', () => {
  it('[normal] picks the only eligible published camp', async () => {
    const fixture = makeFreshFixture();
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, {});
    expect(camp.nameThSlug).toBe('demo-camp');
    expect(camp.overridden).toBe(false);
  });

  it('[error/validation, Critical, teeth] a camp already in per-spot mode (useSpotView=true) is EXCLUDED from rule-based selection', async () => {
    const fixture = makeFreshFixture();
    fixture.camps[0].useSpotView = true;
    const prisma = makeFakePrisma(fixture);
    await expect(pickCamp(prisma as any, {})).rejects.toThrow(/no camp on this target/);
  });

  it('[normal] --camp override still targets a camp already in per-spot mode', async () => {
    const fixture = makeFreshFixture();
    fixture.camps[0].useSpotView = true;
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, { overrideSlug: 'demo-camp' });
    expect(camp.overridden).toBe(true);
    expect(camp.useSpotView).toBe(true);
  });

  it('[normal, teeth] picks the HIGHER completeness score between two eligible camps', async () => {
    const fixture = makeFreshFixture();
    const sparseCamp: FakeCamp = {
      ...fixture.camps[0], id: 'camp-2', nameThSlug: 'sparse-camp', description: null, logo: null,
      videoUrl: null, phone: null, lineId: null, facebookUrl: null, address: null, directions: null,
      feeInfo: null, toiletInfo: null, groundType: null, cancellationPolicy: null, tags: null,
      partner: null, nationalPark: null, ownershipType: null, minimumAge: null,
      priceLow: null, priceHigh: null, avgRating: null, reviewCount: 0,
    };
    fixture.camps.push(sparseCamp);
    fixture.zones.push(...Array.from({ length: 3 }, (_, i) => ({ id: `z2-${i}`, campSiteId: 'camp-2', name: `z${i}`, sortOrder: i, deletedAt: null })));
    fixture.spots.push(
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `s2-${i}`, campSiteId: 'camp-2', name: `s${i}`, priceUnit: 'PER_SITE', maxCampers: 4, maxTents: 2,
        pricePerNight: 300, zoneId: `z2-0`, viewType: null, environment: null, nearFacilities: null, deletedAt: null,
      }))
    );
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
// (d) pure role/content logic
// ===========================================================================
describe('CAM-663 (d) — role/content logic: deterministic, covers every variety branch', () => {
  it('[boundary] ROLE_ORDER has exactly DEMO_SPOT_COUNT (9) roles, 4 image buckets', () => {
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

  it('[normal] every role has a unique name under DEMO_NAME_PREFIX (the undo identity marker)', () => {
    const names = ROLE_ORDER.map((r) => nameForRole(r));
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n.startsWith(DEMO_NAME_PREFIX)).toBe(true);
  });

  it('[normal] priceForRole: only no-image-2 is free (0); every other role is a positive price', () => {
    expect(priceForRole('no-image-2')).toBe(0);
    for (const role of ROLE_ORDER.filter((r) => r !== 'no-image-2')) {
      expect(priceForRole(role)).toBeGreaterThan(0);
    }
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
    expect(nameForRole('no-image-1')).toContain(LONG_NAME);
  });
});

// ===========================================================================
// (e) buildPlan + summarizePlan — the full variety matrix, never touches a real pitch
// ===========================================================================
describe('CAM-663 (e) — buildPlan: produces every branch of the variety list, real pitches untouched', () => {
  it('[normal, teeth] a fresh camp produces the full count table, all 9 marked as NEW pitches', async () => {
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
    expect(summary['new pitches to create']).toBe(9);

    // the plan never references any of the 12 real sibling spot names
    const realSpotNames = new Set(fixture.spots.map((s) => s.name));
    for (const row of plan.rows) {
      expect(row.spotId).toBeNull(); // fresh camp — nothing exists yet
      expect(realSpotNames.has(row.name)).toBe(false);
    }
  });

  it('[concurrent/ordering, teeth] dry-run twice (no writes in between) prints an IDENTICAL plan', async () => {
    const fixture = makeFreshFixture();
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, {});

    const planA = await buildPlan(prisma as any, camp);
    const planB = await buildPlan(prisma as any, camp);

    expect(summarizePlan(planA)).toEqual(summarizePlan(planB));
    expect(planA.rows.map((r) => ({ name: r.name, role: r.role }))).toEqual(
      planB.rows.map((r) => ({ name: r.name, role: r.role }))
    );
  });

  it('[error/validation] throws when the camp has fewer than MIN_ZONES live zones', async () => {
    const fixture = makeFreshFixture({ zoneCount: 2 });
    const prisma = makeFakePrisma(fixture);
    const camp = { id: 'camp-1', nameThSlug: 'demo-camp', useSpotView: false, overridden: false, score: 0 };
    await expect(buildPlan(prisma as any, camp)).rejects.toThrow(/live zones/);
  });

  it('[null/empty, teeth] no real sibling pitches to copy from throws (never invents viewType/environment)', async () => {
    const fixture = makeFreshFixture({ spotCount: 0 });
    const prisma = makeFakePrisma(fixture);
    const camp = { id: 'camp-1', nameThSlug: 'demo-camp', useSpotView: false, overridden: true, score: 0 };
    await expect(buildPlan(prisma as any, camp)).rejects.toThrow(/no real sibling pitch/);
  });

  it('[normal] viewType/environment/nearFacilities are copied from a real sibling, read-only', async () => {
    const fixture = makeFreshFixture();
    fixture.spots[0].viewType = 'LAKE';
    fixture.spots[0].environment = 'SAND';
    fixture.spots[0].nearFacilities = 'TOIL';
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, {});
    const plan = await buildPlan(prisma as any, camp);
    expect(plan.rows.every((r) => r.viewType !== undefined)).toBe(true);
    // the sibling rows themselves are untouched (buildPlan is read-only)
    expect(fixture.spots[0].viewType).toBe('LAKE');
  });
});

// ===========================================================================
// (f) applyPlan — creates exactly the planned rows, idempotent on re-apply
// ===========================================================================
describe('CAM-663 (f) — applyPlan: creates pitches (never updates), idempotent on re-apply', () => {
  it('[normal, teeth] creates 9 pitches + expected image/blockedDate/booking counts + sets useSpotView', async () => {
    const fixture = makeFreshFixture();
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, {});
    const plan = await buildPlan(prisma as any, camp);

    const created = await applyPlan(prisma as any, plan);

    expect(created.spots).toBe(9);
    // 2 panorama + 3*3 multi-photo + 2*1 one-photo = 2 + 9 + 2 = 13 images
    expect(created.images).toBe(13);
    expect(created.blockedDates).toBe(1);
    expect(created.bookings).toBe(1);

    const updatedCamp = prisma._store.camps.find((c) => c.id === camp.id)!;
    expect(updatedCamp.useSpotView).toBe(true);

    const freeSpot = prisma._store.spots.find((s) => s.name === nameForRole('no-image-2'))!;
    expect(Number(freeSpot.pricePerNight)).toBe(0);
    const longNameSpot = prisma._store.spots.find((s) => s.name === nameForRole('no-image-1'))!;
    expect(longNameSpot.name).toContain(LONG_NAME);

    // the 12 real siblings are byte-for-byte untouched
    for (const original of fixture.spots) {
      const stillThere = prisma._store.spots.find((s) => s.id === original.id);
      expect(stillThere).toEqual(original);
    }
  });

  it('[concurrent/ordering, teeth] a SECOND apply on the same state creates ZERO additional rows', async () => {
    const fixture = makeFreshFixture();
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, { overrideSlug: 'demo-camp' });

    const plan1 = await buildPlan(prisma as any, camp);
    const first = await applyPlan(prisma as any, plan1);
    expect(first.spots).toBe(9);
    expect(first.images).toBe(13);

    // rule-based pickCamp would now exclude this camp (useSpotView flipped true) — use
    // override, exactly as a real --apply re-run would need to (mirrors main()'s contract).
    const camp2 = await pickCamp(prisma as any, { overrideSlug: 'demo-camp' });
    const plan2 = await buildPlan(prisma as any, camp2);
    const second = await applyPlan(prisma as any, plan2);

    expect(second.spots).toBe(0);
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
// (g) undoPlan — removes exactly the demo pitches (+ children), nothing else
// ===========================================================================
describe('CAM-663 (g) — undoPlan: removes exactly what this script created', () => {
  it('[normal, teeth] removes the created pitches/images/booking/blockedDate and resets useSpotView', async () => {
    const fixture = makeFreshFixture();
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, {});
    const plan = await buildPlan(prisma as any, camp);
    await applyPlan(prisma as any, plan);

    const campForUndo = await pickCamp(prisma as any, { overrideSlug: 'demo-camp' });
    const planForUndo = await buildPlan(prisma as any, campForUndo);
    const removed = await undoPlan(prisma as any, planForUndo);

    expect(removed.spots).toBe(9);
    expect(removed.images).toBe(13);
    expect(removed.bookings).toBe(1);
    expect(removed.blockedDates).toBe(1);

    expect(prisma._store.spots.filter((s) => s.name.startsWith(DEMO_NAME_PREFIX))).toHaveLength(0);
    expect(prisma._store.bookings).toHaveLength(0);
    expect(prisma._store.blockedDates).toHaveLength(0);
    expect(prisma._store.images).toHaveLength(0);
    expect(prisma._store.camps.find((c) => c.id === camp.id)!.useSpotView).toBe(false);
    // the 12 real siblings survive, untouched
    expect(prisma._store.spots).toHaveLength(12);
  });

  it('[Critical, teeth] never touches a real pitch/booking that this script did not create', async () => {
    const fixture = makeFreshFixture();
    // A real, pre-existing booking on a REAL sibling pitch, on unrelated dates.
    fixture.bookings.push({
      id: 'real-bkg', spotId: 'spot-01', campSiteId: 'camp-1', userId: 'user-camper-1',
      checkInDate: new Date('2026-08-01'), checkOutDate: new Date('2026-08-03'),
      guests: 2, totalPrice: 1000, currency: 'THB', status: 'CONFIRMED', deletedAt: null,
    });
    const prisma = makeFakePrisma(fixture);
    const camp = await pickCamp(prisma as any, {});
    const plan = await buildPlan(prisma as any, camp);
    await applyPlan(prisma as any, plan);

    const campForUndo = await pickCamp(prisma as any, { overrideSlug: 'demo-camp' });
    const planForUndo = await buildPlan(prisma as any, campForUndo);
    await undoPlan(prisma as any, planForUndo);

    expect(prisma._store.bookings.some((b) => b.id === 'real-bkg')).toBe(true);
    expect(prisma._store.spots.some((s) => s.id === 'spot-01')).toBe(true);
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

// ===========================================================================
// (i) Apply -> undo ROUND TRIP — byte-for-byte restoration
//
// NOT A REAL DATABASE PROOF. The repo's real DB-touching harness
// (scripts/setup-e2e-db.ts) requires a reachable LOCAL Postgres, and this
// ticket's hard prohibition ("never seed against a localhost URL / never
// touch the local dev database") blocks using it for this story. This test
// operates on the SAME in-memory fake Prisma client as every test above —
// but, to keep the capacity claim honest rather than re-implemented, it
// calls the REAL production `getEffectiveCapacity` (lib/campsite-
// availability.ts) against that fake client, not a hand-rolled formula. See
// docs/RUNBOOK-demo-spot-seed.md "Test-harness note" for the full context.
// ===========================================================================
async function runApplyUndoRoundTrip(
  fixture: ReturnType<typeof makeFreshFixture>,
  { campSlugForApply }: { campSlugForApply?: string } = {}
) {
  const prisma = makeFakePrisma(fixture);

  const campBefore = JSON.parse(JSON.stringify(prisma._store.camps.find((c) => c.id === 'camp-1')));
  const spotsBefore = JSON.parse(JSON.stringify([...prisma._store.spots].sort(byId)));
  const capacityBefore = await getEffectiveCapacity(prisma as unknown as PrismaClient, {
    id: campBefore.id, useSpotView: campBefore.useSpotView,
    maxGuestsPerDay: campBefore.maxGuestsPerDay, maxTentsPerDay: campBefore.maxTentsPerDay,
  });

  // --- apply ---
  const camp = await pickCamp(prisma as any, campSlugForApply ? { overrideSlug: campSlugForApply } : {});
  const plan = await buildPlan(prisma as any, camp);
  await applyPlan(prisma as any, plan);

  const campAfterApply = { ...prisma._store.camps.find((c) => c.id === 'camp-1')! };
  const capacityAfterApply = await getEffectiveCapacity(prisma as unknown as PrismaClient, {
    id: campAfterApply.id, useSpotView: campAfterApply.useSpotView,
    maxGuestsPerDay: campAfterApply.maxGuestsPerDay, maxTentsPerDay: campAfterApply.maxTentsPerDay,
  });

  // --- undo (must use --camp; matches main()'s real contract: --undo always requires --camp) ---
  const campForUndo = await pickCamp(prisma as any, { overrideSlug: 'demo-camp' });
  const planForUndo = await buildPlan(prisma as any, campForUndo);
  await undoPlan(prisma as any, planForUndo);

  const campAfterUndo = JSON.parse(JSON.stringify(prisma._store.camps.find((c) => c.id === 'camp-1')));
  const spotsAfterUndo = JSON.parse(JSON.stringify([...prisma._store.spots].sort(byId)));
  const capacityAfterUndo = await getEffectiveCapacity(prisma as unknown as PrismaClient, {
    id: campAfterUndo.id, useSpotView: campAfterUndo.useSpotView,
    maxGuestsPerDay: campAfterUndo.maxGuestsPerDay, maxTentsPerDay: campAfterUndo.maxTentsPerDay,
  });

  return { campBefore, spotsBefore, capacityBefore, campAfterApply, capacityAfterApply, campAfterUndo, spotsAfterUndo, capacityAfterUndo };
}

describe('CAM-663 (i) — apply->undo round trip restores an exact snapshot (plan/fake-Prisma level only, not a real DB proof)', () => {
  it('[Critical, teeth] case A — camp STARTS useSpotView=false: round trip restores false + original capacity', async () => {
    const fixture = makeFreshFixture(); // useSpotView: false
    const r = await runApplyUndoRoundTrip(fixture);

    expect(r.campAfterApply.useSpotView).toBe(true); // apply flips it on
    expect(r.capacityAfterApply).not.toEqual(r.capacityBefore); // capacity really moved

    expect(r.campAfterUndo).toEqual(r.campBefore);
    expect(r.campAfterUndo.useSpotView).toBe(false); // restored to its original false
    expect(r.spotsAfterUndo).toEqual(r.spotsBefore);
    expect(r.capacityAfterUndo).toEqual(r.capacityBefore);
  });

  // This is the case that was actually broken: a real camp already in per-spot
  // mode (e.g. the owner's own test camp, khao-kho-windmill-meadow-15-th) had
  // undo unconditionally hardcode useSpotView:false, silently flipping a real
  // camp OUT of per-spot mode and dropping its capacity derivation back to
  // maxGuestsPerDay — even though apply itself never touched the flag (it was
  // already true, a no-op). Fixed by reading the durable
  // DEMO_BLOCKED_REASON_ORIGIN_* marker instead of hardcoding false.
  it('[Critical, teeth] case B — camp STARTS useSpotView=true: round trip restores TRUE, never a hardcoded false', async () => {
    const fixture = makeFreshFixture();
    fixture.camps[0].useSpotView = true; // already in per-spot mode — rule-based selection would now exclude it, so apply must use --camp too
    const r = await runApplyUndoRoundTrip(fixture, { campSlugForApply: 'demo-camp' });

    expect(r.campAfterApply.useSpotView).toBe(true); // unchanged — apply is a no-op on an already-true flag
    expect(r.capacityAfterApply).not.toEqual(r.capacityBefore); // capacity still moves: 9 new pitches now summed in

    expect(r.campAfterUndo).toEqual(r.campBefore);
    expect(r.campAfterUndo.useSpotView).toBe(true); // MUST stay true — undo must never falsely flip a real per-spot camp off
    expect(r.spotsAfterUndo).toEqual(r.spotsBefore);
    expect(r.capacityAfterUndo).toEqual(r.capacityBefore);
  });
});
