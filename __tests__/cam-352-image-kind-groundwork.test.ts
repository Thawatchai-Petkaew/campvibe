/**
 * cam-352-image-kind-groundwork.test.ts — CAM-352 (360/panorama structural groundwork)
 *
 * Scope of THIS test file: BR-7/BR-8 only — the `Image.kind` migration + the
 * backward-compatible write-path union input contract + the read-path plumbing.
 * The CRUD screen (AC-1..AC-10) is a separate frontend slice; not covered here.
 *
 * Confirmation-list coverage (tech.md "Confirmation summary"):
 *   1. Migration reversibility (up -> down -> up) — proven against the LOCAL DB with
 *      real psql output (see PR body); not re-asserted here as a unit test (a DB round
 *      trip is not something vitest can safely drive without a live Postgres in CI).
 *      This file DOES guard the migration's SOURCE (up/down SQL content) so a future
 *      edit cannot silently drop the reversibility of the checked-in migration files.
 *   2. Backward-compat — legacy `images: string[]` -> spot POST + camp POST persist
 *      kind = 'PHOTO'.
 *   3. New shape — `images: [{url, kind:'PANORAMA'}]` persists 'PANORAMA'; unmarked
 *      stays 'PHOTO'.
 *   4. Read rides through — spot GET (list + single) responses carry `kind`; the
 *      catalog-card select (`campCardSelect`) does NOT enumerate `kind`.
 *   5. Existing rows read as PHOTO post-migration — proven against the LOCAL DB with
 *      real psql output (see PR body: 12/12 pre-existing Image rows read PHOTO).
 *
 * Layer: unit (zod boundary + api-utils helper) + mocked-Prisma integration (same
 * precedent as __tests__/spot-rbac.test.ts for spots, __tests__/cam-211-upload-hardening.test.ts
 * for the campsites POST route) + source-inspection (migration SQL + types/api.ts,
 * same precedent as __tests__/cam-341-fee-policy-form.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';
import { imageInputSchema, imageKindEnum } from '@/lib/validations/image';
import { spotSchema } from '@/lib/validations/spot';
import { campSiteSchema } from '@/lib/validations/campsite';
import { imageCreateNested, imageReplaceNested } from '@/lib/api-utils';
import { campCardSelect } from '@/lib/read-models/camp-card';
import { _store } from '@/lib/rate-limit';

const root = path.resolve(__dirname, '..');
const src = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

// ---------------------------------------------------------------------------
// 1. lib/validations/image.ts — imageInputSchema (unit)
// ---------------------------------------------------------------------------
describe('imageInputSchema (BR-7, BR-8) — normalizes both legacy and new shapes', () => {
  it('[normal] a bare url string transforms to {url, kind: PHOTO}', () => {
    const result = imageInputSchema.parse('https://cdn.example.com/a.jpg');
    expect(result).toEqual({ url: 'https://cdn.example.com/a.jpg', kind: 'PHOTO' });
  });

  it('[normal] {url, kind: PANORAMA} passes through unchanged', () => {
    const result = imageInputSchema.parse({ url: 'https://cdn.example.com/pano.jpg', kind: 'PANORAMA' });
    expect(result).toEqual({ url: 'https://cdn.example.com/pano.jpg', kind: 'PANORAMA' });
  });

  it('[null/empty] {url} with no kind defaults to PHOTO (EC-9)', () => {
    const result = imageInputSchema.parse({ url: 'https://cdn.example.com/b.jpg' });
    expect(result).toEqual({ url: 'https://cdn.example.com/b.jpg', kind: 'PHOTO' });
  });

  it('[error/validation] an invalid url string is rejected', () => {
    const result = imageInputSchema.safeParse('not-a-url');
    expect(result.success).toBe(false);
  });

  it('[error/validation] an invalid kind value is rejected', () => {
    const result = imageInputSchema.safeParse({ url: 'https://cdn.example.com/c.jpg', kind: 'PANO_360' });
    expect(result.success).toBe(false);
  });

  it('[boundary] imageKindEnum is a closed set of exactly PHOTO/PANORAMA (not PANO_360 — D1)', () => {
    expect(imageKindEnum.options).toEqual(['PHOTO', 'PANORAMA']);
  });
});

describe('spotSchema.images / campSiteSchema.images — union array (BR-8)', () => {
  it('[normal] spotSchema accepts a mixed legacy-string + new-object array', () => {
    const result = spotSchema.safeParse({
      name: 'โซนริมน้ำ A1',
      pricePerNight: 500,
      campSiteId: '550e8400-e29b-41d4-a716-446655440000',
      images: ['https://cdn.example.com/a.jpg', { url: 'https://cdn.example.com/b.jpg', kind: 'PANORAMA' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.images).toEqual([
        { url: 'https://cdn.example.com/a.jpg', kind: 'PHOTO' },
        { url: 'https://cdn.example.com/b.jpg', kind: 'PANORAMA' },
      ]);
    }
  });

  it('[null/empty] spotSchema.images is optional (omitted array is still valid)', () => {
    const result = spotSchema.safeParse({
      name: 'โซนริมน้ำ A1',
      pricePerNight: 500,
      campSiteId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('[normal] campSiteSchema accepts the same union shape (shared <ImageUpload> feeds both)', () => {
    const result = campSiteSchema.partial().safeParse({
      nameTh: 'ทดสอบ',
      images: ['https://cdn.example.com/logo-gallery.jpg', { url: 'https://cdn.example.com/pano.jpg', kind: 'PANORAMA' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.images).toEqual([
        { url: 'https://cdn.example.com/logo-gallery.jpg', kind: 'PHOTO' },
        { url: 'https://cdn.example.com/pano.jpg', kind: 'PANORAMA' },
      ]);
    }
  });

  it('[error/validation] campSiteSchema still rejects a non-url image entry', () => {
    const result = campSiteSchema.partial().safeParse({
      nameTh: 'ทดสอบ',
      images: ['not-a-url'],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. lib/api-utils.ts — imageCreateNested / imageReplaceNested (unit)
// ---------------------------------------------------------------------------
describe('imageCreateNested / imageReplaceNested — widened to persist kind (BR-8)', () => {
  it('[normal] legacy string[] input persists kind=PHOTO for every entry, sortOrder preserved', () => {
    const result = imageCreateNested(['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg']);
    expect(result).toEqual({
      create: [
        { url: 'https://cdn.example.com/a.jpg', sortOrder: 0, kind: 'PHOTO' },
        { url: 'https://cdn.example.com/b.jpg', sortOrder: 1, kind: 'PHOTO' },
      ],
    });
  });

  it('[normal] {url, kind} object input persists the given kind', () => {
    const result = imageCreateNested([{ url: 'https://cdn.example.com/pano.jpg', kind: 'PANORAMA' }]);
    expect(result).toEqual({
      create: [{ url: 'https://cdn.example.com/pano.jpg', sortOrder: 0, kind: 'PANORAMA' }],
    });
  });

  it('[concurrent/ordering] a mixed string + object array normalizes each entry and preserves order', () => {
    const result = imageCreateNested([
      'https://cdn.example.com/a.jpg',
      { url: 'https://cdn.example.com/pano.jpg', kind: 'PANORAMA' },
      { url: 'https://cdn.example.com/c.jpg' }, // no kind -> defaults PHOTO
    ]);
    expect(result.create).toEqual([
      { url: 'https://cdn.example.com/a.jpg', sortOrder: 0, kind: 'PHOTO' },
      { url: 'https://cdn.example.com/pano.jpg', sortOrder: 1, kind: 'PANORAMA' },
      { url: 'https://cdn.example.com/c.jpg', sortOrder: 2, kind: 'PHOTO' },
    ]);
  });

  it('[null/empty] undefined/null/[] input all produce an empty create array', () => {
    expect(imageCreateNested(undefined)).toEqual({ create: [] });
    expect(imageCreateNested(null)).toEqual({ create: [] });
    expect(imageCreateNested([])).toEqual({ create: [] });
  });

  it('[boundary] an entry with an empty url is dropped (not persisted as a blank row)', () => {
    const result = imageCreateNested(['', 'https://cdn.example.com/a.jpg']);
    expect(result.create).toEqual([{ url: 'https://cdn.example.com/a.jpg', sortOrder: 0, kind: 'PHOTO' }]);
  });

  it('[normal] imageReplaceNested clears the gallery first (deleteMany: {}) then recreates with kind', () => {
    const result = imageReplaceNested([{ url: 'https://cdn.example.com/pano.jpg', kind: 'PANORAMA' }]);
    expect(result).toEqual({
      deleteMany: {},
      create: [{ url: 'https://cdn.example.com/pano.jpg', sortOrder: 0, kind: 'PANORAMA' }],
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Route integration — spot POST/PUT + campsite POST persist kind (mocked Prisma)
//    Mocking strategy mirrors __tests__/spot-rbac.test.ts (spots) and
//    __tests__/cam-211-upload-hardening.test.ts (campsites POST).
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    spot: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  requireCampSitePermission: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

import { prisma } from '@/lib/prisma';
import { requireCampSitePermission, requireAuth } from '@/lib/auth-utils';
import { GET as spotsGET, POST as spotsPOST } from '@/app/api/campsites/[id]/spots/route';
import { PUT as spotPUT } from '@/app/api/campsites/[id]/spots/[spotId]/route';
import { POST as campsitesPOST } from '@/app/api/campsites/route';

const CAMPSITE_ID = '550e8400-e29b-41d4-a716-446655440000';
const SPOT_ID = '550e8400-e29b-41d4-a716-446655440001';
const makeCollectionParams = (id: string) => ({ params: Promise.resolve({ id }) });
const makeItemParams = (id: string, spotId: string) => ({ params: Promise.resolve({ id, spotId }) });

function mockPermissionAllowed() {
  (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: null,
    campSite: { id: CAMPSITE_ID } as never,
    session: {} as never,
  });
}

function mockAuthAllowed(userId = 'op-1') {
  (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: null,
    session: { user: { id: userId, role: 'OPERATOR' } } as never,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  _store.clear();
});

describe('POST /api/campsites/[id]/spots — persists kind (AC-11, BR-7/BR-8, Confirmation items 2/3)', () => {
  it('legacy images: string[] payload -> 201, persists kind=PHOTO for every image', async () => {
    mockPermissionAllowed();
    (prisma.spot.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });

    const body = {
      name: 'โซนริมน้ำ A1',
      pricePerNight: 500,
      images: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
    };
    const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/spots`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
    const res = await spotsPOST(req, makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(201);
    const call = (prisma.spot.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.images).toEqual({
      create: [
        { url: 'https://cdn.example.com/a.jpg', sortOrder: 0, kind: 'PHOTO' },
        { url: 'https://cdn.example.com/b.jpg', sortOrder: 1, kind: 'PHOTO' },
      ],
    });
  });

  it('images: [{url, kind: PANORAMA}] payload -> 201, persists kind=PANORAMA', async () => {
    mockPermissionAllowed();
    (prisma.spot.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });

    const body = {
      name: 'โซนริมน้ำ A1',
      pricePerNight: 500,
      images: [{ url: 'https://cdn.example.com/pano.jpg', kind: 'PANORAMA' }],
    };
    const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/spots`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
    const res = await spotsPOST(req, makeCollectionParams(CAMPSITE_ID));

    expect(res.status).toBe(201);
    const call = (prisma.spot.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.images).toEqual({
      create: [{ url: 'https://cdn.example.com/pano.jpg', sortOrder: 0, kind: 'PANORAMA' }],
    });
  });

  it('an unmarked image in a mixed array defaults to kind=PHOTO (EC-9)', async () => {
    mockPermissionAllowed();
    (prisma.spot.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });

    const body = {
      name: 'โซนริมน้ำ A1',
      pricePerNight: 500,
      images: [{ url: 'https://cdn.example.com/pano.jpg', kind: 'PANORAMA' }, { url: 'https://cdn.example.com/plain.jpg' }],
    };
    const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/spots`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
    await spotsPOST(req, makeCollectionParams(CAMPSITE_ID));

    const call = (prisma.spot.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.images.create[1]).toEqual({ url: 'https://cdn.example.com/plain.jpg', sortOrder: 1, kind: 'PHOTO' });
  });
});

describe('PUT /api/campsites/[id]/spots/[spotId] — replaces gallery, persists kind (BR-8)', () => {
  it('replaces the gallery via imageReplaceNested and persists the new kind', async () => {
    mockPermissionAllowed();
    (prisma.spot.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });
    (prisma.spot.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: SPOT_ID });

    const req = new NextRequest(
      `http://localhost/api/campsites/${CAMPSITE_ID}/spots/${SPOT_ID}`,
      {
        method: 'PUT',
        body: JSON.stringify({ images: [{ url: 'https://cdn.example.com/pano2.jpg', kind: 'PANORAMA' }] }),
        headers: { 'content-type': 'application/json' },
      }
    );
    const res = await spotPUT(req, makeItemParams(CAMPSITE_ID, SPOT_ID));

    expect(res.status).toBe(200);
    const call = (prisma.spot.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.images).toEqual({
      deleteMany: {},
      create: [{ url: 'https://cdn.example.com/pano2.jpg', sortOrder: 0, kind: 'PANORAMA' }],
    });
  });
});

describe('POST /api/campsites — camp gallery also accepts + persists kind (Confirmation items 2/3, D2)', () => {
  const VALID_BASE = {
    nameTh: 'แคมป์ทดสอบ',
    locationId: '550e8400-e29b-41d4-a716-446655440099',
    latitude: 13.0,
    longitude: 100.0,
    checkInTime: '14:00',
    checkOutTime: '11:00',
    bookingMethod: 'ONLI' as const,
    // CAM-520: campSiteType is now required on create — unrelated to this
    // file's image-kind concern, so a valid code is added here.
    campSiteType: 'CAGD' as const,
  };

  it('legacy images: string[] payload -> 201, persists kind=PHOTO (camp save does not 400)', async () => {
    mockAuthAllowed();
    (prisma.campSite.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'cs-1' });

    const req = new NextRequest('http://localhost/api/campsites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_BASE, images: ['https://cdn.example.com/camp-a.jpg'] }),
    });
    const res = await campsitesPOST(req);

    expect(res.status).toBe(201);
    const call = (prisma.campSite.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.images).toEqual({
      create: [{ url: 'https://cdn.example.com/camp-a.jpg', sortOrder: 0, kind: 'PHOTO' }],
    });
  });

  it('images: [{url, kind: PANORAMA}] payload -> 201, persists kind=PANORAMA on the camp gallery', async () => {
    mockAuthAllowed();
    (prisma.campSite.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'cs-2' });

    const req = new NextRequest('http://localhost/api/campsites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_BASE, images: [{ url: 'https://cdn.example.com/camp-pano.jpg', kind: 'PANORAMA' }] }),
    });
    const res = await campsitesPOST(req);

    expect(res.status).toBe(201);
    const call = (prisma.campSite.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.images).toEqual({
      create: [{ url: 'https://cdn.example.com/camp-pano.jpg', sortOrder: 0, kind: 'PANORAMA' }],
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Read-path — spot GET responses ride kind through; catalog card select does NOT
// ---------------------------------------------------------------------------
describe('GET /api/campsites/[id]/spots — the response rides `kind` through (BR-8 row 2)', () => {
  beforeEach(() => {
    (prisma.campSite.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      isActive: true,
      isPublished: true,
      deletedAt: null,
      operatorId: 'op-default',
    });
  });

  it('a spot with a PANORAMA-marked image carries `kind` in the JSON response (no code change needed — include rides free)', async () => {
    (prisma.spot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: SPOT_ID,
        name: 'โซนริมน้ำ A1',
        campSiteId: CAMPSITE_ID,
        images: [{ url: 'https://cdn.example.com/pano.jpg', kind: 'PANORAMA', sortOrder: 0 }],
      },
    ]);

    const req = new NextRequest(`http://localhost/api/campsites/${CAMPSITE_ID}/spots`);
    const res = await spotsGET(req, makeCollectionParams(CAMPSITE_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body[0].images[0].kind).toBe('PANORAMA');
  });
});

describe('campCardSelect (lib/read-models/camp-card.ts) — stays url+sortOrder ONLY, no over-fetch (BR-8 row 4, do-NOT-change)', () => {
  it('the images sub-select does NOT enumerate `kind` — catalog cards never branch on it', () => {
    expect(campCardSelect.images.select).toEqual({ url: true, sortOrder: true });
    expect('kind' in campCardSelect.images.select).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. types/api.ts — additive `kind?` on SpotDTO only, NOT on CampSiteSummary
//    (source-inspection, same precedent as cam-341-fee-policy-form.test.ts —
//    type-only fields cannot be asserted at runtime).
// ---------------------------------------------------------------------------
describe('types/api.ts — SpotDTO.images gains kind? (additive); CampSiteSummary.images unchanged (BR-8 rows 5/6)', () => {
  const apiTypesSrc = src('types/api.ts');

  it('exports the ImageKind type mirroring the Prisma enum', () => {
    expect(apiTypesSrc).toMatch(/export type ImageKind = 'PHOTO' \| 'PANORAMA';/);
  });

  it('SpotDTO.images carries an optional kind field', () => {
    expect(apiTypesSrc).toMatch(/images\?: \{ url: string; kind\?: ImageKind \}\[\];/);
  });

  it('CampSiteSummary.images (wishlist/catalog) is left unchanged — no kind field added', () => {
    expect(apiTypesSrc).toContain('images?: { url: string }[];  // S4b: Image relation (was CSV)');
  });
});

// ---------------------------------------------------------------------------
// 6. Migration source guard — up/down SQL exist and are the reverse of each other
//    (real up->down->up DB round trip is documented with real psql output in the
//    PR body; this guards the checked-in SQL against a future silent edit).
// ---------------------------------------------------------------------------
describe('prisma/migrations/*_image_kind_panorama — reversible migration files (Confirmation item 1)', () => {
  const migrationDir = fs
    .readdirSync(path.join(root, 'prisma/migrations'))
    .find((d) => d.endsWith('_image_kind_panorama'));

  it('a migration directory named *_image_kind_panorama exists', () => {
    expect(migrationDir).toBeDefined();
  });

  it('up (migration.sql) creates the ImageKind enum + adds the NOT NULL DEFAULT PHOTO column (no backfill script needed)', () => {
    const up = src(`prisma/migrations/${migrationDir}/migration.sql`);
    expect(up).toContain(`CREATE TYPE "ImageKind" AS ENUM ('PHOTO', 'PANORAMA');`);
    expect(up).toMatch(/ALTER TABLE "Image" ADD COLUMN\s+"kind" "ImageKind" NOT NULL DEFAULT 'PHOTO';/);
  });

  it('down (down.sql) drops the column then the enum type — the exact reverse, in the correct order', () => {
    const down = src(`prisma/migrations/${migrationDir}/down.sql`);
    expect(down).toContain('ALTER TABLE "Image" DROP COLUMN "kind";');
    expect(down).toContain('DROP TYPE "ImageKind";');
    // Column drop must precede the type drop (a type cannot be dropped while referenced).
    expect(down.indexOf('DROP COLUMN "kind"')).toBeLessThan(down.indexOf('DROP TYPE "ImageKind"'));
  });
});

// ---------------------------------------------------------------------------
// 7. prisma/schema.prisma — the enum + column are declared per tech.md's contract
// ---------------------------------------------------------------------------
describe('prisma/schema.prisma — Image.kind + ImageKind enum (BR-7)', () => {
  const schemaSrc = src('prisma/schema.prisma');

  it('declares enum ImageKind { PHOTO PANORAMA }', () => {
    expect(schemaSrc).toMatch(/enum ImageKind \{\s*PHOTO\s*PANORAMA\s*\}/);
  });

  it('model Image declares kind ImageKind @default(PHOTO)', () => {
    expect(schemaSrc).toMatch(/kind\s+ImageKind\s+@default\(PHOTO\)/);
  });

  it('no index was added on kind (never a lead filter — matches tech.md D1 rationale)', () => {
    const imageModelMatch = schemaSrc.match(/model Image \{[\s\S]*?\n\}/);
    expect(imageModelMatch).not.toBeNull();
    expect(imageModelMatch![0]).not.toContain('@@index([kind])');
  });
});
