/**
 * cam-580-chiang-mai-canary.test.ts — CAM-580
 *
 * Behavioral proof, against the REAL local dev Postgres DB, never by source
 * inspection or a mock — the exact failure mode this story was warned
 * about ("a missed reader does not throw — it returns zero results,
 * silently") can only be caught by actually running the query and reading
 * back a NUMBER, never by "it didn't crash".
 *
 * Gated on `DATABASE_URL` being a real, reachable Postgres — the CI
 * `quality-gate` job that runs `npm test` has no Postgres service (see
 * `.github/workflows/ci.yml`), so this suite SKIPS there and RUNS for real
 * on localhost (dev DB) — exactly where this story's AC must be verified
 * before merge, per CLAUDE.md's Definition of Done. Same precedent as
 * __tests__/cam-575-coordinate-sync-invariant.test.ts (no `vi.mock` of
 * `@/lib/prisma` anywhere in this file — the real Prisma client is used
 * throughout, dynamically imported inside a gated `beforeAll`).
 *
 * Coverage matrix (qa.md §7):
 *   normal — Chiang Mai canary = 18 at DB / AdminArea-resolve / camp-card
 *            province-map / reverse-geocode layers; a real 3-level camp
 *            still renders its full location chain in Thai
 *   null/empty — n/a (every asserted row is known to exist in the seeded
 *            dev DB)
 *   boundary — n/a
 *   error/validation — n/a (no new input boundary)
 *   concurrent/ordering — n/a (read-only, no shared mutable state)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const hasRealDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasRealDb)('CAM-580 — Chiang Mai canary = 18, asserted as a NUMBER at every touched layer', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let prisma: any;

    beforeAll(async () => {
        const { PrismaClient } = await import('@prisma/client');
        prisma = new PrismaClient();
    });

    afterAll(async () => {
        await prisma?.$disconnect();
    });

    it('[Critical, teeth] DB layer: campSite.count by location.province === 18 (before AND after this story\'s migration+code, per the PR body)', async () => {
        const count = await prisma.campSite.count({ where: { location: { province: 'Chiang Mai' } } });
        expect(count).toBe(18);
    });

    it('[Critical, teeth] the schema itself has no thailandLocation delegate any more (the model is dropped)', () => {
        expect(typeof prisma.thailandLocation).toBe('undefined');
    });

    it('[Critical, teeth] AdminArea province-resolve layer (app/api/geocode/_shared.ts\'s matchAdminArea path): the real Chiang Mai node exists', async () => {
        const node = await prisma.adminArea.findFirst({
            where: { countryCode: 'TH', level: 'PROVINCE', nameEn: 'Chiang Mai' },
            select: { id: true, code: true, nameTh: true, nameEn: true },
        });
        expect(node).not.toBeNull();
        expect(node.code).toBe('50');
        expect(node.nameTh).toBe('เชียงใหม่');
    });

    it('[Critical, teeth] camp-card province Thai-name map layer (lib/read-models/camp-card.ts, moved off ThailandLocation onto AdminArea): 77 provinces, Chiang Mai resolves', async () => {
        const { getProvinceThaiNameMap } = await import('@/lib/read-models/camp-card');
        const map = await getProvinceThaiNameMap();
        expect(map.size).toBe(77);
        expect(map.get('Chiang Mai')).toBe('เชียงใหม่');
    });

    it('[Critical, teeth] /api/locations/search\'s own searchProvinces query shape returns the real AdminArea row for a Thai query', async () => {
        const rows = await prisma.adminArea.findMany({
            where: {
                countryCode: 'TH',
                level: 'PROVINCE',
                OR: [
                    { nameTh: { contains: 'เชียงใหม่', mode: 'insensitive' } },
                    { nameEn: { contains: 'เชียงใหม่', mode: 'insensitive' } },
                ],
            },
            select: { id: true, code: true, nameTh: true, nameEn: true },
            take: 20,
        });
        expect(rows).toHaveLength(1);
        expect(rows[0].nameEn).toBe('Chiang Mai');
    });
});

describe.skipIf(!hasRealDb)('CAM-580 — reverse geocoding resolves for real, after the geocode helper moved off ThailandLocation', () => {
    it('[Critical, teeth] a real Chiang Mai Google-shaped address resolves province+district against the live AdminArea tree, no ThailandLocation join', async () => {
        const { resolveFromComponents } = await import('@/app/api/geocode/_shared');
        const result = await resolveFromComponents([
            { long_name: 'จังหวัดเชียงใหม่', short_name: 'เชียงใหม่', types: ['administrative_area_level_1', 'political'] },
            { long_name: 'อำเภอเมืองเชียงใหม่', short_name: 'เมืองเชียงใหม่', types: ['administrative_area_level_2', 'political'] },
        ]);
        expect(result.province?.provinceNameEn).toBe('Chiang Mai');
        expect(result.province?.provinceName).toBe('เชียงใหม่');
        expect(result.district?.districtNameEn).toBe('Mueang Chiang Mai');
        // id-first result is the deepest matched AdminArea node, which the
        // province/district rows now share the SAME id-space with.
        expect(result.adminAreaId).toBe(result.district?.id);
    });
});

describe.skipIf(!hasRealDb)('CAM-580 — a real camp with a full 3-level chain still renders province+district+subDistrict', () => {
    // Chosen per CAM-576's own scenario — a camp NAME that cannot collide
    // with the tokens under test ("Phachi"/"พระนครศรีอยุธยา" are place data,
    // not the camp's own name), whose adminArea resolves to the DEEPEST
    // level (SUBDISTRICT), exercising the full chain-walk this story's
    // migration must not have disturbed.
    const SLUG = 'phra-nakhon-si-ayutthaya-meadow-camp-3-60-th';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let prisma: any;

    beforeAll(async () => {
        const { PrismaClient } = await import('@prisma/client');
        prisma = new PrismaClient();
    });

    afterAll(async () => {
        await prisma?.$disconnect();
    });

    it('[Critical, teeth] buildLocationText renders SUBDISTRICT, DISTRICT and PROVINCE in Thai, with no English token leaking in', async () => {
        const { adminAreaChainSelect, resolveLocationDisplayNames } = await import('@/lib/read-models/camp-card');
        const { buildLocationText } = await import('@/components/CampgroundCard');

        const camp = await prisma.campSite.findUnique({
            where: { nameThSlug: SLUG },
            select: {
                location: {
                    select: { province: true, district: true, adminArea: { select: adminAreaChainSelect } },
                },
            },
        });
        expect(camp, `fixture camp ${SLUG} must exist in the dev DB (seeded per CAM-573/576)`).not.toBeNull();

        const names = resolveLocationDisplayNames(camp.location.adminArea);
        const rendered = buildLocationText({ ...camp.location, ...names }, 'th');

        expect(names.subDistrictTh).toBe('โคกม่วง');
        expect(names.districtTh).toBe('ภาชี');
        expect(names.provinceTh).toBe('พระนครศรีอยุธยา');
        expect(rendered).toBe('โคกม่วง, ภาชี, พระนครศรีอยุธยา');
        expect(rendered).not.toContain('Phachi');
    });
});
