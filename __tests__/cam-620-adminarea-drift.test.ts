/**
 * CAM-620 (item 3) — `prisma/data/thailand-locations.json` is the seed
 * source for the live `AdminArea` table (`prisma/seed.ts`'s
 * `prisma.adminArea.upsert({ ..., update: { nameTh, nameEn } })`), but that
 * upsert only fires when the seed actually re-runs. CAM-605 gave the
 * SUB-DISTRICT level a drift check; this file proves
 * `scripts/check-adminarea-drift.mjs`'s pure `computeAdminAreaDrift`
 * detects the same class of drift for PROVINCE + DISTRICT, using ONLY
 * constructed, in-memory fixtures — no DATABASE_URL, no Prisma connection,
 * no file write.
 *
 * Coverage matrix (story.md AC-8/AC-9, BR-5/BR-6, EC-7/EC-8):
 *   - AC-8/EC-7  a code present in both with a different nameTh/nameEn ->
 *                renamed (the RTGS-override-class drift CAM-553 names)
 *   - a committed code absent from the live table -> missingLive
 *   - a live code absent from the committed file -> missingCommitted
 *   - AC-9/EC-8  identical committed/live sets -> all three empty
 *   - AC-7/EC-6  no-DB / unreachable-DB SKIP path (source inspection, same
 *                convention as cam-605/cam-620-province-centroid-drift)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import realThailandLocations from '@/prisma/data/thailand-locations.json';

const root = path.resolve(__dirname, '..');
function readSrc(rel: string) {
  return readFileSync(path.join(root, rel), 'utf-8');
}

describe('CAM-620 check-adminarea-drift.mjs — source inspection', () => {
  const src = readSrc('scripts/check-adminarea-drift.mjs');

  it('must never write to thailand-locations.json or the AdminArea table (read-only comparison)', () => {
    expect(src).not.toMatch(/writeFileSync/);
    // Every executable Prisma call against adminArea must be findMany — a
    // mutating call (`.update`/`.upsert`/`.create`) is never present. The
    // file's own docblock explains prisma/seed.ts's `adminArea.upsert` as
    // background context, so assert on the executable calls only.
    const calls = src.match(/(?<!`)prisma\.adminArea\.\w+/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c === 'prisma.adminArea.findMany')).toBe(true);
  });

  it('never constructs a PrismaClient when DATABASE_URL is unset', () => {
    const noUrlIdx = src.indexOf('if (!url)');
    const newClientIdx = src.indexOf('new PrismaClient()');
    expect(noUrlIdx).toBeGreaterThan(-1);
    expect(newClientIdx).toBeGreaterThan(-1);
    expect(noUrlIdx).toBeLessThan(newClientIdx);
  });

  it('the unreachable-DB path is caught and exits 0, never crashes the process', () => {
    expect(src).toMatch(/catch \(error\)/);
    const catchStart = src.indexOf('catch (error)');
    const catchEnd = src.indexOf('await prisma.$disconnect();\n\n  const { missingLive', catchStart);
    expect(catchStart).toBeGreaterThan(-1);
    expect(catchEnd).toBeGreaterThan(catchStart);
    const catchBlock = src.slice(catchStart, catchEnd);
    expect(catchBlock).toContain('process.exit(0)');
  });

  it('a real difference is the ONLY path that exits 1', () => {
    const exit1Count = (src.match(/process\.exit\(1\)/g) || []).length;
    expect(exit1Count).toBe(1);
  });

  it('is guarded behind isMain so importing it for tests never runs main()', () => {
    expect(src).toContain('const isMain =');
    expect(src).toContain('if (isMain) {\n  main();\n}');
  });

  it('queries PROVINCE+DISTRICT only, never SUBDISTRICT (CAM-605 already owns that level, BR-5)', () => {
    expect(src).toContain("level: { in: ['PROVINCE', 'DISTRICT'] }");
    // The live-side query/where clause must never ask for SUBDISTRICT —
    // the only mentions of the word in this file are explanatory comments
    // (asserted separately below), never inside the Prisma `where`.
    const whereStart = src.indexOf('await prisma.adminArea.findMany');
    const whereEnd = src.indexOf('});', whereStart);
    const whereBlock = src.slice(whereStart, whereEnd);
    expect(whereBlock).not.toMatch(/SUBDISTRICT/);
  });
});

describe('CAM-620 computeAdminAreaDrift — the check proven to fail on demand, and to stay quiet', () => {
  it('[unit] names a code present on both sides with a different name (renamed, the RTGS-override-class case)', async () => {
    const mod = await import('../scripts/check-adminarea-drift.mjs');
    const committed = {
      provinces: new Map([['16', { nameTh: 'ลพบุรี', nameEn: 'Lop Buri' }]]),
      districts: new Map(),
    };
    const live = {
      provinces: new Map([['16', { nameTh: 'ลพบุรี', nameEn: 'Lopburi' }]]), // stale pre-RTGS spelling still live
      districts: new Map(),
    };
    const { missingLive, missingCommitted, renamed } = mod.computeAdminAreaDrift(committed, live);
    expect(missingLive).toEqual([]);
    expect(missingCommitted).toEqual([]);
    expect(renamed).toHaveLength(1);
    expect(renamed[0]).toMatchObject({ level: 'PROVINCE', code: '16' });
  });

  it('[unit] names a committed code the live table has never seeded (missingLive)', async () => {
    const mod = await import('../scripts/check-adminarea-drift.mjs');
    const committed = {
      provinces: new Map([
        ['10', { nameTh: 'กรุงเทพมหานคร', nameEn: 'Bangkok' }],
        ['99', { nameTh: 'จังหวัดใหม่', nameEn: 'New Province' }], // added to the file, DB never reseeded
      ]),
      districts: new Map(),
    };
    const live = { provinces: new Map([['10', { nameTh: 'กรุงเทพมหานคร', nameEn: 'Bangkok' }]]), districts: new Map() };
    const { missingLive, missingCommitted, renamed } = mod.computeAdminAreaDrift(committed, live);
    expect(missingLive).toEqual([{ level: 'PROVINCE', code: '99', nameTh: 'จังหวัดใหม่' }]);
    expect(missingCommitted).toEqual([]);
    expect(renamed).toEqual([]);
  });

  it('[unit] names a live code the committed file no longer lists (missingCommitted)', async () => {
    const mod = await import('../scripts/check-adminarea-drift.mjs');
    const committed = { provinces: new Map([['10', { nameTh: 'กรุงเทพมหานคร', nameEn: 'Bangkok' }]]), districts: new Map() };
    const live = {
      provinces: new Map([
        ['10', { nameTh: 'กรุงเทพมหานคร', nameEn: 'Bangkok' }],
        ['77', { nameTh: 'จังหวัดเก่า', nameEn: 'Old Province' }], // removed from the file, still live
      ]),
      districts: new Map(),
    };
    const { missingLive, missingCommitted, renamed } = mod.computeAdminAreaDrift(committed, live);
    expect(missingLive).toEqual([]);
    expect(missingCommitted).toEqual([{ level: 'PROVINCE', code: '77', nameTh: 'จังหวัดเก่า' }]);
    expect(renamed).toEqual([]);
  });

  it('[unit] district-level drift is detected the same way as province-level', async () => {
    const mod = await import('../scripts/check-adminarea-drift.mjs');
    const committed = {
      provinces: new Map([['10', { nameTh: 'กรุงเทพมหานคร', nameEn: 'Bangkok' }]]),
      districts: new Map([['1001', { nameTh: 'เขตพระนคร', nameEn: 'Khet Phra Nakhon', provinceCode: '10' }]]),
    };
    const live = {
      provinces: new Map([['10', { nameTh: 'กรุงเทพมหานคร', nameEn: 'Bangkok' }]]),
      districts: new Map([['1001', { nameTh: 'เขตพระนคร', nameEn: 'Phra Nakhon District', provinceCode: '10' }]]),
    };
    const { renamed } = mod.computeAdminAreaDrift(committed, live);
    expect(renamed).toEqual([
      { level: 'DISTRICT', code: '1001', committed: { nameTh: 'เขตพระนคร', nameEn: 'Khet Phra Nakhon' }, live: { nameTh: 'เขตพระนคร', nameEn: 'Phra Nakhon District' } },
    ]);
  });

  it('[AC-9/EC-8] identical committed/live indexes report 0 drift on all three categories', async () => {
    const mod = await import('../scripts/check-adminarea-drift.mjs');
    const index = {
      provinces: new Map([['10', { nameTh: 'กรุงเทพมหานคร', nameEn: 'Bangkok' }]]),
      districts: new Map([['1001', { nameTh: 'เขตพระนคร', nameEn: 'Khet Phra Nakhon', provinceCode: '10' }]]),
    };
    const { missingLive, missingCommitted, renamed } = mod.computeAdminAreaDrift(index, index);
    expect(missingLive).toEqual([]);
    expect(missingCommitted).toEqual([]);
    expect(renamed).toEqual([]);
  });

  it('[real data] buildCommittedAdminAreaIndex against the real thailand-locations.json diffed against itself is quiet', async () => {
    const mod = await import('../scripts/check-adminarea-drift.mjs');
    const index = mod.buildCommittedAdminAreaIndex(realThailandLocations as never);
    const { missingLive, missingCommitted, renamed } = mod.computeAdminAreaDrift(index, index);
    expect(missingLive).toEqual([]);
    expect(missingCommitted).toEqual([]);
    expect(renamed).toEqual([]);
    expect(index.provinces.size).toBeGreaterThan(0);
    expect(index.districts.size).toBeGreaterThan(0);
  });
});
