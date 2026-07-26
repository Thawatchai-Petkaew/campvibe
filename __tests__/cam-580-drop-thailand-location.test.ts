/**
 * cam-580-drop-thailand-location.test.ts — CAM-580
 *
 * Story: drop the legacy `ThailandLocation` table itself — the last
 * irreversible step of the retirement arc (CAM-553 -> 563 -> 566 -> 573 ->
 * 574 -> 580). CAM-574 (phase B) had already retired the `Location` FK into
 * this table; two direct (non-FK) readers remained out of that story's
 * surface — `app/api/geocode/_shared.ts` (reverse-geocode province/district
 * resolution) and `lib/read-models/camp-card.ts` (province Thai-name
 * fallback map) — both moved onto `AdminArea` in THIS story. `prisma/seed.ts`
 * no longer populates the table. The model + table are dropped by a
 * reversible migration (up->down->up proven on the local dev DB — see the
 * PR body for the real command output; not re-proven here as a vitest test,
 * since that is a schema-DDL fact, not application behavior).
 *
 * THE FAILURE MODE this suite (and its sibling,
 * cam-580-chiang-mai-canary.test.ts) is built to catch: a missed reader does
 * not throw — it returns zero results, silently.
 *
 * Layer split:
 *   - Section A/B (this file): source-inspection (no DB) — always run,
 *     everywhere (app/, lib/, components/, scripts/, prisma/) — proves no
 *     reader/writer of `prisma.thailandLocation` remains and the model is
 *     gone from the schema. Search method (repeated here as a LIVE guard,
 *     not just a one-time manual check, so a resurrected call fails CI):
 *     recursively scans every `.ts`/`.tsx`/`.mjs` file under app/, lib/,
 *     components/, scripts/ for the literal property-access pattern
 *     `.thailandLocation.` (the actual Prisma client delegate access), which
 *     is distinct from prose mentioning the historical model NAME
 *     `ThailandLocation` in a comment (those are allowed to remain, e.g.
 *     CAM-574's own tech notes) — this test does NOT flag comments, only
 *     live property access.
 *   - Section C (this file): a mocked-Prisma behavioral proof of
 *     `resolveFromComponents`'s new AdminArea-only derivation. Mirrors
 *     cam-574's own regression-guard technique — the mock omits
 *     `thailandLocation` entirely, so a resurrected call throws instead of
 *     silently no-oping.
 *   - Sections D/E/F live in the sibling file
 *     cam-580-chiang-mai-canary.test.ts (real local dev Postgres, gated on
 *     DATABASE_URL, same precedent as
 *     __tests__/cam-575-coordinate-sync-invariant.test.ts) — the Chiang Mai
 *     canary asserted as the NUMBER 18 at every touched layer, reverse
 *     geocoding against the live AdminArea tree, and a real camp's full
 *     3-level location chain still rendering.
 *
 * Coverage matrix (qa.md §7):
 *   normal      — resolveFromComponents derives province/district from the
 *                 matched AdminArea node with the SAME id (Section C)
 *   null/empty  — an unmatched province returns all-null, never fabricates
 *                 a row (Section C)
 *   boundary    — n/a (pure derivation / static grep, no numeric edges)
 *   error/validation — n/a (no new input boundary in this story)
 *   concurrent/ordering — n/a (stateless)
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

/** Recursively lists every file under `dir` whose name ends with one of `exts`. */
function walk(dir: string, exts: string[], out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, exts, out);
        else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
    }
    return out;
}

// ---------------------------------------------------------------------------
// Section A — exhaustive reader/writer inventory (source-inspection, no DB)
// ---------------------------------------------------------------------------
describe('CAM-580 Section A — no code path calls prisma.thailandLocation.* any more', () => {
    const SURFACES = ['app', 'lib', 'components', 'scripts'];
    const files = SURFACES.flatMap((dir) => walk(path.join(ROOT, dir), ['.ts', '.tsx', '.mjs']));

    it(`[regression] zero ".thailandLocation." property accesses across ${files.length} files under app/, lib/, components/, scripts/`, () => {
        const offenders: string[] = [];
        for (const file of files) {
            const src = fs.readFileSync(file, 'utf8');
            if (/\.thailandLocation\./.test(src)) offenders.push(path.relative(ROOT, file));
        }
        expect(offenders).toEqual([]);
    });

    it('[regression] prisma/seed.ts no longer upserts/reads thailandLocation, but still seeds the AdminArea tree it replaced', () => {
        const seedSrc = fs.readFileSync(path.join(ROOT, 'prisma/seed.ts'), 'utf8');
        expect(seedSrc).not.toContain('.thailandLocation.');
        expect(seedSrc).toContain('prisma.adminArea.upsert');
    });

    it(`[boundary] the scan actually walked a non-trivial number of files (>100) — proves the search wasn't scoped to nothing`, () => {
        expect(files.length).toBeGreaterThan(100);
    });
});

// ---------------------------------------------------------------------------
// Section B — the model + table are actually dropped
// ---------------------------------------------------------------------------
describe('CAM-580 Section B — the ThailandLocation model is gone from the schema; migration is paired', () => {
    const schemaSrc = fs.readFileSync(path.join(ROOT, 'prisma/schema.prisma'), 'utf8');

    it('[regression] schema.prisma no longer declares `model ThailandLocation`', () => {
        expect(schemaSrc).not.toMatch(/model\s+ThailandLocation\s*\{/);
    });

    it('[regression] Location no longer references thaiLocationId/thaiLocation as a field', () => {
        expect(schemaSrc).not.toMatch(/\bthaiLocationId\b\s*String/);
        expect(schemaSrc).not.toMatch(/\bthaiLocation\b\s*ThailandLocation/);
    });

    it('[structural] the migration folder exists with a paired up + down that actually touch the table', () => {
        const dir = path.join(ROOT, 'prisma/migrations/20260727050000_cam580_drop_thailand_location_table');
        expect(fs.existsSync(path.join(dir, 'migration.sql'))).toBe(true);
        expect(fs.existsSync(path.join(dir, 'down.sql'))).toBe(true);
        expect(fs.readFileSync(path.join(dir, 'migration.sql'), 'utf8')).toContain('DROP TABLE "ThailandLocation"');
        const downSrc = fs.readFileSync(path.join(dir, 'down.sql'), 'utf8');
        expect(downSrc).toContain('CREATE TABLE "ThailandLocation"');
        expect(downSrc).toContain('ThailandLocation_provinceCode_districtCode_key');
    });
});

// ---------------------------------------------------------------------------
// Section C — resolveFromComponents' new AdminArea-only derivation (mocked)
// ---------------------------------------------------------------------------
const mockAdminAreaFindFirst = vi.fn();

// CAM-580 regression guard (same technique as cam-574's own suite): NO
// `thailandLocation` key at all in this mock — a resurrected call would
// throw ("Cannot read properties of undefined"), failing loudly rather than
// silently no-oping.
vi.mock('@/lib/prisma', () => ({
    prisma: { adminArea: { findFirst: (...args: unknown[]) => mockAdminAreaFindFirst(...args) } },
}));

const { resolveFromComponents } = await import('@/app/api/geocode/_shared');

const PROVINCE_NODE = { id: 'admin-prov-cnx', code: '50', nameTh: 'เชียงใหม่', nameEn: 'Chiang Mai', parentId: null };
const DISTRICT_NODE = { id: 'admin-dist-cnx', code: '5001', nameTh: 'เมืองเชียงใหม่', nameEn: 'Mueang Chiang Mai', parentId: 'admin-prov-cnx' };

describe("CAM-580 Section C — resolveFromComponents derives province/district from the matched AdminArea node, no second query", () => {
    beforeAll(() => {
        mockAdminAreaFindFirst.mockImplementation(async ({ where }: { where: { level: string; parentId?: string } }) => {
            if (where.level === 'PROVINCE') return PROVINCE_NODE;
            if (where.level === 'DISTRICT' && where.parentId === PROVINCE_NODE.id) return DISTRICT_NODE;
            return null;
        });
    });

    it('[normal] province/district rows carry the SAME id as the matched AdminArea node (no separate id-space any more)', async () => {
        const result = await resolveFromComponents([
            { long_name: 'จังหวัดเชียงใหม่', short_name: 'เชียงใหม่', types: ['administrative_area_level_1'] },
            { long_name: 'อำเภอเมืองเชียงใหม่', short_name: 'เมืองเชียงใหม่', types: ['administrative_area_level_2'] },
        ]);
        expect(result.province?.id).toBe(PROVINCE_NODE.id);
        expect(result.province?.provinceNameEn).toBe('Chiang Mai');
        expect(result.province?.provinceName).toBe('เชียงใหม่');
        expect(result.district?.id).toBe(DISTRICT_NODE.id);
        expect(result.district?.districtNameEn).toBe('Mueang Chiang Mai');
        // id-first result: the deepest matched AdminArea node.
        expect(result.adminAreaId).toBe(DISTRICT_NODE.id);
    });

    it('[null/empty] no province match returns province/district/subDistrict all null, never a fabricated row', async () => {
        mockAdminAreaFindFirst.mockResolvedValueOnce(null);
        const result = await resolveFromComponents([]);
        expect(result).toEqual({ province: null, district: null, subDistrict: null, adminAreaId: null });
    });
});
